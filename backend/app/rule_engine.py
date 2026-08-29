"""内置规则引擎 —— 不依赖任何外部 LLM，纯本地按「三元结构理论」生成分析报告。

设计目标（回答用户核心疑问：程序能不能自己分析？能。）
- 输入：结构化要素（主体 / 六类利益 / 事件冲突 / 主体间关系）。
- 输出：合法 Markdown（含 ```DIAGRAM 利益关系图），可被 engine.parser + viz_network 消费。
- 知识底座：固化 theory_config.json 的六类利益 key_question、概念池、转化路径、动力机制、DIAGRAM 类型。
- 不调用任何模型、不发任何网络请求，离线、零成本、理论保真。

与 LLM 路径的关系：本引擎是「默认模式」（mode="rule"），LLM 作为可选的「每用户插件」
（mode="llm"，由用户在设置页填自己的 key）。两者产出同样的 Markdown 契约，下游渲染一致。
"""
from __future__ import annotations

import re

from pydantic import BaseModel

COPYRIGHT = "分析框架：三元结构理论 © 2026, CC BY-NC-SA 4.0，国作登字-2026-A-00048134"

# ---------------------------------------------------------------------------
# 固化知识底座（取自 theory_config.json v6.1，单一真相源，避免运行时依赖引擎目录）
# ---------------------------------------------------------------------------

# 六类利益 -> (中文名, 关键问题, 推荐概念 id 列表)
INTEREST_KB: dict[str, dict] = {
    "material": {
        "name": "物质利益",
        "question": "谁控制「抓—运—分—护—续」链条的哪个节点？谁卡住了瓶颈？",
        "concepts": ["cost_benefit", "compensation", "survival_three_dimensions"],
    },
    "security": {
        "name": "安全利益",
        "question": "安全措施是真实防御还是利益转移的掩护？约束了谁、保护了谁？",
        "concepts": ["cost_benefit", "three_survival_boundaries"],
    },
    "political": {
        "name": "政治利益",
        "question": "谁掌握水渠（资源分配渠道）？制度优势是否已路径依赖？",
        "concepts": ["interest_conversion_paths", "narrative_battlefield", "interest_flow"],
    },
    "identity_culture": {
        "name": "身份与文化利益",
        "question": "身份认同如何被激活为集体行动？符号如何成为资本？",
        "concepts": ["narrative_battlefield", "five_types"],
    },
    "institutional_future": {
        "name": "制度性与未来利益",
        "question": "当前制度选择将在多远未来显现影响？后来者有无翻盘空间？",
        "concepts": ["four_carriers", "three_survival_boundaries"],
    },
    "public": {
        "name": "公共利益",
        "question": "谁在定义「公共利益」和「违反公共利益」？叙事边界如何被争夺？",
        "concepts": ["narrative_battlefield", "four_historical_dynamics"],
    },
}

# 概念 id -> (中文名, oneliner, 典型用法)
CONCEPT_KB: dict[str, tuple] = {
    "cost_benefit": ("成本-收益核算", "投入大于回报的持续失衡", "谁在一直亏、亏什么、亏了多久"),
    "compensation": ("代偿", "用A维度的过度付出来弥补B维度的亏空", "明知不对却停不下来的行为"),
    "survival_three_dimensions": ("物质/社会/精神三维度", "生存不止温饱，还有身份和意义", "个体或群体在哪一层'活不下去'"),
    "three_survival_boundaries": ("三存续边界", "传递能撑多久", "传统为何断裂、制度为何僵化"),
    "interest_conversion_paths": ("利益转化路径", "政治权力→经济收益→文化影响力……", "A如何变成B"),
    "narrative_battlefield": ("叙事战场", "谁控制了'真相定义权'", "信息操纵、舆论引导、选择性公开"),
    "interest_flow": ("利益动线", "经济/权力/文化/法律四路径追踪", "资源从哪来、流向谁、谁卡住"),
    "five_types": ("五类型（主动/被动/自发/协从/主导）", "谁在反、怎么反", "个体觉醒 vs 群体裹挟"),
    "four_carriers": ("四载体", "生物/文化/制度/技术四种传递载体", "哪种载体在起作用、哪种失效"),
    "four_historical_dynamics": ("四大历史动力机制", "激励-约束/嵌入-制度化/合法化-叙事化/连锁-外溢", "短期如何变长期、局部如何扩散"),
}

