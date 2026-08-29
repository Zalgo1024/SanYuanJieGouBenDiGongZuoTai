import uuid
from datetime import timedelta


def _project_and_seed():
    from app.db import SessionLocal
    from app.models import Project, Task

    project_id = f"monitor-{uuid.uuid4().hex[:8]}"
    task_id = uuid.uuid4().hex
    research = {
        "schema_version": "1.1",
        "sources": [{"id": "s1", "title": "公告", "url": "https://example.com/a"}],
        "claims": [{"id": "c1", "text": "原判断", "claim_type": "fact", "confidence": "medium", "evidence_ids": ["s1"]}],
        "nodes": [{"id": "a", "label": "主体A", "stance": "观望", "evidence_ids": ["s1"]}],
        "relations": [],
        "gaps": [],
    }
    with SessionLocal() as db:
        db.add(Project(id=project_id, name="持续追踪测试", status="进行中"))
        db.add(
            Task(
                id=task_id,
                project_id=project_id,
                title="追踪主题",
                input_text="分析追踪主题",
                analysis_type="case",
                input_mode="freeform",
                requested_engine="llm",
                mode="llm",
                web=True,
                status="done",
                result={"markdown": "# 初始报告", "research": research},
            )
        )
        db.commit()
    return project_id, task_id


def test_monitor_api_configures_and_runs_one_auditable_task(client):
    from app.db import SessionLocal
    from app.models import ResearchMonitor, Task

    project_id, seed_id = _project_and_seed()

    configured = client.put(
        f"/api/projects/{project_id}/monitor",
        json={"enabled": True, "interval_hours": 24, "seed_task_id": seed_id},
    )
    assert configured.status_code == 200
    assert configured.json()["enabled"] is True
    assert configured.json()["interval_hours"] == 24

    started = client.post(f"/api/projects/{project_id}/monitor/run")
    assert started.status_code == 200
    task_id = started.json()["task_id"]
    with SessionLocal() as db:
        task = db.get(Task, task_id)
        monitor = db.query(ResearchMonitor).filter(ResearchMonitor.project_id == project_id).one()
        assert task.status == "queued"
        assert task.project_id == project_id
        assert task.monitor_id == monitor.id
        assert task.web is True
        assert task.source_urls is None
        assert monitor.last_success_task_id == seed_id

    duplicate = client.post(f"/api/projects/{project_id}/monitor/run")
    assert duplicate.status_code == 409
    assert duplicate.json()["error"] == "monitor_busy"


def test_due_monitor_reuses_queue_and_completion_records_change():
    from app.db import SessionLocal
    from app.models import ResearchMonitor, Task, _now
    from app.monitoring import record_monitor_completion, run_due_monitors

    project_id, seed_id = _project_and_seed()
    with SessionLocal() as db:
        monitor = ResearchMonitor(
            id=uuid.uuid4().hex,
            project_id=project_id,
            seed_task_id=seed_id,
            enabled=True,
            interval_hours=12,
            next_run_at=_now() - timedelta(minutes=1),
            last_success_task_id=seed_id,
        )
        db.add(monitor)
        db.commit()
        monitor_id = monitor.id

    created = run_due_monitors(now=_now())
    assert len(created) == 1
    task_id = created[0]

    with SessionLocal() as db:
        task = db.get(Task, task_id)
        task.status = "done"
        task.result = {
            "markdown": "# 新报告",
            "research": {
                "schema_version": "1.1",
                "sources": [{"id": "s1", "title": "公告", "url": "https://example.com/a"}],
                "claims": [{"id": "c1", "text": "原判断", "claim_type": "fact", "confidence": "high", "evidence_ids": ["s1"]}],
                "nodes": [
                    {"id": "a", "label": "主体A", "stance": "反对", "evidence_ids": ["s1"]},
                    {"id": "b", "label": "新主体B", "stance": "支持", "evidence_ids": ["s1"]},
                ],
                "relations": [],
                "gaps": [],
            },
        }
        db.commit()

    record_monitor_completion(task_id)

    with SessionLocal() as db:
        monitor = db.get(ResearchMonitor, monitor_id)
        assert monitor.last_success_task_id == task_id
        assert monitor.latest_change["has_changes"] is True
        assert monitor.latest_change["added_nodes"][0]["label"] == "新主体B"
        assert monitor.last_error is None
