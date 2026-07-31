"""翻译层 — 把内核/parser 的结构翻译成前端契约的 JSON 形状。

职责：
1. sections[]：用 parser.parse_report(body) 拿 section_seq → 映射成前端期望的 sections 列表
2. graphs {network, org, flow}：从正文 DIAGRAM 块的 diagram_data 按 viz 字段分类
3. evidence：从附录 [名称](url) 列表项提取，按节点标签匹配挂到 node.evidence
4. artifacts：把内核产物路径转成 /files/{run_id}/{filename} URL
"""
import os
import re
from typing import Any, Optional

# parser 在项目根，由 kernel_adapter 的 sys.path 注入间接保证可用；
# 但 translator 也可能被独立调用，这里再保一次。
import sys
from settings import KERNEL_SYS_PATH, PUBLIC_BASE_URL
if KERNEL_SYS_PATH not in sys.path:
    sys.path.insert(0, KERNEL_SYS_PATH)

from parser import parse_report, ParsedReport, Section, Block  # type: ignore


_RE_LINK = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")


# ── 1. sections[] ──────────────────────────────────────────

def _block_to_dict(block: Block) -> dict:
    """把 parser.Block 序列化为前端可消费的 dict。"""
    out: dict[str, Any] = {"type": block.type}
    if block.type == "paragraph":
        out["text"] = block.text
        if block.segments:
            out["segments"] = [{"text": t, "url": u} for t, u in block.segments]
    elif block.type == "quote":
        out["text"] = block.text
    elif block.type == "list":
        out["items"] = list(block.items or [])
        if block.segments:
            out["segments"] = [
                [{"text": t, "url": u} for t, u in seg] for seg in block.segments
            ]
    elif block.type == "table":
        out["rows"] = [list(r) for r in (block.rows or [])]
    elif block.type == "diagram":
        # diagram_data 是用户在 ```DIAGRAM 块里写的原始 JSON
        out["diagram_data"] = block.diagram_data or {}
    elif block.type == "subheading":
        out["text"] = block.text
        if block.sub_section_id:
            out["sub_section_id"] = block.sub_section_id
    elif block.type == "heading":
        out["text"] = block.text
    # blank: 不输出额外字段
    return out


def _section_to_dict(section: Section, order: int) -> dict:
    return {
        "order": order,
        "title": section.title,
        "cid": section.cid,
        "mode": section.mode,
        "blocks": [_block_to_dict(b) for b in section.blocks if b.type != "blank"],
    }


def build_sections(body: str) -> list[dict]:
    """解析正文 → sections[]（按 section_seq 顺序）。"""
    report = parse_report(body)
    return [_section_to_dict(s, i) for i, s in enumerate(report.section_seq)]


# ── 2. graphs {network, org, flow} ─────────────────────────

_VIZ_KINDS = ("network", "org", "flow")


def _collect_diagrams(body: str) -> list[dict]:
    """从正文提取所有 diagram_data（含 viz 字段）。"""
    report = parse_report(body)
    out = []
    for sec in report.section_seq:
        for blk in sec.blocks:
            if blk.type == "diagram" and blk.diagram_data:
                out.append(blk.diagram_data)
    return out


def _empty_graph() -> dict:
    return {"nodes": [], "edges": []}


def build_graphs(body: str, appendix_evidence: list[dict]) -> dict:
    """构造 {network, org, flow} 三态图。

    - 按 diagram_data.viz 分类；缺失 viz 默认 network
    - 同类多图取第一张（MVP）
    - 给每个 node 挂 evidence（按节点标签匹配附录来源）
    - 极简输入（无 DIAGRAM 块）→ 三个字段全 null
    """
    diagrams = _collect_diagrams(body)
    if not diagrams:
        return {"network": None, "org": None, "flow": None}

    grouped: dict[str, dict] = {}
    for diag in diagrams:
        viz = diag.get("viz", "network")
        if viz not in _VIZ_KINDS:
            viz = "network"
        if viz not in grouped:
            grouped[viz] = diag

    result: dict[str, Optional[dict]] = {}
    for kind in _VIZ_KINDS:
        diag = grouped.get(kind)
        if not diag:
            result[kind] = None
            continue
        nodes = list(diag.get("nodes") or [])
        edges = list(diag.get("edges") or [])
        # 给节点挂 evidence
        for node in nodes:
            _attach_evidence(node, appendix_evidence)
        result[kind] = {"nodes": nodes, "edges": edges}

    return result


