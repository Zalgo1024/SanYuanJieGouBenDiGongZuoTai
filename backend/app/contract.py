"""LLM 路径的 Markdown/JSON 契约校验与修复。

问题背景：LLM 可能输出没有 DIAGRAM、或章节乱序/缺失、或 DIAGRAM 不是合法 JSON，
导致前端 json.loads 崩溃、关系图空白、结构崩坏。

本模块在 generator 拿到 LLM 文本后运行：
1. 校验 DIAGRAM 块存在且为合法 JSON、nodes/edges 结构基本正确；
2. 校验必要 ## 章节齐全；
3. 校验版权声明行存在；
4. 只修复不涉及分析判断的格式问题：
   - 缺 DIAGRAM：仅在 structured 已明确给出主体与关系时据实生成；
   - 缺章节或无结构化依据的关系图：只报告错误，不补占位、不猜实体；
   - 缺版权行：补版权声明；
返回 (repaired_md, contract_dict)。contract_dict 透传给前端做「结构校验」徽标。

注意：本模块只做结构修复，不重写 LLM 的分析内容；无法补全的分析性缺失（如逻辑空洞）
由 contract.errors 暴露给前端提示，不做假填充。
"""
from __future__ import annotations

import json
import logging
import re

logger = logging.getLogger(__name__)

DIAGRAM_RE = re.compile(r"```DIAGRAM\s*\n(.*?)\n```", re.DOTALL)
# ## 二级标题行（含中文/数字编号前缀，如「## 一、组织画像」「## 1. 结论」）
_SECTION_HEAD_RE = re.compile(r"^##\s*([^\n]+)$", re.MULTILINE)
# 章节标题编号前缀（中文数字/阿拉伯数字/括号编号）。
# 注意：编号后必须紧跟分隔符（、.．)）等，避免把「三元结构分析正文」这类
# 以中文数字开头的标题误当编号删除（如「三」+ 无分隔符 → 不匹配）。
_NUM_PREFIX_RE = re.compile(r"^[（(]?\s*(?:[一二三四五六七八九十百]+|[0-9]+)\s*[）)、.．、]\s*")

REQUIRED_SECTIONS = {
    "case": ["案例事实摘要", "分析框架说明", "三元结构分析正文", "结论"],
    "policy": ["独立事实摘要", "分析框架说明", "三元结构分析正文", "结论与推导"],
    # T4：组织 9 段骨架 → 校验 7 项哨兵；舆情 7 段骨架 → 校验 6 项哨兵
    "org": [
        "组织画像",
        "架构拆解与资金来源",
        "生存诊断",
        "繁衍诊断",
        "利益关系网络与利益集团拆解",
        "逆反诊断",
        "利益转化与组织—社会关系",
    ],
    "opinion": [
        "事件与时间线",
        "利益主体与沉默方",
        "叙事竞争矩阵",
        "三元生命维度",
        "逆反性质与层级",
        "演化曲线与系统回应",
    ],
    "combo": [],  # 组合走「≥2 类哨兵」校验（_count_sentinel_modes）
}

VALID_NODE_TYPES = {
    "actor", "event", "material", "security", "political",
    "identity_culture", "institutional_future", "public",
}
VALID_EDGE_TYPES = {"economic", "power", "cultural", "legal"}


def _has_section(md: str, title: str) -> bool:
    """判断 Markdown 是否含指定 ## 章节（容忍中文/数字编号前缀，如「## 一、组织画像」）。

    与 KERNEL parser 的模糊匹配一致：标题去编号后精确相等或包含。
    """
    for line in _SECTION_HEAD_RE.findall(md or ""):
        cleaned = _NUM_PREFIX_RE.sub("", line.strip()).strip()
        if cleaned == title or (title and title in cleaned):
            return True
    return False


def _last_section_pos(md: str, title: str) -> int | None:
    """返回最后一个匹配 title 的 ## 章节行起始位置（无匹配返回 None）。"""
    pos = -1
    for m in _SECTION_HEAD_RE.finditer(md or ""):
        cleaned = _NUM_PREFIX_RE.sub("", m.group(0).strip()).strip()
        if cleaned == title or (title and title in cleaned):
            pos = m.start()
    return pos if pos >= 0 else None


