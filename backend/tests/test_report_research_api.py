import uuid


def _task_with_research():
    from app.db import SessionLocal
    from app.models import Task

    task_id = uuid.uuid4().hex
    research = {
        "schema_version": "1.0",
        "status": "verified",
        "sources": [
            {"id": "s1", "title": "公告", "url": "https://example.com/a"}
        ],
        "claims": [
            {
                "id": "c1",
                "text": "已确认的关键事实",
                "claim_type": "fact",
                "confidence": "high",
                "evidence_ids": ["s1"],
            }
        ],
        "relations": [],
        "gaps": [],
        "metrics": {"key_claim_evidence_coverage": 1.0},
    }
    with SessionLocal() as db:
        db.add(
            Task(
                id=task_id,
                title="证据 API 测试",
                status="done",
                analysis_type="case",
                input_text="测试",
                result={"markdown": "# 报告\n\n## 结论\n\n已确认的关键事实。", "research": research},
            )
        )
        db.commit()
    return task_id


def test_research_endpoint_returns_current_version_snapshot(client):
    task_id = _task_with_research()
    index = client.get(f"/api/reports/{task_id}").json()
    version_id = index["current_version_id"]

    response = client.get(f"/api/reports/{task_id}/research")

    assert response.status_code == 200
    body = response.json()
    assert body["version_id"] == version_id
    assert body["research_status"] == "verified"
    assert body["research"]["claims"][0]["evidence_ids"] == ["s1"]

    version = client.get(f"/api/reports/{task_id}/versions/{version_id}").json()
    assert version["research_status"] == "verified"
    assert version["research"]["claims"][0]["id"] == "c1"


def test_manual_revision_exposes_stale_inherited_snapshot(client):
    task_id = _task_with_research()
    client.get(f"/api/reports/{task_id}")
    saved = client.post(
        f"/api/reports/{task_id}/versions",
        json={"content_markdown": "# 修订报告\n\n## 结论\n\n改写后的判断。"},
    ).json()

    response = client.get(f"/api/reports/{task_id}/research?version_id={saved['id']}")

    assert response.status_code == 200
    assert response.json()["research_status"] == "stale"
    assert response.json()["research"]["claims"][0]["id"] == "c1"


def test_research_endpoint_keeps_legacy_reports_compatible(client):
    from app.db import SessionLocal
    from app.models import Task

    task_id = uuid.uuid4().hex
    with SessionLocal() as db:
        db.add(Task(id=task_id, title="旧报告", status="done", input_text="", result={"markdown": "# 旧报告"}))
        db.commit()

    response = client.get(f"/api/reports/{task_id}/research")

    assert response.status_code == 200
    assert response.json()["research_status"] == "unavailable"
    assert response.json()["research"] is None


def test_report_changes_endpoint_compares_two_version_snapshots(client):
    from app.db import SessionLocal
    from app.models import ReportVersion

    task_id = _task_with_research()
    first = client.get(f"/api/reports/{task_id}").json()["current_version_id"]
    with SessionLocal() as db:
        original = db.get(ReportVersion, first)
        changed = dict(original.research_snapshot)
        changed["nodes"] = [{"id": "new", "label": "新主体"}]
        db.add(
            ReportVersion(
                task_id=task_id,
                version_no=2,
                kind="revised",
                edited_by="ai",
                content_markdown="# v2",
                is_current=0,
                research_snapshot=changed,
                research_status="verified",
            )
        )
        db.commit()
        second = db.query(ReportVersion).filter(ReportVersion.task_id == task_id, ReportVersion.version_no == 2).one()
        second_id = second.id

    response = client.get(
        f"/api/reports/{task_id}/changes?from_version_id={first}&to_version_id={second_id}"
    )

    assert response.status_code == 200
    body = response.json()
    assert body["from_version_id"] == first
    assert body["to_version_id"] == second_id
    assert body["changes"]["added_nodes"][0]["label"] == "新主体"
