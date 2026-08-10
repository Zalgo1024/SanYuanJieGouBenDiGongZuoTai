from __future__ import annotations

import json
import re

from app.report_quality import QualityIssue, ReportQualityResult
from app.report_workflow.models import ReportSpec


_HEADING_RE = re.compile(r"^##\s+(.+?)\s*$", re.MULTILINE)
_NUMBER_PREFIX_RE = re.compile(
    r"^[（(]?\s*(?:[一二三四五六七八九十百]+|\d+)\s*[）)、.．、]\s*"
)
_DIAGRAM_RE = re.compile(r"```DIAGRAM\s*\n(.*?)\n```", re.DOTALL | re.IGNORECASE)
_PLACEHOLDERS = ("未提供", "未标注", "建议补充", "结构占位", "依据不足")
_SOURCE_LINK_RE = re.compile(r"\[[^\]]+\]\(https?://[^)]+\)")


def _headings(markdown: str) -> list[str]:
    return [
        _NUMBER_PREFIX_RE.sub("", heading.strip()).strip()
        for heading in _HEADING_RE.findall(markdown or "")
    ]


def _valid_diagram(markdown: str) -> bool:
    match = _DIAGRAM_RE.search(markdown or "")
    if not match:
        return False
    try:
        value = json.loads(match.group(1))
    except (TypeError, ValueError):
        return False
    return (
        isinstance(value, dict)
        and isinstance(value.get("nodes"), list)
        and len(value["nodes"]) >= 2
        and isinstance(value.get("edges"), list)
    )


def evaluate_delivery_quality(
    markdown: str,
    *,
    spec: ReportSpec,
    used_web_sources: bool,
) -> ReportQualityResult:
    issues: list[QualityIssue] = []

    def error(code: str, message: str, section: str | None = None) -> None:
        issues.append(
            QualityIssue(code=code, severity="error", message=message, section=section)
        )

    def warning(code: str, message: str, section: str | None = None) -> None:
        issues.append(
            QualityIssue(code=code, severity="warning", message=message, section=section)
        )

    if not (markdown or "").strip():
        error("empty_report", "报告正文为空。")

    headings = _headings(markdown)
    required = [section.title for section in spec.sections if section.required]
    missing = [title for title in required if not any(title in item for item in headings)]
    if missing:
        error("missing_sections", "缺少必要章节：" + "、".join(missing))

    found_placeholders = [item for item in _PLACEHOLDERS if item in (markdown or "")]
    if found_placeholders:
        # These tokens also occur in legitimate evidence-boundary statements
        # (for example, "未标注证据编号的内容属于推断"). Keep them visible for
        # editorial review without rejecting an otherwise deliverable report.
        warning(
            "failure_placeholder",
            "报告包含需复核的占位式措辞：" + "、".join(found_placeholders),
        )

    if used_web_sources and not _SOURCE_LINK_RE.search(markdown or ""):
        error("missing_source_links", "使用了联网材料，但附录没有可点击来源链接。")

    if not _valid_diagram(markdown):
        error("invalid_diagram", "缺少合法的 DIAGRAM 利益关系图。")

    errors = sum(issue.severity == "error" for issue in issues)
    warnings = sum(issue.severity == "warning" for issue in issues)
    return ReportQualityResult(
        valid=errors == 0,
        score=max(0, 100 - errors * 25 - warnings * 5),
        issues=issues,
    )
