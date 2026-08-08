"""规则引擎输入输出测试 —— 验证「结构化输入 → Markdown 报告」的确定性。

规则引擎是默认分析路径（离线、无 LLM），其输出完全由输入决定。
本文件断言：输入合法 → 产出含一级标题 / 必要章节 / DIAGRAM / 版权行，
且整体结构与「固定快照」逐字段一致（防止生成逻辑被无意改动）。
"""
import json
from pathlib import Path

from app import rule_engine
from tests._snapshot_utils import derive_fields, assert_fields_match

FIX = Path(__file__).resolve().parent / "fixtures"
SNAP = FIX / "snapshots"


def _load(name: str) -> dict:
    return json.loads((FIX / f"{name}.json").read_text(encoding="utf-8"))


def _snapshot(name: str) -> dict:
    return json.loads((SNAP / f"{name}.snapshot.json").read_text(encoding="utf-8"))


def test_event_input_to_markdown():
    si = rule_engine.StructuredInput.model_validate(_load("sample_event"))
    md = rule_engine.generate(si)
    assert md.startswith("# "), "报告应以一级标题开头"
    assert "```DIAGRAM" in md, "应包含利益关系图"
    assert "国作登字" in md, "应包含版权声明"
    actual = derive_fields(md, si.analysis_type)
    assert_fields_match(actual, _snapshot("sample_event"))


def test_policy_input_to_markdown():
    si = rule_engine.StructuredInput.model_validate(_load("sample_policy"))
    md = rule_engine.generate(si)
    assert md.startswith("# ")
    actual = derive_fields(md, si.analysis_type)
    assert_fields_match(actual, _snapshot("sample_policy"))


def test_concept_cap_respected():
    # 事件型：4 类利益 → 上限 3
    ev = rule_engine.StructuredInput.model_validate(_load("sample_event"))
    n = len(rule_engine._pick_concepts(ev))
    assert 1 <= n <= 3, f"事件型概念数应 ≤3，实际 {n}"

    # 政策型：6 类利益 → 上限 4
    pol = rule_engine.StructuredInput.model_validate(_load("sample_policy"))
    assert len(rule_engine._pick_concepts(pol)) == 4, "政策型应命中 4 概念上限"


def test_empty_input_is_rejected_instead_of_generating_placeholders():
    import pytest

    si = rule_engine.StructuredInput(title="空输入测试")
    with pytest.raises(ValueError, match="规则引擎无法仅凭题目生成正式报告"):
        rule_engine.generate(si)


def test_rule_output_has_no_failure_placeholders():
    si = rule_engine.StructuredInput.model_validate(_load("sample_event"))
    md = rule_engine.generate(si)

    for forbidden in ("未提供", "未单独标注", "建议在", "结构占位", "利益关系图（占位）"):
        assert forbidden not in md
    assert md.count("上的张力：") >= 3


def test_structured_input_validation():
    # 非法 interest_type 不应导致崩溃；pydantic 允许额外字符串（按知识库过滤）
    si = rule_engine.StructuredInput.model_validate({
        "title": "t",
        "actors": [{"name": "A", "interest_types": ["material"]}],
        "event": "事件",
    })
    assert si.actors[0].name == "A"
