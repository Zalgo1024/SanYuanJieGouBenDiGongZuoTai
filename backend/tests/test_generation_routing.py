import pytest

from app.generation_routing import GenerationRouteError, decide_generation_route


@pytest.mark.parametrize(
    ("input_mode", "engine", "structured", "llm_available", "selected", "fallback"),
    [
        ("freeform", "auto", None, True, "llm", False),
        ("freeform", "llm", None, True, "llm", False),
        ("structured", "auto", {"event": "事实"}, False, "rule", False),
        ("structured", "rule", {"event": "事实"}, False, "rule", False),
        ("structured", "llm", {"event": "事实"}, True, "llm", True),
        ("structured", "llm", {"event": "事实"}, False, "rule", False),
    ],
)
def test_generation_route_matrix(
    input_mode, engine, structured, llm_available, selected, fallback
):
    decision = decide_generation_route(
        input_mode=input_mode,
        requested_engine=engine,
        structured=structured,
        llm_available=llm_available,
    )

    assert decision.input_mode == input_mode
    assert decision.requested_engine == engine
    assert decision.selected_engine == selected
    assert decision.may_fallback_to_rule is fallback


def test_freeform_rule_is_rejected_before_task_creation():
    with pytest.raises(GenerationRouteError) as exc:
        decide_generation_route(
            input_mode="freeform",
            requested_engine="rule",
            structured=None,
            llm_available=True,
        )

    assert exc.value.code == "freeform_requires_structured_input"


@pytest.mark.parametrize("engine", ["auto", "llm"])
def test_freeform_requires_an_available_llm(engine):
    with pytest.raises(GenerationRouteError) as exc:
        decide_generation_route(
            input_mode="freeform",
            requested_engine=engine,
            structured=None,
            llm_available=False,
        )

    assert exc.value.code == "freeform_requires_llm"


def test_legacy_request_infers_input_mode_from_structured_payload():
    freeform = decide_generation_route(
        input_mode=None,
        requested_engine="llm",
        structured=None,
        llm_available=True,
    )
    structured = decide_generation_route(
        input_mode=None,
        requested_engine="rule",
        structured={"event": "事实"},
        llm_available=False,
    )

    assert freeform.input_mode == "freeform"
    assert structured.input_mode == "structured"


def test_api_rejects_freeform_without_llm_before_creating_task(client, monkeypatch):
    from app.db import SessionLocal
    from app.models import Task

    monkeypatch.setattr("app.routers.analyze.llm_is_available", lambda: False)
    with SessionLocal() as db:
        before = db.query(Task).count()

    response = client.post(
        "/api/analyze",
        json={
            "title": "自由输入测试",
            "input_text": "分析这个事件",
            "analysis_type": "case",
            "input_mode": "freeform",
            "requested_engine": "auto",
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "freeform_requires_llm"
    with SessionLocal() as db:
        assert db.query(Task).count() == before


def test_api_persists_selected_llm_for_freeform_auto(client, monkeypatch):
    from app.db import SessionLocal
    from app.models import Task

    monkeypatch.setattr("app.routers.analyze.llm_is_available", lambda: True)
    response = client.post(
        "/api/analyze",
        json={
            "title": "自动路由测试",
            "input_text": "分析这个事件",
            "analysis_type": "case",
            "input_mode": "freeform",
            "requested_engine": "auto",
        },
    )

    assert response.status_code == 200
    task_id = response.json()["task_id"]
    with SessionLocal() as db:
        task = db.get(Task, task_id)
        assert task.input_mode == "freeform"
        assert task.requested_engine == "auto"
        assert task.mode == "llm"


def test_api_rejects_incomplete_structured_input_before_creating_task(
    client, monkeypatch
):
    monkeypatch.setattr("app.routers.analyze.llm_is_available", lambda: False)
    response = client.post(
        "/api/analyze",
        json={
            "title": "不完整结构化输入",
            "analysis_type": "case",
            "input_mode": "structured",
            "requested_engine": "rule",
            "structured": {"event": "只有事件，没有主体与证据"},
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_structured_input"
    assert "至少 2 个利益主体" in response.json()["error"]["details"]


def test_default_engine_mode_is_auto():
    from app.config_store import DEFAULTS

    assert DEFAULTS["engine_mode"] == "auto"
