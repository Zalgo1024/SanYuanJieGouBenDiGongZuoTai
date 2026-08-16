"""素材组装模块（T2）— 把「检索结果 + 抓取正文」组装为 generator 的 materials。

职责：
1. build_materials：按用户剔除集合过滤，拼 items + sources；
2. format_materials_context：拼成注入 generator 的素材块（每篇「[标题](url) + 正文截断」）；
3. format_source_appendix：生成附录 Markdown（铁律 11：`[名称](url)` 可点击格式）。

来源清单 `sources` 是三处一致的真源：materials 生成 → generator 注入附录约束 → 前端回显/校验。
"""
from __future__ import annotations

from dataclasses import dataclass, field
import re


@dataclass
class SourceItem:
    """来源清单条目（前端回显 + 附录唯一真源）。"""

    title: str
    url: str


@dataclass
class MaterialBundle:
    """素材包：items 供注入提示词，sources 供附录与前端回显。"""

    items: list[dict] = field(default_factory=list)  # [{title,url,text,snippet,kept}]
    sources: list[SourceItem] = field(default_factory=list)  # [{title,url}]


def _coerce_bundle(bundle: MaterialBundle | dict | None) -> MaterialBundle:
    """容忍调用方传 MaterialBundle 或裸 dict（queue 传 bundle.__dict__）。"""
    if bundle is None:
        return MaterialBundle(items=[], sources=[])
    if isinstance(bundle, MaterialBundle):
        return bundle
    if isinstance(bundle, dict):
        sources = []
        for s in bundle.get("sources") or []:
            if isinstance(s, SourceItem):
                sources.append(s)
            elif isinstance(s, dict):
                sources.append(SourceItem(title=s.get("title", ""), url=s.get("url", "")))
        return MaterialBundle(items=bundle.get("items") or [], sources=sources)
    return MaterialBundle(items=[], sources=[])


def build_materials(
    hits: list,
    fetched: list[dict],
    excluded_urls: set[str] | list[str] | None,
) -> MaterialBundle:
    """按用户剔除集合过滤，拼 items + sources。

    - hits：检索命中（SearchHit 列表，含 title/url/snippet）；
    - fetched：fetch_and_clean 结果（[{title,url,text,snippet,error}]）；
    - excluded_urls：用户剔除的 URL 集合（剔除项保留在 items 里但 kept=False，
      便于前端展示「已剔除」；sources 只收录 kept=True 且抓取成功的条目）。
    """
    excluded = set(excluded_urls or [])
    fetched_map: dict[str, dict] = {}
    for f in fetched or []:
        if f.get("url"):
            fetched_map[f["url"]] = f

    items: list[dict] = []
    sources: list[SourceItem] = []
    seen: set[str] = set()

    def _push(url: str, title: str, snippet: str, f: dict) -> None:
        kept = url not in excluded and not f.get("error")
        items.append(
            {
                "title": f.get("title") or title,
                "url": url,
                "text": f.get("text") or "",
                "snippet": f.get("snippet") or snippet,
                "kept": kept,
            }
        )
        if kept:
            sources.append(SourceItem(title=f.get("title") or title, url=url))

    # 1) hits 优先（检索命中 → 抓取正文）
    for h in hits or []:
        url = getattr(h, "url", None) or (h.get("url") if isinstance(h, dict) else None)
        if not url or url in seen:
            continue
        seen.add(url)
        title = getattr(h, "title", None) or (h.get("title") if isinstance(h, dict) else "") or url
        snippet = getattr(h, "snippet", None) or (h.get("snippet") if isinstance(h, dict) else "") or ""
        _push(url, title, snippet, fetched_map.get(url) or {})

    # 2) 补：仅出现在 fetched 的条目（白名单直抓 / hit 无 url 等场景）
    for f in fetched or []:
        url = f.get("url", "")
        if not url or url in seen:
            continue
        seen.add(url)
        _push(url, f.get("title") or url, f.get("snippet") or "", f)

    return MaterialBundle(items=items, sources=sources)


def extract_fact_candidates(text: str, limit: int = 5) -> list[str]:
    """从清洗后的来源正文抽取少量句级事实候选。

    这不是事实裁决器：候选仍需模型在写作前核对和去重。它的职责是切断把整篇
    网页原文直接塞进报告的路径，让每一来源在研究上下文中最多占五个句子。
    """
    normalized = re.sub(r"\s+", " ", text or "").strip()
    if not normalized:
        return []
    parts = re.split(r"(?<=[。！？!?；;])\s*", normalized)
    seen: set[str] = set()
    candidates: list[str] = []
    for part in parts:
        candidate = part.strip()
        if len(candidate) < 6 or candidate in seen:
            continue
        seen.add(candidate)
        candidates.append(candidate)
        if len(candidates) >= limit:
            break
    return candidates


def format_materials_context(bundle: MaterialBundle | dict | None, max_chars: int = 12000) -> str:
    """拼成供模型内部研究的事实候选池，而非可直接复读的网页原文。"""
    b = _coerce_bundle(bundle)
    parts: list[str] = []
    total = 0
    for it in b.items:
        if not it.get("kept") or not it.get("text"):
            continue
        candidates = extract_fact_candidates(it.get("text", ""))
        if not candidates:
            continue
        facts = "\n".join(f"- {candidate}" for candidate in candidates)
        block = (
            f"来源：{it.get('title', '')}\n"
            f"链接：{it.get('url', '')}\n"
            f"事实候选（仅供内部核对，不得整段复述）：\n{facts}"
        )
        parts.append(block)
        total += len(block)
        if total >= max_chars:
            break
    if not parts:
        return ""
    return "【内部研究材料】\n" + "\n\n".join(parts)


def _md_escape_url(url: str) -> str:
    """把 URL 放入 Markdown 链接括号前的安全化：括号必须百分号编码，
    否则 `[标题](url)` 会被 `)` 提前截断（铁律：每条来源必须可点击）。
    只处理括号字符，保留已有 %XX 编码与其余字符原样。"""
    if not url:
        return url
    return url.replace("(", "%28").replace(")", "%29")


def format_source_appendix(sources: list[SourceItem] | None) -> str:
    """生成附录来源清单 Markdown：1. [标题](url)（铁律 11 可点击格式）。"""
    srcs = sources or []
    if not srcs:
        return ""
    lines = ["**数据来源**："]
    for i, s in enumerate(srcs, 1):
        lines.append(f"{i}. [{s.title}]({_md_escape_url(s.url)})")
    return "\n".join(lines)