# ── 3. evidence ────────────────────────────────────────────

def extract_appendix_evidence(body: str) -> list[dict]:
    """从附录章节提取 [名称](url) 列表 → [{claim, source_url}]。"""
    report = parse_report(body)
    appendix = report.sections.get("appendix")
    if not appendix:
        return []
    evidence: list[dict] = []
    for blk in appendix.blocks:
        if blk.type == "list" and blk.items:
            for item in blk.items:
                m = _RE_LINK.search(item)
                if m:
                    evidence.append({"claim": m.group(1), "source_url": m.group(2)})
        elif blk.type == "paragraph":
            for m in _RE_LINK.finditer(blk.text):
                evidence.append({"claim": m.group(1), "source_url": m.group(2)})
    return evidence


def _attach_evidence(node: dict, evidence: list[dict]) -> None:
    """按节点标签匹配附录来源，挂到 node.evidence。

    匹配规则（宽松）：节点的 label 或 id 与来源 claim 互相包含即视为相关。
    无匹配时 evidence 字段不出现（前端用 r.evidence?.length 判空）。
    """
    if not evidence:
        return
    label = str(node.get("label") or "").strip().lower()
    nid = str(node.get("id") or "").strip().lower()
    if not label and not nid:
        return
    matched = []
    for ev in evidence:
        claim = str(ev.get("claim") or "").strip().lower()
        if not claim:
            continue
        # label 或 id 任一与 claim 互相包含即命中
        if (label and (label in claim or claim in label)) or \
           (nid and (nid in claim or claim in nid)):
            matched.append({"claim": ev["claim"], "source_url": ev["source_url"]})
    if matched:
        node["evidence"] = matched


# ── 4. artifacts ───────────────────────────────────────────

def _filename_of(path: str) -> str:
    return os.path.basename(path) if path else ""


def build_artifacts(kernel_result: dict, run_id: int) -> tuple[dict, Optional[str]]:
    """把内核产物路径转成绝对 URL：{PUBLIC_BASE_URL}/api/files/{run_id}/{filename}。

    返回 (artifacts_dict, cover_graph_url)。
    用绝对 URL 是因为前端在 :3000、后端在 :8000，<a href> 需直连后端。
    """
    word = kernel_result.get("word") or ""
    pdf = kernel_result.get("pdf") or ""
    pdf_ok = bool(kernel_result.get("pdf_ok"))
    diagrams = kernel_result.get("diagrams") or []

    base = f"{PUBLIC_BASE_URL}/api/files/{run_id}"
    artifacts = {
        "docx_url": f"{base}/{_filename_of(word)}" if word else None,
        "pdf_url": (f"{base}/{_filename_of(pdf)}" if pdf_ok and pdf else None),
        "html_url": None,
        "png_url": None,
        "png_urls": [],
    }

    png_urls: list[str] = []
    html_url: Optional[str] = None
    for diag in diagrams:
        png = diag.get("png") or ""
        html = diag.get("html") or ""
        if png:
            png_urls.append(f"{base}/{_filename_of(png)}")
        if html and not html_url:
            html_url = f"{base}/{_filename_of(html)}"

    artifacts["png_urls"] = png_urls
    if png_urls:
        artifacts["png_url"] = png_urls[0]
    if html_url:
        artifacts["html_url"] = html_url

    cover_graph_url = png_urls[0] if png_urls else None
    return artifacts, cover_graph_url


# ── 入口：一次解析，多处复用 ─────────────────────────────────

def translate(body: str, kernel_result: dict, run_id: int) -> dict:
    """一次解析正文，返回 sections + graphs + artifacts + cover_graph_url。"""
    evidence = extract_appendix_evidence(body)
    sections = build_sections(body)
    graphs = build_graphs(body, evidence)
    artifacts, cover_graph_url = build_artifacts(kernel_result, run_id)
    return {
        "sections": sections,
        "graphs": graphs,
        "artifacts": artifacts,
        "cover_graph_url": cover_graph_url,
    }
