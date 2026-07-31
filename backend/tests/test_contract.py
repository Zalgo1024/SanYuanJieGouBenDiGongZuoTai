"""报告契约测试 —— 验证 LLM 输出的 Markdown 契约校验与修复（contract.validate_and_repair）。

覆盖：
- 合法规则引擎 Markdown：diagram_ok / 无缺失 / valid / 不修复 / 不降级
- 缺 DIAGRAM：自动合成（diagram_synthetic）
- DIAGRAM 为非法 JSON：合成替换
- 缺必要章节：报错并补齐占位
- 图合成 且 必要章节缺失：触发 degrade（LLM 输出偏离契约太远，应回退规则引擎）
- policy 类型必要章节集合正确
"""
import json
from pathlib import Path

from app import rule_engine
from app.contract import validate_and_repair, REQUIRED_SECTIONS

FIX = Path(__file__).resolve().parent / "fixtures"


def _event_md() -> str:
    data = json.loads((FIX / "sample_event.json").read_text(encoding="utf-8"))
    return rule_engine.generate(rule_engine.StructuredInput.model_validate(data))


def test_valid_rule_markdown_passes():
    md = _event_md()
    repaired, contract = validate_and_repair(md, "case")
    assert contract["diagram_ok"] is True
    assert contract["missing_sections"] == []
    assert contract["valid"] is True
    assert contract["repaired"] is False
    assert contract["degrade"] is False
    assert contract["diagram_synthetic"] is False
    assert repaired == md  # 合法内容不应被改动


def test_missing_diagram_is_synthesized():
    md = (
        "# 标题\n\n## 案例事实摘要\n\n事实\n\n## 分析框架说明\n\nx\n\n"
        "## 三元结构分析正文\n\ny\n\n## 结论\n\nz\n"
    )
    repaired, contract = validate_and_repair(md, "case")
    assert contract["diagram_synthetic"] is True
    assert contract["diagram_ok"] is True
    assert "```DIAGRAM" in repaired


def test_invalid_diagram_json_is_synthesized():
    md = (
        "# 标题\n\n```DIAGRAM\n{not valid json\n```\n\n"
        "## 案例事实摘要\n\nx\n\n## 分析框架说明\n\nx\n\n"
        "## 三元结构分析正文\n\nx\n\n## 结论\n\nx\n"
    )
    repaired, contract = validate_and_repair(md, "case")
    assert contract["diagram_synthetic"] is True
    assert contract["diagram_ok"] is True


def test_missing_sections_reported_and_patched():
    md = (
        "# 标题\n\n```DIAGRAM\n"
        '{"viz":"network","title":"t","nodes":[{"id":"a","label":"A","type":"actor"}],"edges":[]}\n```\n'
    )
    repaired, contract = validate_and_repair(md, "case")
    assert len(contract["missing_sections"]) > 0
    assert contract["repaired"] is True
    for s in REQUIRED_SECTIONS["case"]:
        assert f"## {s}" in repaired, f"缺失章节应被补齐：{s}"


def test_degrade_when_synthetic_and_missing_sections():
    md = "# 标题\n\n只有正文，没有利益关系图，也没有必要章节。\n"
    repaired, contract = validate_and_repair(md, "case")
    assert contract["diagram_synthetic"] is True
    assert len(contract["missing_sections"]) > 0
    assert contract["degrade"] is True


def test_policy_required_sections():
    req = REQUIRED_SECTIONS["policy"]
    assert "独立事实摘要" in req
    assert "结论与推导" in req
    assert "案例事实摘要" not in req
