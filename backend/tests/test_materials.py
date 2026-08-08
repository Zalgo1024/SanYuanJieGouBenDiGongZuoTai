from app.materials import MaterialBundle, extract_fact_candidates, format_materials_context


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
