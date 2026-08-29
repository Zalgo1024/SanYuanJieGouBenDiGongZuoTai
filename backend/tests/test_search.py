"""search.py 单测（T1）：DDG HTML 解析 / 去重 / 降级标记 / 兼容上下文。

不依赖外网：DDG 解析用内嵌 HTML 夹具；降级用「显式 provider 但缺 Key」触发；
真网检索只做可选冒烟（跳过不失败）。
"""
import time

from app.search import (
    SearchHit,
    SearchResult,
    _normalize_url,
    _parse_ddg_html,
    dedupe_hits,
    derive_analogue_query,
    fetch_and_clean,
    format_search_context,
    search_primary_and_analogue,
    search_web,
)

DDG_HTML = """<html><body>
<div class="result results_links results_links_deep web-result">
  <h2 class="result__title"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage%3Fa%3D1&amp;rut=abc">标题一</a></h2>
  <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage%3Fa%3D1&amp;rut=abc">摘要一内容</a>
</div>
<div class="result results_links results_links_deep web-result">
  <h2 class="result__title"><a class="result__a" href="https://example.org/b">标题二</a></h2>
  <a class="result__snippet">摘要二内容</a>
</div>
</body></html>"""


def test_parse_ddg_html_extracts_hits():
    """DDG HTML 解析：.result__a（标题 + uddg 还原 URL）+ .result__snippet（摘要）。"""
    hits = _parse_ddg_html(DDG_HTML, 5)
    assert len(hits) == 2
    assert hits[0].title == "标题一"
    # DDG 重定向链接中的 uddg 参数应被还原为真实 URL
    assert hits[0].url == "https://example.com/page?a=1"
    assert hits[0].snippet == "摘要一内容"
    assert hits[1].title == "标题二"
    assert hits[1].url == "https://example.org/b"
    assert hits[1].snippet == "摘要二内容"


def test_parse_ddg_html_respects_max_results():
    hits = _parse_ddg_html(DDG_HTML, 1)
    assert len(hits) == 1


def test_dedupe_hits_by_url_normalization():
    """URL 归一：去 query 参数 / www / 协议差异 → 判重。"""
    hits = [
        SearchHit(title="同一条新闻", url="https://example.com/a?utm_source=x", snippet=""),
        SearchHit(title="同一条新闻（副本）", url="https://www.example.com/a", snippet=""),
        SearchHit(title="完全不同的标题", url="https://example.com/b", snippet=""),
    ]
    out = dedupe_hits(hits)
    assert len(out) == 2, [h.url for h in out]
    urls = [h.url for h in out]
    assert "https://example.com/b" in urls


def test_dedupe_hits_by_title_similarity():
    """标题相似度（difflib ratio > 0.9）判重。"""
    hits = [
        SearchHit(title="某公司组织架构与资金来源分析", url="https://a.com/1", snippet=""),
        SearchHit(title="某公司组织架构与资金来源分析报告", url="https://a.com/2", snippet=""),
        SearchHit(title="完全无关的另一篇", url="https://a.com/3", snippet=""),
    ]
    out = dedupe_hits(hits)
    assert len(out) == 2


def test_normalize_url():
    assert _normalize_url("https://www.Example.com/a?x=1") == "https://example.com/a"
    assert _normalize_url("HTTP://example.com/a/") == "http://example.com/a"


def test_search_web_bing_missing_key_degrades(monkeypatch):
    """显式 provider=bing 但缺 Key → 返回带 degraded 标记的 SearchResult，不静默、不抛异常。"""
    from app.settings import settings

    monkeypatch.setattr(settings, "bing_search_key", "")
    r = search_web("三元结构理论", provider="bing")
    assert r is not None
    assert r.provider == "bing"
    assert r.hits == []
    assert r.degraded and "BING" in r.degraded


def test_search_web_brave_missing_key_degrades(monkeypatch):
    from app.settings import settings

    monkeypatch.setattr(settings, "brave_search_key", "")
    r = search_web("测试", provider="brave")
    assert r is not None
    assert r.provider == "brave"
    assert r.hits == []
    assert r.degraded and "BRAVE" in r.degraded


def test_search_web_empty_query_degrades():
    r = search_web("   ")
    assert r is not None
    assert r.degraded


def test_search_web_old_signature_compat(monkeypatch):
    """旧签名 search_web(query, provider, api_key, max_results) 兼容包装。"""
    from app.settings import settings

    monkeypatch.setattr(settings, "bing_search_key", "")
    # 旧调用姿势：provider 在第二位置（字符串）→ 应被识别为显式 provider=bing
    r = search_web("测试", "bing", "", 5)
    assert r is not None
    assert r.provider == "bing"
    assert r.degraded


