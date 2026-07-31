"""来源预览接口：POST /api/search/preview（T8）。

请求 {"query": "关键词"} → 响应 {"query", "provider", "hits":[{title,url,snippet}], "degraded"}
即时返回不落库；检索源自动选择（BING→BRAVE→DDG），失败带明确 degraded 标记，不静默。
"""
import logging

from fastapi import APIRouter
from pydantic import BaseModel

from app.search import dedupe_hits, search_web
from app.settings import settings

logger = logging.getLogger(__name__)

router = APIRouter()


class SearchPreviewRequest(BaseModel):
    query: str


@router.post("/api/search/preview")
def search_preview(req: SearchPreviewRequest):
    """来源预览：即时检索，不落库。degraded 非空时前端应提示「检索源不可用」。"""
    query = (req.query or "").strip()
    if not query:
        return {"query": "", "provider": "duckduckgo", "hits": [], "degraded": "查询为空"}

    result = search_web(query, settings.search_max_results)
    if result is None:
        return {
            "query": query,
            "provider": "duckduckgo",
            "hits": [],
            "degraded": "检索源不可用（可配置 BING/BRAVE Key 或改用手动 URL 输入）",
        }
    hits = dedupe_hits(result.hits)
    return {
        "query": result.query,
        "provider": result.provider,
        "hits": [{"title": h.title, "url": h.url, "snippet": h.snippet} for h in hits],
        "degraded": result.degraded,
    }