def _count_sentinel_modes(md: str) -> int:
    """统计 md 中出现过的哨兵章节所属类型集合大小（combo 校验用）。

    例如同时出现「政策对象图谱」与「组织画像」→ 返回 2（两类）。
    """
    from app.prompt_builder import SENTINEL_SECTIONS

    modes: set[str] = set()
    for mode, sections in SENTINEL_SECTIONS.items():
        for s in sections:
            if _has_section(md, s):
                modes.add(mode)
                break
    return len(modes)


def _extract_diagram(md: str):
    """返回 ('ok', obj) | ('invalid', None) | (None, None)。"""
    m = DIAGRAM_RE.search(md)
    if not m:
        return (None, None)
    raw = m.group(1).strip()
    try:
        obj = json.loads(raw)
    except Exception:
        return ("invalid", None)
    return ("ok", obj)


def _best_effort_nodes(md: str) -> list[str]:
    """从正文标题（### 第N节：X）与粗体提及中抽候选实体名。"""
    names: list[str] = []
    for m in re.finditer(r"###\s*第\d+节[：:]\s*(.+)", md):
        title = m.group(1)
        for tok in re.split(r"[、，。；与vs V S /（）()（）\s]+", title):
            tok = tok.strip()
            if 2 <= len(tok) <= 10 and not re.search(r"[#*\[\]（）()]|\d{4}年", tok):
                names.append(tok)
    for m in re.finditer(r"\*\*(.+?)\*\*", md):
        for tok in re.split(r"[、，。；与vs /]+", m.group(1)):
            tok = tok.strip()
            if 2 <= len(tok) <= 10 and not re.search(r"[#*\[\]]", tok):
                names.append(tok)
    seen, out = set(), []
    for n in names:
        if n not in seen:
            seen.add(n)
            out.append(n)
    return out[:12]


def _diagram_from_structured(structured=None) -> dict | None:
    """仅依据明确的结构化主体与关系生成图，不从正文猜测。"""
    if structured is None:
        return None
    try:
        from app import rule_engine

        si = (
            structured
            if isinstance(structured, rule_engine.StructuredInput)
            else rule_engine.StructuredInput.model_validate(structured)
        )
        d = rule_engine._build_diagram(si)
        if len(d.get("nodes") or []) >= 2 and d.get("edges"):
            return d
    except Exception as exc:  # noqa: BLE001
        logger.warning("根据结构化输入生成 DIAGRAM 失败：%s", exc)
    return None


def _diagram_block(d: dict) -> str:
    return "```DIAGRAM\n" + json.dumps(d, ensure_ascii=False) + "\n```\n"