def test_format_search_context_hits_and_degraded():
    r = SearchResult(
        query="q",
        hits=[SearchHit(title="标题", url="https://e.com/a", snippet="摘要")],
        provider="duckduckgo",
    )
    ctx = format_search_context(r)
    assert "标题" in ctx and "https://e.com/a" in ctx and "摘要" in ctx

    d = SearchResult(query="q", hits=[], provider="duckduckgo", degraded="检索源不可用")
    ctx2 = format_search_context(d)
    assert "检索源不可用" in ctx2  # 降级必须显式可见

    assert format_search_context(None) == ""


def test_analogue_query_is_bounded_and_explicitly_asks_for_outcomes():
    query = derive_analogue_query("分析某平台修改规则后引发用户抵制，官方随后发布回应" * 20)

    assert len(query) <= 180
    assert "类似案例" in query
    assert "处理结果" in query


def test_primary_search_failure_skips_redundant_analogue_search():
    calls: list[str] = []

    def fake_search(query: str, max_results: int):
        calls.append(query)
        return SearchResult(
            query=query,
            hits=[],
            provider="duckduckgo",
            degraded="检索源超时",
        )

    primary, analogue = search_primary_and_analogue(
        "主查询",
        "历史对照查询",
        5,
        search_fn=fake_search,
        parallel=False,
    )

    assert primary.degraded
    assert analogue is None
    assert calls == ["主查询"]


def test_fetch_and_clean_runs_concurrently_and_preserves_input_order(monkeypatch):
    delays = {
        "https://example.com/slow": 0.12,
        "https://example.com/fast": 0.02,
        "https://example.com/middle": 0.07,
    }

    def fake_get(url: str, timeout: int = 12, headers=None):
        time.sleep(delays[url])
        return f"<html><title>{url}</title><body>这是足够长的正文内容 {url}</body></html>"

    monkeypatch.setattr("app.search._http_get", fake_get)
    monkeypatch.setattr("app.search.clean_text", lambda html, url="": html)
    urls = list(delays)
    started = time.monotonic()
    rows = fetch_and_clean(urls, max_workers=3)
    elapsed = time.monotonic() - started

    assert [row["url"] for row in rows] == urls
    assert elapsed < 0.19


def test_fetch_and_clean_marks_empty_pages_as_unusable(monkeypatch):
    monkeypatch.setattr(
        "app.search._http_get",
        lambda url, timeout=12, headers=None: "<html><title>只有标题</title><body></body></html>",
    )
    rows = fetch_and_clean(["https://example.com/empty"])

    assert rows[0]["text"] == ""
    assert rows[0]["error"] == "empty_content"


def test_search_web_rotates_to_next_free_source_when_ddg_fails(monkeypatch):
    """免费源轮换：DDG 挂了自动轮到必应网页版，拿到结果即停。"""
    import app.search as search
    from app.settings import settings as search_settings

    monkeypatch.setattr(search_settings, "bing_search_key", "")
    monkeypatch.setattr(search_settings, "brave_search_key", "")

    def failing_ddg(query, max_results):
        raise TimeoutError("ddg timeout")

    hit = search.SearchHit(
        title="必应结果", url="https://example.com/bing", snippet="snippet"
    )
    monkeypatch.setattr(search, "_search_duckduckgo", failing_ddg)
    monkeypatch.setattr(search, "_search_bing_html", lambda query, max_results: [hit])

    r = search.search_web("三元结构理论")
    assert r is not None
    assert r.hits and r.hits[0].url == "https://example.com/bing"
    assert r.provider == "bing_html"
    assert not r.degraded


def test_search_web_all_free_sources_fail_degrades(monkeypatch):
    """全部免费源失败：返回 degraded 标记，不静默、不抛异常。"""
    import app.search as search
    from app.settings import settings as search_settings

    monkeypatch.setattr(search_settings, "bing_search_key", "")
    monkeypatch.setattr(search_settings, "brave_search_key", "")

    def failing(*args, **kwargs):
        raise TimeoutError("timeout")

    monkeypatch.setattr(search, "_search_duckduckgo", failing)
    monkeypatch.setattr(search, "_search_bing_html", failing)
    monkeypatch.setattr(search, "_search_sogou", failing)

    r = search.search_web("三元结构理论")
    assert r is not None
    assert not r.hits
    assert r.degraded and "免费检索源" in r.degraded
