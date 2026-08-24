import uuid


def _snapshot(actor_count: int, relation_count: int):
    return {
        "schema_version": "1.2",
        "sources": [{"id": "s1", "title": "公告", "url": "https://example.com/a"}],
        "nodes": [{"id": f"n{i}", "label": f"主体{i}", "evidence_ids": ["s1"]} for i in range(actor_count)],
        "relations": [
            {"id": f"r{i}", "source_node": "n0", "target_node": "n1", "evidence_ids": ["s1"]}
            for i in range(relation_count)
        ],
        "gaps": [{"id": "g1", "question": "补充合同"}],
    }


def test_benchmark_api_persists_same_task_comparison(client, monkeypatch):
    from app.db import SessionLocal
    from app.models import ReportVersion, Task

    task_id = "bench_" + uuid.uuid4().hex[:12]
    version_id = uuid.uuid4().hex
    with SessionLocal() as db:
        db.add(Task(id=task_id, title="P2 对照测试", input_text="分析某事件", status="done", result={"markdown": "# 报告"}))
        db.add(
            ReportVersion(
                id=version_id,
                task_id=task_id,
                kind="original",
                content_markdown="# 报告",
                version_no=1,
                is_current=1,
                research_snapshot=_snapshot(4, 2),
                research_status="verified",
            )
        )
        db.commit()

    response = client.post(
        f"/api/reports/{task_id}/benchmarks",
        json={
            "version_id": version_id,
            "general_snapshot": _snapshot(2, 1),
            "audits": {"general": {"fact_error_count": 1}},
            "durations": {"system": 30, "general": 10},
            "candidate_metadata": {"general": {"model": "generic-model"}},
            "preference": "system",
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["result"]["candidates"]["system"]["actor_count"] == 4
    assert body["result"]["candidates"]["general"]["fact_error_count"] == 1
    assert body["result"]["candidates"]["human"]["status"] == "missing"
    assert body["candidate_metadata"]["general"]["model"] == "generic-model"

    listing = client.get(f"/api/reports/{task_id}/benchmarks")
    assert listing.status_code == 200
    assert listing.json()["items"][0]["id"] == body["id"]

    monkeypatch.setattr("app.llm_settings_store.resolve_config", lambda _cfg: {"api_key": "", "model": "", "source": "none"})
    baseline = client.post(
        f"/api/reports/{task_id}/benchmarks/general-baseline",
        json={"version_id": version_id},
    )
    assert baseline.status_code == 422
    assert baseline.json()["error"] == "llm_not_configured"
