"""SQLite 持久层 — 用 stdlib sqlite3，无 ORM。

四张表：projects / runs / reports / materials，均带 tenant_id（恒为 1，云就绪）。
所有时间戳用 ISO 8601 字符串存。

表设计要点：
- projects.type: case/policy/opinion/org（写作脚手架，仅前端用，内核不收）
- projects.tone: neutral/provocative（默认基调，可被 generate 覆盖）
- projects.status: draft/generated
- runs.status: pending/running/success/failed
- reports.sections_json: 翻译后的 sections[]（list[dict]）
- reports.graphs_json: {network, org, flow} 三态图
- reports.artifacts_json: {docx_url, pdf_url, html_url, png_urls}
"""
import json
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Optional

from settings import DB_PATH, DEFAULT_TENANT_ID


_lock = threading.Lock()


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


@contextmanager
def get_conn():
    """每个操作开一个连接，避免跨线程共享。check_same_thread=False 兜底。"""
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """建表（IF NOT EXISTS）。启动时调用一次。"""
    with get_conn() as conn:
        c = conn.cursor()
        c.executescript(
            """
            CREATE TABLE IF NOT EXISTS projects (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id   INTEGER NOT NULL DEFAULT 1,
                title       TEXT NOT NULL,
                type        TEXT NOT NULL DEFAULT 'case',
                tone        TEXT NOT NULL DEFAULT 'neutral',
                status      TEXT NOT NULL DEFAULT 'draft',
                description TEXT,
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS materials (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id   INTEGER NOT NULL DEFAULT 1,
                project_id  INTEGER NOT NULL,
                name        TEXT NOT NULL,
                url         TEXT NOT NULL,
                note        TEXT,
                created_at  TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS runs (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id   INTEGER NOT NULL DEFAULT 1,
                project_id  INTEGER NOT NULL,
                title       TEXT NOT NULL,
                tone        TEXT NOT NULL DEFAULT 'neutral',
                status      TEXT NOT NULL DEFAULT 'pending',
                log_json    TEXT NOT NULL DEFAULT '[]',
                error       TEXT,
                report_id   INTEGER,
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS reports (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                tenant_id       INTEGER NOT NULL DEFAULT 1,
                run_id          INTEGER NOT NULL,
                project_id      INTEGER NOT NULL,
                title           TEXT NOT NULL,
                tone            TEXT NOT NULL DEFAULT 'neutral',
                pdf_ok          INTEGER NOT NULL DEFAULT 0,
                sections_json   TEXT NOT NULL DEFAULT '[]',
                graphs_json     TEXT NOT NULL DEFAULT '{}',
                artifacts_json  TEXT NOT NULL DEFAULT '{}',
                cover_graph_url TEXT,
                output_dir      TEXT,
                created_at      TEXT NOT NULL,
                updated_at      TEXT NOT NULL,
                FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_runs_project ON runs(project_id);
            CREATE INDEX IF NOT EXISTS idx_runs_report ON runs(report_id);
            CREATE INDEX IF NOT EXISTS idx_materials_project ON materials(project_id);
            CREATE INDEX IF NOT EXISTS idx_reports_run ON reports(run_id);
            """
        )


# ── projects ───────────────────────────────────────────────

def create_project(title: str, *, type_: str = "case", tone: str = "neutral",
                   description: Optional[str] = None) -> dict:
    now = _now()
    with _lock, get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO projects (tenant_id, title, type, tone, status, description, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, 'draft', ?, ?, ?)",
            (DEFAULT_TENANT_ID, title, type_, tone, description, now, now),
        )
        pid = cur.lastrowid
    # 连接已 commit 关闭，重新读取
    result = get_project(pid)
    assert result is not None, "刚插入的 project 读不到"
    return result


def get_project(pid: int) -> Optional[dict]:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM projects WHERE id=? AND tenant_id=?",
                           (pid, DEFAULT_TENANT_ID)).fetchone()
        return dict(row) if row else None


def list_projects() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM projects WHERE tenant_id=? ORDER BY id DESC",
            (DEFAULT_TENANT_ID,),
        ).fetchall()
        return [dict(r) for r in rows]


def update_project_status(pid: int, status: str) -> None:
    with _lock, get_conn() as conn:
        conn.execute("UPDATE projects SET status=?, updated_at=? WHERE id=?",
                     (status, _now(), pid))


# ── materials ──────────────────────────────────────────────

