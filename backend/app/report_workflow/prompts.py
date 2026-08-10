from __future__ import annotations

import json

from app.report_workflow.models import (
    EvidenceCard,
    FoundationResult,
    OutlineSection,
    ReportSpec,
    ScopeResult,
)


BASE_RULES = """你是三元结构理论报告工作流中的一个受限写作步骤。
只完成当前步骤，不越级生成整份报告，不虚构事实、主体、关系或来源。
事实与推断必须分开；正式语气保持价值中立。
案例先行，概念只用于解释事实，单篇核心概念不超过三个。

【写作风格铁律——逐条遵守】
1. 禁万能套话：不得用"由此可见、综上所述、值得深思、具有重要意义、在这一背景下、不难看出"等空泛过渡。
2. 禁工整对仗：不追求每节字数均衡、结构对称的机械美感；段落长短随内容自然起伏。
3. 禁分层列举腔：不得用"第一层/第二层""首先/其次/最后""一方面/另一方面""其一/其二"等机械编号铺排；改为从事实出发的叙事推进，确需分点时用自然语序。
4. 概念融入语境：理论概念（生存/繁衍/逆反/定义权/解释权等）只在解释具体事实时点出，可括号简短释义；严禁"本案例涉及XX概念""下面分析XX维度"式生硬引入或当小标题。
5. 行业实景语言：用具体替代抽象，引用真实来源名称与可点击链接，不用"综合公开信息"等笼统来源。
6. 结论有锋芒：判断句直接、不骑墙；结尾用一句有力判断收束，不写"需要持续观察"式免责尾巴。
7. 句式自然化：长短句混排，允许一段只有一个判断句；禁止全文均匀分段、每节等量。

【严禁向读者暴露内部标记】
正文中绝对不得出现 EVD-xxx、FOUNDATION、大写下划线分隔标签（如 EVIDENCE_BEGIN）或任何 JSON 结构；这些是内部分析底稿标记，读者不应看到。引用事实时只说真实来源名称（如"据新华社报道"），并在附录保留可点击链接。"""


def _json(value) -> str:
    if hasattr(value, "model_dump"):
        value = value.model_dump()
    return json.dumps(value, ensure_ascii=False, indent=2)


def scope_prompts(input_text: str, title: str, spec: ReportSpec) -> tuple[str, str]:
    system = BASE_RULES + "\n\nSTAGE:SCOPE\n仅返回一个 JSON 对象。"
    user = f"""TITLE:{title}
ANALYSIS_TYPE:{spec.analysis_type}
INPUT_BEGIN
{input_text}
INPUT_END

返回字段：question、object、time_range、evidence_boundary、analysis_type。"""
    return system, user


def evidence_prompts(
    input_text: str,
    materials,
    scope: ScopeResult,
) -> tuple[str, str]:
    system = BASE_RULES + "\n\nSTAGE:EVIDENCE\n仅返回 JSON 数组。"
    user = f"""SCOPE_BEGIN
{_json(scope)}
SCOPE_END
USER_INPUT_BEGIN
{input_text}
USER_INPUT_END
MATERIALS_BEGIN
{_json(materials)}
MATERIALS_END

整理证据卡片。每张卡片包含 id、claim、source_name、source_url、
fact_or_inference（fact/inference）和 confidence（high/medium/low）。
不要整段复制材料；每张卡片只保留一个可核验事实或一个明确标记的推断。

硬约束（违反将导致报告被拒绝）：
- source_url 必须取自 MATERIALS.sources 中已存在的真实链接，不得虚构、拼凑或猜测任何 URL。
- claim 必须能在对应来源原文中找到依据；不得编造来源名或事实。
- 若 MATERIALS.sources 为空，或材料中无可提取的可核验事实，直接返回空数组 []。
- 不得使用"综合公开信息""据媒体报道"等无法溯源的笼统来源名。"""
    return system, user


def foundation_prompts(
    scope: ScopeResult,
    evidence: list[EvidenceCard],
) -> tuple[str, str]:
    system = BASE_RULES + "\n\nSTAGE:FOUNDATION\n仅返回一个 JSON 对象。"
    user = f"""SCOPE_BEGIN
{_json(scope)}
SCOPE_END
EVIDENCE_BEGIN
{_json([item.model_dump() for item in evidence])}
EVIDENCE_END

生成内部分析底稿，字段为 actors、interests、relations、core_proposition、evidence_ids。
主体必须具体；关系和核心命题必须能回指 evidence_ids。
注意：本底稿及 evidence_ids 仅供后续步骤内部引用，不得原样写入最终正文。"""
    return system, user


