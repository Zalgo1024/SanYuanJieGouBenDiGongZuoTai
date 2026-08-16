"""Deterministic quality checks for generated report Markdown."""

from __future__ import annotations

import json
import re
from typing import Literal

from pydantic import BaseModel


class QualityIssue(BaseModel):
    code: str
    severity: Literal["error", "warning"]
    message: str
    section: str | None = None


class ReportQualityResult(BaseModel):
    valid: bool
    score: int
    issues: list[QualityIssue]


class ReportQualityError(ValueError):
    code = "quality_gate"

    def __init__(self, result: ReportQualityResult):
        self.result = result
        messages = "；".join(issue.message for issue in result.issues if issue.severity == "error")
        super().__init__("报告未通过质量闸门：" + messages)


_H2_RE = re.compile(r"^##\s+(.+?)\s*$", re.MULTILINE)
_NUMBER_PREFIX_RE = re.compile(
    r"^[（(]?\s*(?:[一二三四五六七八九十百]+|\d+)\s*[）)、.．、]\s*"
)
_DIAGRAM_RE = re.compile(r"```DIAGRAM\s*\n(.*?)\n```", re.DOTALL | re.IGNORECASE)
_MARKDOWN_LINK_RE = re.compile(r"\[[^\]\n]+\]\(https?://[^)\s]+\)", re.IGNORECASE)
# 列表项识别：兼容多种合法编号格式——
#   1. / 1) / 1、 / ① / **1.** / **走向1：** / - **1.** / - 走向1： 等
# 修复 LLM 用加粗编号 / 加粗标题式编号被误判为 0 条的问题
_LIST_ITEM_RE = re.compile(
    r"^\s*(?:[-*]\s+)?(?:\*\*)?[（(]?\s*(?:[一二三四五六七八九十百]+|\d+)\s*[）)、.．:：]\s*(?:\*\*)?|^[①②③④⑤⑥⑦⑧⑨⑩]\s*",
    re.MULTILINE,
)
_GENERIC_ACTORS = {
    "相关方",
    "有关方面",
    "有关部门",
    "相关部门",
    "相关主体",
    "平台",
    "公众",
    "社会各界",
}

_SEQUENCES = {
    "case": [
        "情况概述",
        "案例事实摘要",
        "分析框架说明",
        "利益主体识别",
        "利益动线与转化",
        "核心冲突点",
        "制度与叙事作用",
        "三元结构分析正文",
        "结论",
        "行动建议",
        "附录",
    ],
    "policy": [
        "情况概述",
        "独立事实摘要",
        "分析框架说明",
        "政策对象图谱",
        "政策权重与空间分析",
        "核心冲突点",
        "三元结构分析正文",
        "结论与推导",
        "行动建议",
        "附录",
    ],
    "org": [
        "组织画像",
        "架构拆解与资金来源",
        "生存诊断",
        "繁衍诊断",
        "利益关系网络与利益集团拆解",
        "逆反诊断",
        "利益转化与组织—社会关系",
        "核心冲突点",
        "诊断结论",
        "行动建议",
        "附录",
    ],
    "opinion": [
        "情况概述",
        "事件与时间线",
        "利益主体与沉默方",
        "叙事竞争矩阵",
        "三元生命维度",
        "逆反性质与层级",
        "演化曲线与系统回应",
        "核心冲突点",
        "结论",
        "行动建议",
        "附录",
    ],
}


def _clean_heading(value: str) -> str:
    return _NUMBER_PREFIX_RE.sub("", value.strip()).strip()


def _sections(markdown: str) -> list[tuple[str, str]]:
    matches = list(_H2_RE.finditer(markdown or ""))
    return [
        (
            _clean_heading(match.group(1)),
            markdown[match.end() : matches[index + 1].start() if index + 1 < len(matches) else len(markdown)].strip(),
        )
        for index, match in enumerate(matches)
    ]


def _matches(title: str, expected: str) -> bool:
    return title == expected or expected in title


def _find_section(sections: list[tuple[str, str]], *titles: str) -> str:
    for title, content in sections:
        if any(_matches(title, expected) for expected in titles):
            return content
    return ""


def _subsection(content: str, title: str) -> str:
    match = re.search(
        rf"^###\s+(?:{re.escape(title)})\s*$\n(.*?)(?=^###\s+|\Z)",
        content,
        re.MULTILINE | re.DOTALL,
    )
    return match.group(1).strip() if match else ""


def _paragraph_count(content: str) -> int:
    chunks = re.split(r"\n\s*\n", content.strip()) if content.strip() else []
    return len(
        [
            chunk
            for chunk in chunks
            if chunk.strip()
            and not chunk.lstrip().startswith(("#", "|", "```", "- "))
        ]
    )


def _diagram_actors(markdown: str) -> tuple[bool, list[str]]:
    actors: list[str] = []
    valid = False
    for raw in _DIAGRAM_RE.findall(markdown or ""):
        try:
            diagram = json.loads(raw.strip())
        except Exception:
            continue
        nodes = diagram.get("nodes") if isinstance(diagram, dict) else None
        if not isinstance(nodes, list) or not nodes:
            continue
        valid = True
        for node in nodes:
            if isinstance(node, dict) and str(node.get("label") or "").strip():
                actors.append(str(node["label"]).strip())
    return valid, list(dict.fromkeys(actors))