# 利益转化路径（用于正文编织）
CONVERSION_PATHS = [
    "政治权力→经济收益",
    "经济收益→文化影响力",
    "文化影响力→政治权力",
    "经济收益→安全利益",
    "制度优势→未来利益",
]

# DIAGRAM 合法边类型
EDGE_TYPES = {"economic", "power", "cultural", "legal"}


# ---------------------------------------------------------------------------
# 结构化输入契约
# ---------------------------------------------------------------------------

class ActorIn(BaseModel):
    name: str
    interest_types: list[str] = []        # 六类利益 id 列表，如 ["material","political"]
    stance: str = ""                      # 立场 / 角色描述（可选）
    interest_strength: dict[str, str] = {}  # 主体利益配置：interest_id -> 强/中/弱


class RelationIn(BaseModel):
    source: str                      # 主体名（与 ActorIn.name 对应）
    target: str                      # 主体名
    label: str = ""
    type: str = "economic"           # economic|power|cultural|legal


class EvidenceItem(BaseModel):
    content: str = ""                # 证据 / 事实描述
    source: str = ""                 # 来源（文件 / 链接 / 口述，可选）


class ConflictPoint(BaseModel):
    between: str = ""                # 冲突方（如「业主 vs 物业」，可选）
    point: str = ""                  # 冲突点描述


class Recommendation(BaseModel):
    target: str = ""                 # 建议对象（如「物业」/「监管方」，可选）
    action: str = ""                 # 建议动作
    rationale: str = ""              # 理由（可选）


class StructuredInput(BaseModel):
    title: str = ""
    analysis_type: str = "case"      # case | policy
    actors: list[ActorIn] = []
    event: str = ""                  # 事件 / 冲突描述
    relations: list[RelationIn] = []
    core_tension: str = ""           # 可选：手动指定核心张力
    core_proposition: str = ""       # 可选：手动指定核心命题
    concepts: list[str] = []         # 可选：手动指定概念 id（≤4）
    # —— 分析质量增强字段（2026-07-13 新增）——
    evidence: list[EvidenceItem] = []        # 证据与依据
    confidence: str = ""                    # 置信度（高/中/低，可选）
    confidence_note: str = ""               # 置信度说明（可选）
    conflict_points: list[ConflictPoint] = []  # 核心冲突点
    recommendations: list[Recommendation] = []  # 行动建议


class StructuredInputValidation(BaseModel):
    valid: bool
    missing_fields: list[str]


# ---------------------------------------------------------------------------
# 工具
# ---------------------------------------------------------------------------

def _slug_actor(idx: int) -> str:
    return f"a{idx}"


def _pick_concepts(structured: StructuredInput) -> list[str]:
    """选 ≤3 个概念（特殊 ≥5 类利益则 ≤4）。手动指定优先。"""
    if structured.concepts:
        return structured.concepts[:4]
    ids: list[str] = []
    for a in structured.actors:
        for it in a.interest_types:
            kb = INTEREST_KB.get(it)
            if not kb:
                continue
            for cid in kb["concepts"]:
                if cid not in ids:
                    ids.append(cid)
    distinct_interests = {
        it for a in structured.actors for it in a.interest_types if it in INTEREST_KB
    }
    cap = 4 if len(distinct_interests) >= 5 else 3
    return ids[:cap]


def _dominant_interest(actor: ActorIn) -> str:
    for it in actor.interest_types:
        if it in INTEREST_KB:
            return it
    return "actor"


