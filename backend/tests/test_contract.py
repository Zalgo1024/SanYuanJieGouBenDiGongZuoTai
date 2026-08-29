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


def test_missing_diagram_is_rejected_without_structured_relations():
    md = (
        "# 标题\n\n## 案例事实摘要\n\n事实\n\n## 分析框架说明\n\nx\n\n"
        "## 三元结构分析正文\n\ny\n\n## 结论\n\nz\n"
    )
    repaired, contract = validate_and_repair(md, "case")
    assert contract["diagram_synthetic"] is False
    assert contract["diagram_ok"] is False
    assert "```DIAGRAM" not in repaired
    assert contract["degrade"] is True


def test_invalid_diagram_json_is_not_replaced_with_a_placeholder():
    md = (
        "# 标题\n\n```DIAGRAM\n{not valid json\n```\n\n"
        "## 案例事实摘要\n\nx\n\n## 分析框架说明\n\nx\n\n"
        "## 三元结构分析正文\n\nx\n\n## 结论\n\nx\n"
    )
    repaired, contract = validate_and_repair(md, "case")
    assert contract["diagram_synthetic"] is False
    assert contract["diagram_ok"] is False
    assert "利益关系图（占位）" not in repaired


def test_missing_sections_are_reported_without_placeholder_patch():
    md = (
        "# 标题\n\n```DIAGRAM\n"
        '{"viz":"network","title":"t","nodes":[{"id":"a","label":"A","type":"actor"}],"edges":[]}\n```\n'
    )
    repaired, contract = validate_and_repair(md, "case")
    assert len(contract["missing_sections"]) > 0
    assert contract["repaired"] is True  # 仅补版权行
    for s in REQUIRED_SECTIONS["case"]:
        assert f"## {s}" not in repaired, f"缺失章节不应被伪造：{s}"
    assert "已补占位" not in repaired


def test_degrade_when_synthetic_and_missing_sections():
    md = "# 标题\n\n只有正文，没有利益关系图，也没有必要章节。\n"
    repaired, contract = validate_and_repair(md, "case")
    assert contract["diagram_synthetic"] is False
    assert len(contract["missing_sections"]) > 0
    assert contract["degrade"] is True


def test_policy_required_sections():
    req = REQUIRED_SECTIONS["policy"]
    assert "独立事实摘要" in req
    assert "结论与推导" in req
    assert "案例事实摘要" not in req


def test_combo_missing_sentinel_is_type_mismatch():
    """组合模式缺哨兵（连 2 类都没有）→ type_mismatch。"""
    from app.prompt_builder import SENTINEL_SECTIONS

    # 构造一段没有任何哨兵章节的纯正文（含必要章节的 case 骨架）
    md = (
        "# 组合测试\n\n## 案例事实摘要\n\n事实\n\n## 分析框架说明\n\nx\n\n"
        "## 三元结构分析正文\n\ny\n\n## 结论\n\nz\n\n"
        "## 附录\n\n来源\n"
    )
    repaired, contract = validate_and_repair(md, "combo")
    assert contract["type_mismatch"] is True
    assert any("组合模式类型一致性缺失" in e for e in contract["errors"])


def test_org_missing_sentinel_is_type_mismatch():
    """组织诊断缺哨兵章节 → type_mismatch，且不静默通过。"""
    md = (
        "# 组织测试\n\n## 组织画像\n\n内部结构\n\n## 结论\n\n总结\n"
    )
    repaired, contract = validate_and_repair(md, "org")
    assert contract["type_mismatch"] is True
    assert any("类型一致性缺失" in e for e in contract["errors"])


def test_org_with_all_sentinels_passes():
    """组织诊断含全部哨兵 → 不判 type_mismatch（回归：缺哨兵才算）"""
    from app.prompt_builder import SENTINEL_SECTIONS

    body = ["# 组织测试"]
    for s in SENTINEL_SECTIONS.get("org", []):
        body.append(f"## {s}\n\n内容占位")
    body.append("## 结论\n\n总结")
    repaired, contract = validate_and_repair("\n\n".join(body), "org")
    assert contract["type_mismatch"] is False, contract["errors"]


def test_numbered_section_prefix_not_counted_as_missing():
    """回归：带中文编号前缀的必要章节（「## 一、组织画像」）不应被误判缺失。"""
    md = (
        "# 编号前缀测试\n\n## 一、案例事实摘要\n\n事实\n\n## 二、分析框架说明\n\nx\n\n"
        "## 三、三元结构分析正文\n\ny\n\n## 四、结论\n\nz\n"
    )
    repaired, contract = validate_and_repair(md, "case")
    assert contract["missing_sections"] == [], contract["missing_sections"]
