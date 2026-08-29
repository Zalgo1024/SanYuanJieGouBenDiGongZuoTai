import json

from app.benchmarking import evaluate_candidates, generate_general_baseline


def _ledger(*, actors=2, relations=1, gaps=1):
    return {
        "nodes": [{"id": f"n{i}", "label": f"主体{i}"} for i in range(actors)],
        "relations": [
            {"id": f"r{i}", "source_node": "n0", "target_node": "n1", "evidence_ids": ["s1"]}
            for i in range(relations)
        ],
        "gaps": [{"id": f"g{i}", "question": "下一步查什么"} for i in range(gaps)],
    }


def test_benchmark_compares_explainable_metrics_without_declaring_a_winner():
    result = evaluate_candidates(
        system_snapshot=_ledger(actors=4, relations=3, gaps=2),
        general_snapshot=_ledger(actors=2, relations=1, gaps=1),
        human_snapshot=_ledger(actors=5, relations=2, gaps=3),
        audits={"system": {"fact_error_count": 0}, "general": {"fact_error_count": 2}},
        durations={"system": 42.5, "general": 18.0, "human": 900.0},
        preference="system",
    )

    assert result["candidates"]["system"]["actor_count"] == 4
    assert result["candidates"]["system"]["evidence_backed_relation_count"] == 3
    assert result["candidates"]["general"]["fact_error_count"] == 2
    assert result["candidates"]["human"]["investigation_direction_count"] == 3
    assert result["preference"] == "system"
    assert "winner" not in result
    assert "score" not in result


def test_benchmark_keeps_unaudited_fact_errors_unknown():
    result = evaluate_candidates(system_snapshot=_ledger())

    assert result["candidates"]["system"]["fact_error_count"] is None
    assert result["candidates"]["general"]["status"] == "missing"
    assert result["preference"] == "unset"


def test_general_baseline_uses_neutral_prompt_and_reconciles_sources():
    class FakeLlm:
        def generate(self, system, user, **kwargs):
            self.system = system
            return json.dumps({
                "sources": [{"id": "s1", "title": "被模型篡改", "url": "https://wrong.test"}],
                "nodes": [{"id": "n1", "label": "主体", "evidence_ids": ["s1"]}],
                "relations": [], "claims": [], "gaps": [],
            }, ensure_ascii=False)

    llm = FakeLlm()
    snapshot = generate_general_baseline(
        input_text="分析某事件",
        system_snapshot={"sources": [{"id": "s1", "title": "正式公告", "url": "https://example.com/a", "excerpt": "公告内容"}]},
        llm=llm,
    )

    assert "不要使用三元结构理论" in llm.system
    assert snapshot["sources"][0]["title"] == "正式公告"
    assert snapshot["sources"][0]["url"] == "https://example.com/a"