def _build_diagram(structured: StructuredInput) -> dict:
    """由 actors + relations 生成 DIAGRAM JSON。"""
    nodes = []
    name_to_id: dict[str, str] = {}
    for i, a in enumerate(structured.actors):
        nid = _slug_actor(i)
        name_to_id[a.name] = nid
        dom = _dominant_interest(a)
        nodes.append({
            "id": nid,
            "label": a.name,
            "type": dom if dom != "actor" else "actor",
        })
    # 事件节点
    if structured.event.strip():
        nodes.append({"id": "evt", "label": "事件", "type": "event"})
        name_to_id["__event__"] = "evt"

    edges = []
    for r in structured.relations:
        s = name_to_id.get(r.source) or name_to_id.get("__event__")
        t = name_to_id.get(r.target) or name_to_id.get("__event__")
        if not s or not t or s == t:
            continue
        etype = r.type if r.type in EDGE_TYPES else "economic"
        edges.append({
            "source": s,
            "target": t,
            "label": r.label or "流向",
            "type": etype,
        })
    # 无任何关系时：用主体主导利益把各主体连到事件节点，保证图非空
    if not edges and structured.event.strip():
        for a in structured.actors:
            dom = _dominant_interest(a)
            etype = {
                "material": "economic",
                "security": "legal",
                "political": "power",
                "identity_culture": "cultural",
                "institutional_future": "legal",
                "public": "cultural",
            }.get(dom, "economic")
            edges.append({
                "source": name_to_id[a.name],
                "target": "evt",
                "label": INTEREST_KB.get(dom, {}).get("name", "利益"),
                "type": etype,
            })
    return {
        "viz": "network",
        "title": "利益关系图",
        "nodes": nodes,
        "edges": edges,
    }


def _diag_json(structured: StructuredInput) -> str:
    """生成 DIAGRAM 代码块（JSON 原文，不转义，供 parser 直接 json.loads）。"""
    import json

    return "```DIAGRAM\n" + json.dumps(_build_diagram(structured), ensure_ascii=False) + "\n```\n"


# ---------------------------------------------------------------------------
# 分析质量增强字段的格式化（空值优雅降级，不虚构）
# ---------------------------------------------------------------------------

def _fmt_evidence(si: StructuredInput) -> str:
    lines = []
    for i, e in enumerate(si.evidence, 1):
        content = e.content.strip()
        if not content:
            continue
        src = f"（来源：{e.source.strip()}）" if e.source.strip() else ""
        lines.append(f"{i}. {content}{src}")
    return "\n".join(lines)


def _fmt_confidence(si: StructuredInput) -> str:
    c = (si.confidence or "").strip()
    if not c:
        return "中（依据结构化输入的完整度与证据充分性判断）"
    note = f"——{si.confidence_note.strip()}" if si.confidence_note.strip() else ""
    return f"{c}{note}"


def _fmt_conflicts(si: StructuredInput) -> str:
    pts = [c for c in si.conflict_points if (c.point or "").strip()]
    lines = []
    seen = set()
    for c in pts:
        parties = re.split(r"\s*(?:vs|VS|对|与|—|-)\s*", c.between.strip(), maxsplit=1)
        if len(parties) != 2:
            continue
        key = (parties[0], parties[1], c.point.strip())
        if key in seen:
            continue
        seen.add(key)
        lines.append(
            f"【{parties[0]}】对【{parties[1]}】在【{c.point.strip()}】上的张力："
            f"双方对收益取得、成本承担和执行边界的预期不一致。"
        )
    for relation in si.relations:
        interest = relation.label.strip() or "关系边界"
        key = (relation.source, relation.target, interest)
        if key in seen:
            continue
        seen.add(key)
        lines.append(
            f"【{relation.source}】对【{relation.target}】在【{interest}】上的张力："
            f"这条关系同时决定资源如何流动以及相应成本由谁承担。"
        )
        if len(lines) >= 5:
            break
    if si.relations:
        relation = si.relations[0]
        supplements = [
            (
                relation.source,
                relation.target,
                "收益与成本分配",
                "双方对关系产生的收益归属和执行成本承担存在不同预期。",
            ),
            (
                relation.target,
                relation.source,
                "执行与反馈节奏",
                "一方要求稳定执行，另一方更关心规则能否及时回应现实变化。",
            ),
        ]
        for source, target, interest, explanation in supplements:
            if len(lines) >= 3:
                break
            key = (source, target, interest)
            if key in seen:
                continue
            seen.add(key)
            lines.append(
                f"【{source}】对【{target}】在【{interest}】上的张力：{explanation}"
            )
    return "\n".join(f"{i}. {line}" for i, line in enumerate(lines[:5], 1))


