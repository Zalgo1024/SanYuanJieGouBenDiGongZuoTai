import threading

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import Base, ReportVersion, Task
from app.report_version_service import (
    create_report_version,
    ensure_original_version,
    set_current_version,
)


@pytest.fixture
def version_db(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'versions.db'}",
        connect_args={"check_same_thread": False, "timeout": 10},
    )
    Base.metadata.create_all(bind=engine)
    sessions = sessionmaker(bind=engine, autoflush=True, autocommit=False)
    with sessions() as db:
        db.add(
            Task(
                id="task-1",
                title="并发版本测试",
                input_text="测试",
                analysis_type="case",
                status="done",
                result={"markdown": "## 一、原始报告\n\n正文。"},
            )
        )
        db.commit()
    yield sessions
    engine.dispose()


def _run_concurrently(worker):
    barrier = threading.Barrier(2)
    results = []
    errors = []

    def run(index):
        try:
            barrier.wait(timeout=5)
            results.append(worker(index))
        except Exception as exc:  # noqa: BLE001
            errors.append(exc)

    threads = [threading.Thread(target=run, args=(index,)) for index in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=10)
    assert not any(thread.is_alive() for thread in threads)
    assert not errors, [repr(error) for error in errors]
    return results


def test_original_version_seed_is_atomic_under_concurrent_readers(version_db):
    def seed(_index):
        with version_db() as db:
            task = db.get(Task, "task-1")
            return ensure_original_version(db, task).id

    ids = _run_concurrently(seed)

    assert len(set(ids)) == 1
    with version_db() as db:
        rows = db.query(ReportVersion).filter_by(task_id="task-1").all()
        assert [(row.version_no, row.kind, row.is_current) for row in rows] == [
            (1, "original", 1)
        ]


def test_revised_versions_get_unique_numbers_and_one_current_row(version_db):
    with version_db() as db:
        ensure_original_version(db, db.get(Task, "task-1"))

    def save(index):
        with version_db() as db:
            version = create_report_version(
                db,
                task_id="task-1",
                content_markdown=f"## 修订 {index}",
                content_html=None,
                note=f"修订 {index}",
                edited_by="human",
                editor="测试用户",
            )
            return version.version_no

    version_numbers = _run_concurrently(save)

    assert sorted(version_numbers) == [2, 3]
    with version_db() as db:
        rows = (
            db.query(ReportVersion)
            .filter_by(task_id="task-1")
            .order_by(ReportVersion.version_no)
            .all()
        )
        assert [row.version_no for row in rows] == [1, 2, 3]
        assert sum(row.is_current == 1 for row in rows) == 1
        assert rows[-1].is_current == 1


def test_selecting_the_existing_current_version_keeps_it_current(version_db):
    with version_db() as db:
        current = ensure_original_version(db, db.get(Task, "task-1"))
        selected = set_current_version(db, current.id)
        selected_id = selected.id

    with version_db() as db:
        row = db.get(ReportVersion, selected_id)
        assert row.is_current == 1
