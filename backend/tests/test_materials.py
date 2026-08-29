from app.materials import (
    MaterialBundle,
    build_materials,
    extract_fact_candidates,
    format_materials_context,
)
from app.search import SearchHit


def test_extract_fact_candidates_keeps_at_most_five_distinct_sentences():
    text = "甲方在2026年1月发布政策。乙方在2月执行。丙方在3月反馈。丁方在4月修订。戊方在5月公布结果。己方在6月再次说明。"

    candidates = extract_fact_candidates(text)

    assert candidates == [
        "甲方在2026年1月发布政策。",
        "乙方在2月执行。",
        "丙方在3月反馈。",
        "丁方在4月修订。",
        "戊方在5月公布结果。",
    ]


def test_material_context_supplies_candidates_not_raw_source_body():
    raw = "第一条事实很长。第二条事实很长。第三条事实很长。第四条事实很长。第五条事实很长。第六条事实不能进入候选。"
    bundle = MaterialBundle(items=[{"title": "权威来源", "url": "https://example.com", "text": raw, "kept": True}])

    context = format_materials_context(bundle)

    assert "【内部研究材料】" in context
    assert "[素材]" not in context
    assert "第六条事实不能进入候选。" not in context
    assert raw not in context


def test_failed_or_empty_fetches_never_become_evidence_sources():
    hits = [
        SearchHit(title="失效页面", url="https://example.com/missing", snippet="摘要"),
        SearchHit(title="空白页面", url="https://example.com/empty", snippet="摘要"),
        SearchHit(title="有效页面", url="https://example.com/valid", snippet="摘要"),
    ]
    fetched = [
        {"url": "https://example.com/missing", "title": "失效页面", "text": "", "error": "404"},
        {"url": "https://example.com/empty", "title": "空白页面", "text": "", "error": None},
        {
            "url": "https://example.com/valid",
            "title": "有效页面",
            "text": "这是一段足够长的正文，用于证明该来源确实返回了可核验的页面内容。",
            "error": None,
        },
    ]

    bundle = build_materials(hits, fetched, set())

    assert [source.url for source in bundle.sources] == ["https://example.com/valid"]
    failed = {item["url"]: item for item in bundle.items}
    assert failed["https://example.com/missing"]["kept"] is False
    assert failed["https://example.com/empty"]["kept"] is False
    assert failed["https://example.com/valid"]["kept"] is True