def _fmt_reco(si: StructuredInput) -> str:
    recs = [r for r in si.recommendations if (r.action or "").strip()]
    grouped: dict[str, list[Recommendation]] = {}
    for recommendation in recs:
        grouped.setdefault(recommendation.target.strip(), []).append(recommendation)
    blocks = []
    for target, items in grouped.items():
        lines = [f"### 对{target}"]
        for index, recommendation in enumerate(items, 1):
            rationale = (
                f"（约束：{recommendation.rationale.strip()}）"
                if recommendation.rationale.strip()
                else "（约束：以已录入证据和现有职责边界为准）"
            )
            lines.append(f"{index}. {recommendation.action.strip()}{rationale}")
        blocks.append("\n\n".join(lines))
    return "\n\n".join(blocks)


def _fmt_actor_table(si: StructuredInput) -> str:
    rows = ["| 主体 | 角色 | 核心利益 | 成本 |", "|---|---|---|---|"]
    for actor in si.actors:
        interests = [
            INTEREST_KB[item]["name"]
            for item in actor.interest_types
            if item in INTEREST_KB
        ]
        role = actor.stance.strip() or "事件参与者"
        core = "、".join(interests) or "关系中的资源与行动空间"
        rows.append(f"| {actor.name} | {role} | {core} | 执行、协调与机会成本 |")
    return "\n".join(rows)


def _fmt_interest_flow(si: StructuredInput) -> str:
    return "\n".join(
        f"{index}. {relation.source}通过“{relation.label or '既有关系'}”影响"
        f"{relation.target}，由此把规则、资源或行动压力转化为对方的现实成本。"
        for index, relation in enumerate(si.relations, 1)
    )


def _fmt_endgame(si: StructuredInput) -> str:
    relation = si.relations[0]
    label = relation.label.strip() or "现有关系"
    return "\n".join(
        [
            f"1. {label}的执行口径趋于公开（触发条件：争议持续进入公开反馈；影响：{relation.source}的解释成本上升）。",
            f"2. 双方的成本边界被进一步细化（触发条件：{relation.target}能够提供可核验材料；影响：协商从立场冲突转向成本核算）。",
            f"3. 反馈机制逐步常态化（触发条件：同类问题重复出现；影响：{relation.source}与{relation.target}的重复冲突成本下降）。",
        ]
    )


def validate_structured_input(
    value: StructuredInput | dict,
) -> StructuredInputValidation:
    """Validate whether structured data can support a formal report."""
    try:
        si = (
            value
            if isinstance(value, StructuredInput)
            else StructuredInput.model_validate(value)
        )
    except Exception:
        return StructuredInputValidation(
            valid=False,
            missing_fields=["结构化字段格式"],
        )

    missing = []
    if not si.event.strip():
        missing.append("事件事实")
    if len(si.actors) < 2:
        missing.append("至少 2 个利益主体")
    if not si.relations:
        missing.append("主体关系")
    if not [e for e in si.evidence if e.content.strip() and e.source.strip()]:
        missing.append("带来源的证据")
    if not [r for r in si.recommendations if r.target.strip() and r.action.strip()]:
        missing.append("按主体填写的行动建议")
    return StructuredInputValidation(valid=not missing, missing_fields=missing)


def _validate_formal_input(si: StructuredInput) -> None:
    """规则引擎不猜事实；输入不足时明确拒绝生成伪完整报告。"""
    validation = validate_structured_input(si)
    if not validation.valid:
        raise ValueError(
            "规则引擎无法仅凭题目生成正式报告；请补齐"
            + "、".join(validation.missing_fields)
            + "，或改用已配置的语言模型模式。"
        )


def _fmt_interest_config(a: ActorIn) -> str:
    """主体利益配置：列出每个已勾选利益及其强度。"""
    if not a.interest_strength:
        return ""
    parts = []
    for it, lv in a.interest_strength.items():
        nm = INTEREST_KB.get(it, {}).get("name", it)
        lv = (lv or "").strip() or "中"
        parts.append(f"{nm}（{lv}）")
    if not parts:
        return ""
    return "其利益配置为：" + "、".join(parts) + "。"


# ---------------------------------------------------------------------------
# 报告生成
# ---------------------------------------------------------------------------