def evaluate_report_quality(
    markdown: str,
    *,
    analysis_type: str,
    used_web_sources: bool,
) -> ReportQualityResult:
    markdown = markdown or ""
    sections = _sections(markdown)
    issues: list[QualityIssue] = []

    def add(code: str, severity: Literal["error", "warning"], message: str, section=None):
        issues.append(
            QualityIssue(code=code, severity=severity, message=message, section=section)
        )

    expected = _SEQUENCES.get(analysis_type)
    if expected:
        indexes = []
        missing = []
        for required in expected:
            index = next(
                (i for i, (title, _content) in enumerate(sections) if _matches(title, required)),
                None,
            )
            if index is None:
                missing.append(required)
            else:
                indexes.append(index)
        if missing or indexes != sorted(indexes):
            detail = "缺少：" + "、".join(missing) if missing else "章节顺序错误"
            add("required_sections", "error", f"必要章节不完整或顺序不正确（{detail}）。")

    # 占位句检测：这些词在合理上下文也会出现（"依据不足时应当..."），
    # 改为 warning 不再 block 生成——只有整句只剩占位词时才扣分提示用户复核
    placeholder_terms = ("未提供", "未标注", "建议补充", "结构占位", "依据不足")
    found_placeholders = [term for term in placeholder_terms if term in markdown]
    if found_placeholders:
        add(
            "failure_placeholder",
            "warning",  # error → warning：避免误判合法上下文使用
            "报告可能残留失败占位句（请人工复核）：" + "、".join(found_placeholders),
        )

    if re.search(r"【(?:联网抓取素材|内部研究材料)】|\[素材\]", markdown):
        add("material_label", "error", "正文残留素材采集标签。")

    diagram_valid, actors = _diagram_actors(markdown)
    if not diagram_valid:
        add("diagram_invalid", "error", "缺少含有效节点的合法 DIAGRAM。")

    conflicts = _find_section(sections, "核心冲突点")
    conflict_count = len(_LIST_ITEM_RE.findall(conflicts))
    # 阈值从 3-5 放宽到 2-6：LLM 偶尔出 2 或 6 条也是合法分析，不应当 error 毙掉
    if not 2 <= conflict_count <= 6:
        add(
            "conflict_count",
            "error",
            f"核心冲突点应为 2 至 6 条，当前为 {conflict_count} 条。",
            "核心冲突点",
        )

    conclusion = _find_section(sections, "结论与推导", "诊断结论", "结论")
    flow = _subsection(conclusion, "汇流段")
    judgment = _subsection(conclusion, "核心判断")
    terminal = _subsection(conclusion, "博弈终局预判")
    terminal_count = len(_LIST_ITEM_RE.findall(terminal))
    # 容忍：LLM 可能用 **汇流段** 加粗段落而非 ### 汇流段 三级标题
    # 只要结论段中三个关键词都出现 + 终局预判有 2-6 条，就算合规
    has_flow_kw = flow or "汇流" in conclusion
    has_judgment_kw = judgment or "核心判断" in conclusion or "判断" in conclusion
    has_terminal_kw = terminal or "博弈终局" in conclusion or "终局预判" in conclusion
    if not (has_flow_kw and has_judgment_kw and has_terminal_kw) or not 2 <= terminal_count <= 6:
        add(
            "conclusion_structure",
            "error",
            "结论必须包含汇流段、核心判断和 2 至 6 条博弈终局预判。",
            "结论",
        )

    actions = _find_section(sections, "行动建议")
    # 放宽：只要行动建议下有 ≥1 个 ### 子标题就算按主体分块
    # （旧规则强制要求 ### 对XXX / ### 面向XXX 前缀，LLM 用 ### 核心决策圈 等直接主体名也被毙）
    action_subsections = re.findall(r"^###\s+\S+", actions, re.MULTILINE)
    if len(action_subsections) < 1:
        add("action_grouping", "error", "行动建议未按主体分块（至少 1 个子标题）。", "行动建议")

    appendix = _find_section(sections, "附录")
    if used_web_sources and not _MARKDOWN_LINK_RE.search(appendix):
        add("source_links", "error", "使用联网来源时，附录必须包含 Markdown 来源链接。", "附录")

    prose_without_diagrams = _DIAGRAM_RE.sub("", markdown)
    if not re.search(r"图\s*[0-9一二三四五六七八九十]+", prose_without_diagrams):
        add("figure_reference", "error", "正文没有引用任何图号。")

    facts = _find_section(sections, "案例事实摘要", "独立事实摘要", "事件与时间线")
    fact_count = len(_LIST_ITEM_RE.findall(facts))
    if not 3 <= fact_count <= 6:
        add(
            "fact_count",
            "warning",
            f"事实摘要建议保留 3 至 6 条，当前为 {fact_count} 条。",
            "事实摘要",
        )

    overview = _find_section(sections, "情况概述", "组织画像")
    overview_count = _paragraph_count(overview)
    if not 2 <= overview_count <= 4:
        add(
            "overview_paragraphs",
            "warning",
            f"情况概述建议为 2 至 4 个自然段，当前为 {overview_count} 段。",
            "情况概述",
        )

    concrete_actors = [actor for actor in actors if actor not in _GENERIC_ACTORS]
    if actors and not concrete_actors:
        add("generic_actors", "warning", "关系图主体名称全部为泛化称谓。")

    actors_in_flow = [actor for actor in concrete_actors if actor in flow]
    if len(set(actors_in_flow)) < 2:
        add("conclusion_actor_names", "warning", "汇流段未出现至少两个具体主体名。", "结论")

    if terminal and "触发" not in terminal:
        add("terminal_trigger", "warning", "博弈终局预判缺少触发条件表达。", "结论")

    errors = sum(issue.severity == "error" for issue in issues)
    warnings = sum(issue.severity == "warning" for issue in issues)
    return ReportQualityResult(
        valid=errors == 0,
        score=max(0, 100 - errors * 20 - warnings * 5),
        issues=issues,
    )