def validate_and_repair(md: str, analysis_type: str = "case", structured=None):
    """校验并修复 LLM 输出的 Markdown 契约。

    返回 (repaired_md: str, contract: dict)。
    contract: {valid, diagram_ok, diagram_synthetic, missing_sections, errors, repaired, mode}
    """
    errors: list[str] = []
    md = md or ""
    mode = "llm"
    diagram_synthetic = False
    type_mismatch = False
    repaired = False

    # 0) 一级标题
    if not md.lstrip().startswith("# "):
        first = md.strip().splitlines()[0] if md.strip() else "未命名报告"
        md = f"# {first}\n\n" + md

    # 1) DIAGRAM
    diagram_ok = False
    diag = _extract_diagram(md)
    if diag[0] is None:
        d = _diagram_from_structured(structured)
        if d is None:
            errors.append("缺少有事实依据的 DIAGRAM 利益关系图")
        else:
            errors.append("缺少 DIAGRAM，已根据结构化主体与关系生成")
            diagram_synthetic = True
            diagram_ok = True
            repaired = True
            block = _diagram_block(d)
            if "## 附录" in md:
                md = md.replace("## 附录", block + "\n## 附录", 1)
            else:
                md = md.rstrip() + "\n\n" + block
    elif diag[0] == "invalid":
        d = _diagram_from_structured(structured)
        if d is None:
            errors.append("DIAGRAM 不是合法 JSON，且没有结构化关系可据实重建")
        else:
            errors.append("DIAGRAM 不是合法 JSON，已根据结构化主体与关系重建")
            diagram_synthetic = True
            diagram_ok = True
            repaired = True
            md = DIAGRAM_RE.sub(lambda _m: _diagram_block(d), md, count=1)
    else:
        obj = diag[1]
        nodes = obj.get("nodes") if isinstance(obj, dict) else None
        edges = obj.get("edges") if isinstance(obj, dict) else None
        if not isinstance(nodes, list) or not nodes:
            errors.append("DIAGRAM 缺少有效 nodes")
        else:
            diagram_ok = True
            # 规范化边 type，避免前端 viz 取错样式
            changed = False
            if isinstance(edges, list):
                for e in edges:
                    if isinstance(e, dict) and e.get("type") not in VALID_EDGE_TYPES:
                        e["type"] = "economic"
                        changed = True
            # 仅当确有改动时才回写；否则保持原文不变
            # （避免无谓重 dumped 时在闭合围栏后多插入一个空行）
            if changed:
                obj["edges"] = edges
                md = DIAGRAM_RE.sub(lambda _m: _diagram_block(obj).rstrip("\n"), md, count=1)
                repaired = True

    # 2) 类型一致性护栏（T4 双轨护栏第二层）：缺哨兵标 type_mismatch
    #    必须在补占位章节之前判定，否则占位会把缺的哨兵「补」上、护栏形同虚设。
    #    - combo：至少 2 类哨兵混编（_count_sentinel_modes）
    #    - org/opinion：哨兵已并入 REQUIRED_SECTIONS，缺失即 type_mismatch
    #    - case/policy：提示词侧已强制哨兵（guard），此处不再重复判 mismatch，
    #      避免破坏既有 rule 引擎产出（rule case 报告不含事件深度分析哨兵）。
    from app.prompt_builder import SENTINEL_SECTIONS

    if analysis_type == "combo":
        mode_count = _count_sentinel_modes(md)
        if mode_count < 2:
            type_mismatch = True
            errors.append(
                f"组合模式类型一致性缺失：至少需包含 2 类以上哨兵章节，当前仅 {mode_count} 类"
            )
    elif analysis_type in ("org", "opinion"):
        missing_sentinel = [
            s for s in SENTINEL_SECTIONS.get(analysis_type, []) if not _has_section(md, s)
        ]
        if missing_sentinel:
            type_mismatch = True
            errors.append("类型一致性缺失（缺哨兵章节）：" + "、".join(missing_sentinel))

    # 3) 必要章节（用 _has_section 模糊匹配，容忍「## 一、组织画像」等编号前缀）
    req = REQUIRED_SECTIONS.get(analysis_type, REQUIRED_SECTIONS["case"])
    missing = [s for s in req if not _has_section(md, s)]
    if missing:
        errors.append("缺少必要章节：" + "、".join(missing))

    # 4) 版权行
    if "国作登字" not in md:
        md = md.rstrip() + "\n\n分析框架：三元结构理论 © 2026, CC BY-NC-SA 4.0，国作登字-2026-A-00048134\n"
        repaired = True

    contract = {
        "valid": diagram_ok and not missing and not type_mismatch,
        "diagram_ok": diagram_ok,
        "diagram_synthetic": diagram_synthetic,
        "missing_sections": missing,
        "errors": errors,
        "repaired": repaired,
        "mode": mode,
        "type_mismatch": type_mismatch,
        # 降级信号：图是合成的（LLM 没给可用关系图）且必要章节也缺失 ——
        # 说明 LLM 输出偏离契约太远、几乎无可信内容，应回退规则引擎。
        "degrade": not diagram_ok or bool(missing) or type_mismatch,
    }
    return md, contract
