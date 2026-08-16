"""Transactional report-version operations for the local SQLite workspace."""

from __future__ import annotations

import time
import uuid

from sqlalchemy import func
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import IntegrityError, OperationalError

from app.models import ReportVersion, Task


def ensure_original_version(
    db,
    task: Task,
    *,
    summary: str | None = None,
    note: str = "生成引擎原始稿",
    editor: str = "系统",
) -> ReportVersion:
    """Atomically seed and return the immutable v1 row for a task."""
    existing = (
        db.query(ReportVersion)
        .filter(
            ReportVersion.task_id == task.id,
            ReportVersion.version_no == 1,
        )
        .first()
    )
    if existing is not None:
        return existing

    values = {
        "id": uuid.uuid4().hex,
        "task_id": task.id,
        "kind": "original",
        "version_no": 1,
        "edited_by": "ai",
        "summary": summary
        or ("自动生成（联网检索）" if (task.web or task.search_enabled) else "自动生成"),
        "content_markdown": (task.result or {}).get("markdown") or "",
        "note": note,
        "editor": editor,
        "is_current": 1,
    }
    statement = (
        sqlite_insert(ReportVersion)
        .values(**values)
        .on_conflict_do_nothing(index_elements=["task_id", "version_no"])
    )
    db.execute(statement)
    db.commit()
    winner = (
        db.query(ReportVersion)
        .filter(
            ReportVersion.task_id == task.id,
            ReportVersion.version_no == 1,
        )
        .one()
    )
    return winner


def create_report_version(
    db,
    *,
    task_id: str,
    content_markdown: str,
    content_html: str | None,
    note: str | None,
    edited_by: str,
    editor: str,
    summary: str | None = None,
    max_attempts: int = 6,
) -> ReportVersion:
    """Allocate the next version and switch current state in one retryable transaction."""
    last_error: Exception | None = None
    for attempt in range(max_attempts):
        try:
            max_no = (
                db.query(func.max(ReportVersion.version_no))
                .filter(ReportVersion.task_id == task_id)
                .scalar()
                or 0
            )
            next_no = max_no + 1
            db.query(ReportVersion).filter(
                ReportVersion.task_id == task_id
            ).update({ReportVersion.is_current: 0}, synchronize_session=False)
            version = ReportVersion(
                task_id=task_id,
                kind="revised",
                version_no=next_no,
                edited_by=edited_by,
                summary=summary or note or ("手动修订" if edited_by == "human" else "AI 再改"),
                content_markdown=content_markdown,
                content_html=content_html,
                note=note,
                editor=editor,
                is_current=1,
            )
            db.add(version)
            db.commit()
            db.refresh(version)
            return version
        except (IntegrityError, OperationalError) as exc:
            db.rollback()
            last_error = exc
            if attempt + 1 < max_attempts:
                time.sleep(0.02 * (attempt + 1))
    assert last_error is not None
    raise last_error


def set_current_version(db, version_id: str) -> ReportVersion | None:
    """Switch a task to one existing version while preserving one-current invariant."""
    version = db.get(ReportVersion, version_id)
    if version is None:
        return None
    db.query(ReportVersion).filter(
        ReportVersion.task_id == version.task_id
    ).update({ReportVersion.is_current: 0}, synchronize_session=False)
    db.query(ReportVersion).filter(ReportVersion.id == version_id).update(
        {ReportVersion.is_current: 1}, synchronize_session=False
    )
    db.commit()
    db.refresh(version)
    return version
