"""后端接口测试 —— 用 FastAPI TestClient 覆盖核心 API（不启动真实 uvicorn）。

覆盖：
- /health
- 项目 CRUD + 归档/恢复 + 硬删除（confirm 守卫）
- 材料创建 + 列表搜索 + 来源统计
- 通用配置 GET/POST 持久化（设置页开关落后端）
- 完整分析链路：POST /api/analyze(rule) → 轮询完成 → 结果/引擎标注 → 下载 docx

所有状态落在隔离的临时 SQLite，互不污染开发数据。
"""
import time
import uuid


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert "engine_dir" in body
    assert isinstance(body["pdf_converters"], dict)
    assert isinstance(body["llm_settings"], dict)


def test_projects_crud(client):
    pid = "test_proj_" + uuid.uuid4().hex[:8]
    r = client.post(
        "/api/projects",
        json={"id": pid, "name": "测试项目", "description": "x", "status": "进行中"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["id"] == pid

    r = client.get(f"/api/projects/{pid}")
    assert r.status_code == 200 and r.json()["name"] == "测试项目"

    r = client.get("/api/projects")
    assert pid in [p["id"] for p in r.json()]

    # 归档 / 恢复
    r = client.patch(f"/api/projects/{pid}/archive")
    assert r.json()["is_archived"] == 1
    r = client.patch(f"/api/projects/{pid}/restore")
    assert r.json()["is_archived"] == 0

    # 硬删除需 confirm 守卫
    r = client.delete(f"/api/projects/{pid}")
    assert r.status_code == 409 and r.json().get("error") == "confirm_required"

    r = client.delete(f"/api/projects/{pid}?confirm=true")
    assert r.status_code == 200 and r.json().get("ok") is True

    r = client.get(f"/api/projects/{pid}")
    assert r.status_code == 200 and r.json().get("status") == "not_found"


def test_materials_and_stats(client):
    title = "测试素材_" + uuid.uuid4().hex[:6]
    r = client.post(
        "/api/materials",
        json={
            "title": title,
            "content_text": "某事件的事实描述文本。",
            "source_type": "paste",
            "source": "测试来源",
            "tags": "测试,样例",
        },
    )
    assert r.status_code == 200, r.text
    mid = r.json()["id"]
    assert r.json()["source"] == "测试来源"

    r = client.get("/api/materials", params={"q": "测试素材"})
    assert any(m["id"] == mid for m in r.json())

    r = client.get("/api/materials/stats")
    body = r.json()
    assert body["total"] >= 1
    assert body["by_type"].get("paste", 0) >= 1

    client.delete(f"/api/materials/{mid}")


def test_config_persist(client):
    r = client.get("/api/settings/config")
    assert r.status_code == 200
    assert "engine_mode" in r.json()

    r = client.post(
        "/api/settings/config",
        json={"engine_mode": "llm", "notify_on_done": False},
    )
    assert r.status_code == 200
    assert r.json()["engine_mode"] == "llm"
    assert r.json()["notify_on_done"] is False

    # 持久化：再次 GET 仍为更新后的值
    r = client.get("/api/settings/config")
    assert r.json()["engine_mode"] == "llm"

    # 复位，避免影响其他测试
    client.post("/api/settings/config", json={"engine_mode": "rule", "notify_on_done": True})


def _poll_done(client, tid, timeout=90):
    deadline = time.time() + timeout
    while time.time() < deadline:
        r = client.get(f"/api/analyze/{tid}")
        if r.status_code == 200:
            st = r.json().get("status")
            if st in ("done", "error"):
                return r.json()
        time.sleep(0.5)
    raise AssertionError(f"任务 {tid} 在 {timeout}s 内未完成")


def test_analyze_rule_pipeline(client, sample_event):
    r = client.post(
        "/api/analyze",
        json={
            "title": sample_event["title"],
            "analysis_type": "case",
            "mode": "rule",
            "structured": sample_event,
        },
    )
    assert r.status_code == 200, r.text
    tid = r.json()["task_id"]

    res = _poll_done(client, tid)
    assert res["status"] == "done", res
    data = res["data"]
    assert data["engine_used"] == "rule"
    assert data["degraded_from_llm"] is False
    assert data["contract"]["valid"] is True
    assert data["markdown"] and len(data["markdown"]) > 500
    assert data.get("word"), "应产出 word 路径"

    # 下载 docx
    r = client.get(f"/api/download/{tid}", params={"kind": "word"})
    assert r.status_code == 200
    assert len(r.content) > 1000