def add_material(pid: int, name: str, url: str, *, note: Optional[str] = None) -> dict:
    now = _now()
    with _lock, get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO materials (tenant_id, project_id, name, url, note, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (DEFAULT_TENANT_ID, pid, name, url, note, now),
        )
        mid = cur.lastrowid
        return {"id": mid, "project_id": pid, "name": name, "url": url, "note": note,
                "created_at": now}


def list_materials(pid: int) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM materials WHERE project_id=? AND tenant_id=? ORDER BY id ASC",
            (pid, DEFAULT_TENANT_ID),
        ).fetchall()
        return [dict(r) for r in rows]


# ── runs ───────────────────────────────────────────────────

def create_run(pid: int, title: str, tone: str = "neutral") -> dict:
    now = _now()
    with _lock, get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO runs (tenant_id, project_id, title, tone, status, log_json, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, 'pending', '[]', ?, ?)",
            (DEFAULT_TENANT_ID, pid, title, tone, now, now),
        )
        rid = cur.lastrowid
        return {"id": rid, "project_id": pid, "title": title, "tone": tone,
                "status": "pending", "log": [], "error": None, "report_id": None,
                "created_at": now, "updated_at": now}


def get_run(rid: int) -> Optional[dict]:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM runs WHERE id=? AND tenant_id=?",
                           (rid, DEFAULT_TENANT_ID)).fetchone()
        if not row:
            return None
        d = dict(row)
        d["log"] = json.loads(d.pop("log_json") or "[]")
        return d


def append_run_log(rid: int, line: str) -> None:
    """后台线程调用：原子追加一条日志。"""
    now = _now()
    with _lock, get_conn() as conn:
        row = conn.execute("SELECT log_json FROM runs WHERE id=?", (rid,)).fetchone()
        if not row:
            return
        logs = json.loads(row["log_json"] or "[]")
        logs.append(line)
        conn.execute(
            "UPDATE runs SET log_json=?, updated_at=? WHERE id=?",
            (json.dumps(logs, ensure_ascii=False), now, rid),
        )


def set_run_status(rid: int, status: str, *,
                   error: Optional[str] = None,
                   report_id: Optional[int] = None) -> None:
    now = _now()
    with _lock, get_conn() as conn:
        if error is not None:
            conn.execute(
                "UPDATE runs SET status=?, error=?, updated_at=? WHERE id=?",
                (status, error, now, rid),
            )
        elif report_id is not None:
            conn.execute(
                "UPDATE runs SET status=?, report_id=?, updated_at=? WHERE id=?",
                (status, report_id, now, rid),
            )
        else:
            conn.execute(
                "UPDATE runs SET status=?, updated_at=? WHERE id=?",
                (status, now, rid),
            )


def list_runs_for_project(pid: int) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM runs WHERE project_id=? AND tenant_id=? ORDER BY id DESC",
            (pid, DEFAULT_TENANT_ID),
        ).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["log"] = json.loads(d.pop("log_json") or "[]")
            out.append(d)
        return out


# ── reports ────────────────────────────────────────────────

def create_report(*, run_id: int, project_id: int, title: str, tone: str,
                  pdf_ok: bool, sections: list[dict], graphs: dict,
                  artifacts: dict, cover_graph_url: Optional[str],
                  output_dir: str) -> dict:
    now = _now()
    with _lock, get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO reports "
            "(tenant_id, run_id, project_id, title, tone, pdf_ok, "
            " sections_json, graphs_json, artifacts_json, cover_graph_url, output_dir, "
            " created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (DEFAULT_TENANT_ID, run_id, project_id, title, tone, 1 if pdf_ok else 0,
             json.dumps(sections, ensure_ascii=False),
             json.dumps(graphs, ensure_ascii=False),
             json.dumps(artifacts, ensure_ascii=False),
             cover_graph_url, output_dir, now, now),
        )
        rep_id = cur.lastrowid
    result = get_report(rep_id)
    assert result is not None, "刚插入的 report 读不到"
    return result


def get_report(rep_id: int) -> Optional[dict]:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM reports WHERE id=? AND tenant_id=?",
                           (rep_id, DEFAULT_TENANT_ID)).fetchone()
        if not row:
            return None
        d = dict(row)
        d["pdf_ok"] = bool(d["pdf_ok"])
        d["sections"] = json.loads(d.pop("sections_json") or "[]")
        d["graphs"] = json.loads(d.pop("graphs_json") or "{}")
        d["artifacts"] = json.loads(d.pop("artifacts_json") or "{}")
        return d
