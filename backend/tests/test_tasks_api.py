"""tasks API 单测（T7）：GET /api/tasks 契约（对齐前端 TaskDTO）。

- 空列表返回 200 且为数组；
- 插入任务后返回字段齐全（task_id/title/status/analysis_type/project_id/created_at）；
- project_id / status / limit 过滤生效。

注意：所有 DB 访问必须延迟到函数内通过 `app.db` 模块属性取 SessionLocal，
以绑定 conftest 打过补丁的隔离临时库（勿在模块顶层 from app.db import SessionLocal）。
"""
import uuid

from app.models import Task  # Task 仅依赖 Base（补丁不替换），可在顶层导入

TASK_DTO_FIELDS = {"task_id", "title", "status", "analysis_type", "project_id", "created_at"}


def _insert_task(**kw) -> str:
    import app.db as dbmod

    tid = "t_" + uuid.uuid4().hex[:12]
    with dbmod.SessionLocal() as db:
        db.add(
            Task(
                id=tid,
                title=kw.get("title", "任务测试"),
                input_text=kw.get("input_text", "测试输入"),
                analysis_type=kw.get("analysis_type", "case"),
                status=kw.get("status", "done"),
                project_id=kw.get("project_id"),
            )
        )
        db.commit()
    return tid


def test_tasks_empty_list_is_array(client):
    """契约：GET /api/tasks 恒返回 200 且为数组（TaskDTO[]）。"""
    r = client.get("/api/tasks")
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, list)


def test_tasks_returns_full_dto_fields(client):
    """契约：插入任务后返回字段与前端 TaskDTO 完全一致。"""
    tid = _insert_task(title="组织诊断测试", analysis_type="org", status="done")
    r = client.get("/api/tasks")
    assert r.status_code == 200
    mine = [i for i in r.json() if i["task_id"] == tid]
    assert mine, "应能查到刚插入的任务"
    dto = mine[0]
    assert set(dto.keys()) == TASK_DTO_FIELDS, dto.keys()
    assert dto["title"] == "组织诊断测试"
    assert dto["analysis_type"] == "org"
    assert dto["status"] == "done"
    assert dto["project_id"] is None
    assert dto["created_at"] is not None  # ISO 时间


def test_tasks_filter_by_status(client):
    tid_done = _insert_task(title="已完成", status="done")
    _insert_task(title="排队中", status="queued")
    r = client.get("/api/tasks", params={"status": "done"})
    ids = [i["task_id"] for i in r.json()]
    assert tid_done in ids
    assert all(i["status"] == "done" for i in r.json())


def test_tasks_filter_by_project(client):
    pid = "proj_" + uuid.uuid4().hex[:8]
    tid = _insert_task(title="项目内任务", project_id=pid)
    _insert_task(title="无项目任务")
    r = client.get("/api/tasks", params={"project_id": pid})
    ids = [i["task_id"] for i in r.json()]
    assert tid in ids
    assert all(i["project_id"] == pid for i in r.json())


def test_tasks_limit(client):
    for i in range(3):
        _insert_task(title=f"limit任务{i}")
    r = client.get("/api/tasks", params={"limit": 2})
    assert len(r.json()) <= 2
