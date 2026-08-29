import uuid

import app.db as dbmod
from app.models import Material, Task


def test_create_enrichment_job_binds_target_and_current_version(client, monkeypatch):
    dbmod.init_db()
    task_id = uuid.uuid4().hex
    material_id = uuid.uuid4().hex
    with dbmod.SessionLocal() as db:
        db.add(
            Task(
                id=task_id,
                title="证据补充接口测试",
                input_text="分析一个公开事件",
                analysis_type="case",
                status="done",
                mode="llm",
                result={"markdown": "# 报告\n\n## 一、事实摘要\n\n待核验。"},
            )
        )
        db.add(
            Material(
                id=material_id,
                title="官方公告",
                content_text="官方公告确认了事件发生，并给出了明确日期。",
                source_type="paste",
            )
        )
        db.commit()

    monkeypatch.setattr(
        "app.llm_settings_store.resolve_config",
        lambda _config=None: {"api_key": "configured-for-test"},
    )
    response = client.post(
        f"/api/reports/{task_id}/enrichments",
        json={
            "instruction": "用官方公告补齐事实与时间线",
            "material_ids": [material_id],
            "web": False,
            "llm_config": {"profile_id": "test-profile"},
        },
    )

    assert response.status_code == 202
    payload = response.json()
    assert payload["target_task_id"] == task_id
    assert payload["base_version_id"]
    with dbmod.SessionLocal() as db:
        job = db.get(Task, payload["job_task_id"])
        assert job.operation == "enrichment"
        assert job.target_task_id == task_id
        assert job.base_version_id == payload["base_version_id"]
        assert job.material_ids == [material_id]


def test_enrichment_requires_at_least_one_evidence_source(client):
    dbmod.init_db()
    task_id = uuid.uuid4().hex
    with dbmod.SessionLocal() as db:
        db.add(
            Task(
                id=task_id,
                title="无来源补充测试",
                input_text="分析事件",
                analysis_type="case",
                status="done",
                result={"markdown": "# 报告\n\n正文。"},
            )
        )
        db.commit()

    response = client.post(
        f"/api/reports/{task_id}/enrichments",
        json={"instruction": "补充证据", "material_ids": [], "web": False},
    )

    assert response.status_code == 422
    assert "材料" in response.json()["message"]
