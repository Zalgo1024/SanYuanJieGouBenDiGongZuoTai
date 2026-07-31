"""报告结构快照工具 —— 从规则引擎产出的 Markdown 派生「固定快照」字段。

这些字段完全由输入决定（规则引擎确定性输出），因此可作为回归断言的「金标准」：
结构变了 → 测试失败 → 提醒维护者复核生成逻辑或主动更新快照。
"""
import json
import re

from app.contract import REQUIRED_SECTIONS

DIAGRAM_RE = re.compile(r"```DIAGRAM\s*\n(.*?)\n```", re.DOTALL)
CONCEPT_ROW_RE = re.compile(r"^\|\s*观察到的张力模式\s*\|", re.MULTILINE)


def extract_diagram(markdown: str) -> dict | None:
    m = DIAGRAM_RE.search(markdown)
    if not m:
        return None
    try:
        return json.loads(m.group(1).strip())
    except Exception:  # noqa: BLE001
        return None


def derive_fields(markdown: str, analysis_type: str) -> dict:
    """从 Markdown 派生结构字段（用于与固定快照比对）。"""
    diag = extract_diagram(markdown)
    nodes = len(diag.get("nodes", [])) if diag else 0
    edges = len(diag.get("edges", [])) if diag else 0

    req = REQUIRED_SECTIONS.get(analysis_type, REQUIRED_SECTIONS["case"])
    sections_present = all(f"## {s}" in markdown for s in req)
    concept_count = len(CONCEPT_ROW_RE.findall(markdown))

    return {
        "analysis_type": analysis_type,
        "diagram_node_count": nodes,
        "diagram_edge_count": edges,
        "required_sections": req,
        "required_sections_present": sections_present,
        "concept_count": concept_count,
        "has_copyright": "国作登字" in markdown,
        "has_diagram_block": diag is not None,
        "markdown_length": len(markdown),
    }


def assert_fields_match(actual: dict, expected: dict) -> None:
    """逐字段比对（忽略大段文本，只比结构）。"""
    assert actual["analysis_type"] == expected["analysis_type"]
    assert actual["diagram_node_count"] == expected["diagram_node_count"], (
        f"关系图节点数不符：实际 {actual['diagram_node_count']} 期望 {expected['diagram_node_count']}"
    )
    assert actual["diagram_edge_count"] == expected["diagram_edge_count"], (
        f"关系图边数不符：实际 {actual['diagram_edge_count']} 期望 {expected['diagram_edge_count']}"
    )
    assert actual["required_sections_present"] is True, "必要章节缺失"
    assert actual["required_sections"] == expected["required_sections"]
    assert actual["concept_count"] == expected["concept_count"], (
        f"概念数不符：实际 {actual['concept_count']} 期望 {expected['concept_count']}"
    )
    assert actual["has_copyright"] is True, "缺少版权声明"
    assert actual["has_diagram_block"] is True, "缺少 DIAGRAM 代码块"
    assert actual["markdown_length"] == expected["markdown_length"], (
        f"Markdown 长度变化（生成逻辑可能已改动）：实际 {actual['markdown_length']} "
        f"期望 {expected['markdown_length']}"
    )
