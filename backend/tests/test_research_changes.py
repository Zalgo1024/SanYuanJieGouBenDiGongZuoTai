from app.research_changes import compare_research_ledgers


def _ledger(*, stance="支持", strength=2, confidence="medium", extra=False):
    payload = {
        "schema_version": "1.1",
        "sources": [{"id": "s1", "title": "公告", "url": "https://example.com/a"}],
        "claims": [
            {
                "id": "c1",
                "text": "主体维持原政策",
                "claim_type": "fact",
                "confidence": confidence,
                "evidence_ids": ["s1"],
            }
        ],
        "nodes": [
            {"id": "a", "label": "主体A", "stance": stance, "weight": 0.7, "evidence_ids": ["s1"]},
            {"id": "b", "label": "主体B", "stance": "观望", "weight": 0.4, "evidence_ids": ["s1"]},
        ],
        "relations": [
            {
                "id": "r1",
                "source_node": "a",
                "target_node": "b",
                "label": "合作",
                "strength": strength,
                "polarity": "positive" if strength < 4 else "mixed",
                "status": "confirmed",
                "confidence": "medium",
                "evidence_ids": ["s1"],
            }
        ],
        "gaps": [{"id": "g1", "question": "缺少合同", "priority": "high"}],
    }
    if extra:
        payload["nodes"].append({"id": "c", "label": "新主体C", "stance": "反对", "weight": 0.5})
        payload["relations"].append(
            {
                "id": "r2",
                "source_node": "c",
                "target_node": "a",
                "label": "施压",
                "strength": 3,
                "polarity": "negative",
                "status": "inferred",
                "confidence": "low",
            }
        )
        payload["claims"].append(
            {"id": "c2", "text": "新主体开始施压", "claim_type": "inference", "confidence": "low"}
        )
        payload["gaps"] = []
    return payload


def test_compare_research_ledgers_finds_structural_and_judgment_changes():
    changes = compare_research_ledgers(
        _ledger(),
        _ledger(stance="转为反对", strength=4, confidence="high", extra=True),
    )

    assert changes["has_changes"] is True
    assert changes["added_nodes"][0]["id"] == "c"
    assert changes["added_relations"][0]["id"] == "r2"
    assert changes["stance_changes"][0] == {
        "node_id": "a",
        "label": "主体A",
        "before": "支持",
        "after": "转为反对",
    }
    assert changes["changed_relations"][0]["changes"]["strength"] == {"before": 2, "after": 4}
    assert changes["changed_claims"][0]["changes"]["confidence"] == {"before": "medium", "after": "high"}
    assert changes["resolved_gaps"][0]["id"] == "g1"
    assert any("新主体" in item for item in changes["summary"])


def test_compare_research_ledgers_reports_unavailable_snapshots_honestly():
    changes = compare_research_ledgers(None, _ledger())

    assert changes["status"] == "unavailable"
    assert changes["has_changes"] is False
    assert changes["summary"] == ["缺少可比较的历史研究快照"]