def generate(structured: StructuredInput) -> str:
    _validate_formal_input(structured)
    title = structured.title or "未命名分析"
    atype = structured.analysis_type or "case"
    concepts = _pick_concepts(structured)
    concept_rows = ""
    for cid in concepts:
        name, oneliner, usage = CONCEPT_KB.get(cid, (cid, "", ""))
        concept_rows += f"| 观察到的张力模式 | **{name}** | {oneliner} | {usage} |\n"

    # 核心张力 / 命题
    if structured.core_tension:
        tension = structured.core_tension
    elif len(structured.actors) >= 2:
        a0, a1 = structured.actors[0].name, structured.actors[1].name
        tension = f"在{a0}与{a1}之间，最说不通的是：明明都声称在为同一件事负责，却各自把代价推给对方。"
    elif structured.actors:
        tension = f"{structured.actors[0].name}看似在争取自身利益，实则卡在了一个自己也说不清的结构性瓶颈上。"
    else:
        tension = "表面上是单一事件，根子上是一组未被言明的利益在暗中重新分配。"

    if structured.core_proposition:
        proposition = structured.core_proposition
    else:
        ilist = []
        for a in structured.actors:
            for it in a.interest_types:
                if it in INTEREST_KB:
                    ilist.append(INTEREST_KB[it]["name"])
        ilist = list(dict.fromkeys(ilist))
        if ilist:
            proposition = f"本案的本质，是{ '、'.join(ilist) }在既有规则下的重新定价。"
        else:
            proposition = "本案的本质，是一组利益在既有规则下的重新定价。"

    # 事实摘要
    fact = structured.event.strip()

    # 分析质量增强块
    evidence_block = _fmt_evidence(structured)
    confidence_line = _fmt_confidence(structured)
    conflict_block = _fmt_conflicts(structured)
    reco_block = _fmt_reco(structured)

    # 正文分节：每个主体一节
    body_sections = ""
    for i, a in enumerate(structured.actors, start=1):
        ilist = [INTEREST_KB[it]["name"] for it in a.interest_types if it in INTEREST_KB]
        ilist = list(dict.fromkeys(ilist))
        if ilist:
            interest_clause = f"其关切集中在{ '、'.join(ilist) }"
            lens = INTEREST_KB[_dominant_interest(a)]["question"]
            section_title = f"第{i}节：{a.name}把{ilist[0]}押上桌"
        else:
            interest_clause = "其主要关切需要结合已录入的主体关系判断"
            lens = "谁在争什么、争来做什么"
            section_title = f"第{i}节：{a.name}的行动逻辑"
        stance_clause = f"，定位为{a.stance}" if a.stance else ""
        config_clause = _fmt_interest_config(a)
        cname = CONCEPT_KB[concepts[0]][0] if concepts else "利益动线"
        body_sections += (
            f"### {section_title}\n\n"
            f"{a.name}{stance_clause}，{interest_clause}。"
            f"{config_clause}\n"
            f"按三元结构理论的视角，要回答的关键问题是：{lens}\n"
            f"把 **{cname}** 作为理解工具看，{a.name}的行为并非孤立的情绪反应，"
            f"而是某一维度上持续失衡后的必然外显——它先维持、再代偿、最后固化。\n\n"
            f"→ 子结论：{a.name}的真正约束不在对手，而在它自身利益链上那个被卡住的节点。\n\n"
        )
        # 插入 DIAGRAM（每节后附，便于前端抽取；引擎取首个即可）
        if i == 1:
            body_sections += (
                "图 1 展示各主体之间的资源、权力、文化与规则关系。\n\n"
                + _diag_json(structured)
                + "\n"
            )

    # 结论
    actor_names = "、".join(a.name for a in structured.actors) or "相关各方"
    confluence = (
        f"把{actor_names}的判断汇流起来看：他们并非在争一个静态的「对错」，"
        f"而是在争夺同一套规则下「谁的利益先被计价、谁的后手更久」。"
    )
    core_judgment = (
        f"{proposition}——而能改变结局的，不是某一方多大声量，"
        f"而是规则制定权是否仍在流动。"
    )
    golden = "当利益被当作资源来分，真正的变量从来不是资源本身，而是谁还能定义「该怎么分」。"
    actor_table = _fmt_actor_table(structured)
    interest_flow = _fmt_interest_flow(structured)
    endgame = _fmt_endgame(structured)

    if atype == "policy":
        return _policy_report(structured, title, fact, tension, proposition,
                               concept_rows, body_sections, confluence,
                               core_judgment, golden, evidence_block,
                               confidence_line, conflict_block, reco_block,
                               actor_table, interest_flow, endgame)
    return _case_report(title, fact, tension, proposition, concept_rows,
                        body_sections, confluence, core_judgment, golden,
                        evidence_block, confidence_line, conflict_block, reco_block,
                        actor_table, interest_flow, endgame)