def outline_prompts(
    title: str,
    spec: ReportSpec,
    foundation: FoundationResult,
    evidence: list[EvidenceCard],
) -> tuple[str, str]:
    system = BASE_RULES + "\n\nSTAGE:OUTLINE\n仅返回一个 JSON 对象。"
    combo_rule = (
        "组合报告必须从 required=false 的模式章节中选择至少两种不同分析模式；"
        "不要为了凑数选择与证据无关的章节。"
        if spec.analysis_type == "combo"
        else ""
    )
    user = f"""TITLE:{title}
SPEC_BEGIN
{_json(spec.model_dump())}
SPEC_END
FOUNDATION_BEGIN
{_json(foundation)}
FOUNDATION_END
EVIDENCE_INDEX_BEGIN
{_json([{"id": item.id, "claim": item.claim} for item in evidence])}
EVIDENCE_INDEX_END

返回 title 和 sections。sections 必须逐项对应规格中的全部必要章节。
{combo_rule}
每项包含 id、title、purpose、evidence_ids、key_question。"""
    return system, user


def section_prompts(
    section: OutlineSection,
    evidence: list[EvidenceCard],
    foundation: FoundationResult,
) -> tuple[str, str]:
    system = BASE_RULES + "\n\nSTAGE:SECTION\n只写当前一节 Markdown。"
    user = f"""SECTION_ID:{section.id}
SECTION_TITLE:{section.title}
SECTION_PURPOSE:{section.purpose}
KEY_QUESTION:{section.key_question}
FOUNDATION_BEGIN
{_json(foundation)}
FOUNDATION_END
EVIDENCE_BEGIN
{_json([item.model_dump() for item in evidence])}
EVIDENCE_END

以“## {section.title}”开头。引用事实时只说真实来源名称（如“据新华社报道”），
在正文内自然带出，不要输出 EVD-xxx、FOUNDATION 等内部编号或大写下划线标签。
推断性内容直接在正文标注置信度（如“这一判断目前属于中等置信度”），不要另起免责段落。
不要输出其他章节，不要猜测证据卡片之外的事实。"""
    return system, user


def edit_prompts(draft: str, spec: ReportSpec) -> tuple[str, str]:
    system = BASE_RULES + "\n\nSTAGE:EDIT\n返回统稿后的完整 Markdown。"
    user = f"""REQUIRED_SECTIONS:{'、'.join(s.title for s in spec.sections if s.required)}
DRAFT_BEGIN
{draft}
DRAFT_END

只做统稿：消除重复、素材搬运、前后矛盾和机械清单腔；把"首先/其次/最后""第一/第二/第三"
"一方面/另一方面"式分层列举改写为从事实出发的叙事推进；删除正文中任何 EVD-xxx、FOUNDATION、
大写下划线标签或 JSON 结构；保留证据边界、章节标题、来源链接和已有判断。
不要增加新事实，不要输出 DIAGRAM。"""
    return system, user


def diagram_prompts(
    foundation: FoundationResult,
    evidence: list[EvidenceCard],
    spec: ReportSpec,
) -> tuple[str, str]:
    system = BASE_RULES + "\n\nSTAGE:DIAGRAM\n仅返回一个合法 JSON 对象。"
    user = f"""ALLOWED_VIZ:{','.join(spec.diagram_viz)}
FOUNDATION_BEGIN
{_json(foundation)}
FOUNDATION_END
EVIDENCE_INDEX_BEGIN
{_json([{"id": item.id, "claim": item.claim} for item in evidence])}
EVIDENCE_INDEX_END

返回 viz、title、nodes、edges。节点只使用底稿中的具体主体或利益，
边只使用底稿中已有关系。节点 type 使用 actor/material/security/political/
identity_culture/institutional_future/public；边 type 使用 economic/power/cultural/legal。"""
    return system, user


def repair_prompts(markdown: str, errors: list[str]) -> tuple[str, str]:
    system = BASE_RULES + "\n\nSTAGE:REPAIR\n返回修复后的完整 Markdown。"
    user = f"""ERRORS_BEGIN
{_json(errors)}
ERRORS_END
REPORT_BEGIN
{markdown}
REPORT_END

只修复列明的交付错误，不添加新事实，不删除可点击来源。"""
    return system, user
