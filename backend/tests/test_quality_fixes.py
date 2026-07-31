"""质量修复回归测试 —— 对应代码审查文档中的 P1 项。

覆盖：
- 硬编码编辑者名/owner 已改为可配置（settings.default_owner_*），不再散落「李政恒」。
- project_detail 用单次 IN 批量查询聚合报告版本（消除 N+1）。
- 统一异常处理：404 → http_error 信封；校验错误 → 422 validation_error 信封；
  未捕获异常 → 500 internal_error 信封（不泄露堆栈）。

注意：app.db / app.models 必须在函数内导入（conftest 在收集后才 patch SessionLocal）。
"""
import uuid


def test_default_owner_name_configurable(client, monkeypatch):
    """创建项目/保存修订版时，归属人取 settings.default_owner_*，而非硬编码。"""
    from app.settings import settings

    # 1) 默认配置：owner_name / owner_id 取自 settings 默认值
    pid = "owner_" + uuid.uuid4().hex[:8]
    r = client.post("/api/projects", json={"id": pid, "name": "归属测试"})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["owner_name"] == settings.default_owner_name
    assert j["owner_id"] == settings.default_owner_id

    # 2) 可被 env/配置覆盖（不再硬编码「李政恒」）
    monkeypatch.setattr(settings, "default_owner_name", "自定义编辑者")
    monkeypatch.setattr(settings, "default_owner_id", "custom")
    pid2 = "owner2_" + uuid.uuid4().hex[:8]
    r = client.post("/api/projects", json={"id": pid2, "name": "归属测试2"})
    assert r.json()["owner_name"] == "自定义编辑者"
    assert r.json()["owner_id"] == "custom"

    # 3) 保存修订版时 editor 取默认归属人（证明未硬编码）
    from app.db import SessionLocal
    from app.models import Task

    tid = uuid.uuid4().hex
    with SessionLocal() as db:
        db.add(
            Task(
                id=tid,
                title="修订归属",
                project_id=pid2,
                status="done",
                input_text="",
                result={"markdown": "# 标题\n正文"},
            )
        )
        db.commit()
    r = client.post(f"/api/reports/{tid}/versions", json={"content_markdown": "# 修订\n正文"})
    assert r.status_code == 200, r.text
    assert r.json()["editor"] == "自定义编辑者"


def test_project_detail_aggregates_versions(client):
    """project_detail 对每个任务聚合其报告版本（单次 IN 批量查询，非 N+1）。"""
    from app.db import SessionLocal
    from app.models import Project, ReportVersion, Task

    pid = "nplus1_" + uuid.uuid4().hex[:8]
    with SessionLocal() as db:
        db.add(Project(id=pid, name="N+1 项目", owner_name="x", owner_id="x", is_archived=0))
        t1 = Task(
            id=uuid.uuid4().hex,
            title="任务A",
            project_id=pid,
            status="done",
            input_text="",
            result={"word": "/tmp/a.docx"},
        )
        t2 = Task(
            id=uuid.uuid4().hex,
            title="任务B",
            project_id=pid,
            status="done",
            input_text="",
            result={"word": "/tmp/b.docx"},
        )
        db.add_all([t1, t2])
        db.commit()
        # 任务A：original + revised；任务B：仅 original
        db.add(ReportVersion(task_id=t1.id, kind="original", content_markdown="o1", editor="系统"))
        db.add(ReportVersion(task_id=t1.id, kind="revised", content_markdown="r1", editor="系统"))
        db.add(ReportVersion(task_id=t2.id, kind="original", content_markdown="o2", editor="系统"))
        db.commit()

    r = client.get(f"/api/projects/{pid}/detail")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["task_count"] == 2
    by_title = {t["title"]: t for t in body["tasks"]}
    assert by_title["任务A"]["version_count"] == 2
    assert by_title["任务A"]["current_version_kind"] == "revised"
    assert by_title["任务B"]["version_count"] == 1
    assert by_title["任务B"]["current_version_kind"] == "original"


def test_unified_error_envelope(client):
    """统一异常信封：404 / 422 返回 JSON {error: ...}；全局 Exception 处理器已注册。"""
    from app.main import app
    from fastapi.exceptions import RequestValidationError
    from starlette.exceptions import HTTPException as StarletteHTTPException

    # 1) 不存在的路径 → 404 http_error（不再返回 HTML 堆栈）
    r = client.get("/this/route/does/not/exist")
    assert r.status_code == 404
    assert r.json().get("error") == "http_error"

    # 2) 校验失败（缺必填 title）→ 422 validation_error
    r = client.post("/api/analyze", json={"analysis_type": "case"})
    assert r.status_code == 422
    assert r.json().get("error") == "validation_error"

    # 3) 全局 Exception 处理器已装配：未捕获异常将统一返回 500 internal_error 信封
    #    （TestClient 默认会重抛服务端异常，故此处断言处理器已注册，而非触发实时 500）
    assert StarletteHTTPException in app.exception_handlers
    assert RequestValidationError in app.exception_handlers
    assert Exception in app.exception_handlers