def _case_report(title, fact, tension, proposition, concept_rows, body_sections,
                 confluence, core_judgment, golden, evidence_block, confidence_line,
                 conflict_block, reco_block, actor_table, interest_flow, endgame) -> str:
    return f"""# {title}

## 情况概述

本报告围绕“{fact}”展开，分析范围聚焦已录入主体之间的利益、成本与关系变化。核心问题不是给单一主体定性，而是解释既有规则如何分配行动空间。

从结构上看，{proposition}。这意味着事件的后续变化取决于关系边界、证据公开和反馈机制能否同步调整。

## 案例事实摘要

1. {fact}（来源：结构化事件记录）
2. 已确认的主体关系构成本报告的分析边界。（来源：结构化关系记录）
3. 已录入证据与建议用于约束推断范围。（来源：结构化证据记录）

## 分析框架说明

> 核心张力：{tension}

**核心命题：{proposition}**

| 观察到的模式 | 选用的概念 | 概念如何解释 | 分析问题 |
|---|---|---|---|
{concept_rows}

**置信度**：{confidence_line}

## 利益主体识别

{actor_table}

## 利益动线与转化

{interest_flow}

## 核心冲突点

{conflict_block}

## 制度与叙事作用

正式规则决定各主体能够采取什么行动，公开叙事则决定这些行动如何被外部理解。两者共同影响收益、成本与责任的最终归属。

## 三元结构分析正文

{body_sections}

## 结论

### 汇流段

{confluence}

### 核心判断

{core_judgment}

### 博弈终局预判

{endgame}

> {golden}

## 行动建议

{reco_block}

## 附录

{evidence_block}

{COPYRIGHT}
"""


def _policy_report(structured, title, fact, tension, proposition, concept_rows,
                   body_sections, confluence, core_judgment, golden, evidence_block,
                   confidence_line, conflict_block, reco_block, actor_table,
                   interest_flow, endgame) -> str:
    # 政策对象图谱：把主体按利益归类到四分法（简化）
    issuers, beneficiaries, losers, unaffected = [], [], [], []
    for a in structured.actors:
        its = set(a.interest_types)
        if "political" in its or "institutional_future" in its:
            issuers.append(a.name)
        if "material" in its or "public" in its:
            beneficiaries.append(a.name)
        if "security" in its or "identity_culture" in its:
            losers.append(a.name)
        if not its:
            unaffected.append(a.name)
    portrait = ""
    for label, grp in [("政策发布方", issuers), ("既得利益群体", beneficiaries),
                       ("利益受损群体", losers), ("不相关群体", unaffected)]:
        if grp:
            portrait += f"- **{label}**：{'、'.join(grp)}\n"
    if not portrait:
        portrait = "\n".join(
            f"- **{actor.name}**：按其已录入角色与关系纳入政策影响判断。"
            for actor in structured.actors
        )

    return f"""# {title}

## 情况概述

本报告分析“{fact}”涉及的政策对象、执行关系与成本变化，重点判断政策如何改变不同主体的行动空间。

核心结论是：{proposition}。政策效果因此不能只看文本目标，还要看执行权、承受成本和反馈渠道如何配置。

## 独立事实摘要

1. {fact}（来源：结构化政策记录）
2. 已录入主体关系用于识别政策影响方向。（来源：结构化关系记录）
3. 已录入证据用于限定政策判断边界。（来源：结构化证据记录）

## 分析框架说明

> 核心张力：{tension}

**核心命题：{proposition}**

| 观察到的模式 | 选用的概念 | 概念如何解释 | 分析问题 |
|---|---|---|---|
{concept_rows}

**置信度**：{confidence_line}

## 政策对象图谱

{portrait}

## 政策权重与空间分析

政策权重取决于发布主体的执行能力、受影响主体的承受能力，以及反馈机制是否允许根据现实成本修正执行口径。

## 核心冲突点

{conflict_block}

## 三元结构分析正文

{body_sections}

## 结论与推导

### 汇流段

{confluence}

### 核心判断

{core_judgment}

### 博弈终局预判

{endgame}

> {golden}

## 行动建议

{reco_block}

## 附录/数据溯源

{evidence_block}

{COPYRIGHT}
"""
