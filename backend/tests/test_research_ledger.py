import json

from app.research_ledger import (
    ResearchLedger,
    build_fallback_ledger,
    normalize_research_ledger,
    parse_research_payload,
)


def test_normalize_downgrades_unsupported_facts_and_dangling_relations():
    ledger = normalize_research_ledger(
        {
            "schema_version": "1.0",
            "sources": [
                {
                    "id": "s1",
                    "title": "官方公告",
                    "url": "https://example.com/a",
                    "source_type": "official",
                    "source_level": "primary",
                    "independence_group": "announcement-a",
                    "excerpt": "公告确认事件发生。",
                }
            ],
            "claims": [
                {
                    "id": "c1",
                    "text": "事件已经发生",
                    "claim_type": "fact",
                    "confidence": "high",
                    "evidence_ids": ["s1"],
                },
                {
                    "id": "c2",
                    "text": "当事人存在未披露利益安排",
                    "claim_type": "fact",
                    "confidence": "high",
                    "evidence_ids": ["missing"],
                },
            ],
            "relations": [
                {
                    "id": "r1",
                    "source_node": "A",
                    "target_node": "B",
                    "label": "利益输送",
                    "status": "confirmed",
                    "confidence": "high",
                    "evidence_ids": ["missing"],
                }
            ],
        }
    )

    assert ledger.claims[0].claim_type == "fact"
    assert ledger.claims[0].unsupported is False
    assert ledger.claims[1].claim_type == "inference"
    assert ledger.claims[1].confidence == "low"
    assert ledger.claims[1].evidence_ids == []
    assert ledger.claims[1].unsupported is True
    assert "缺少可核验来源" in ledger.claims[1].confidence_reasons
    assert ledger.relations[0].status == "inferred"
    assert ledger.relations[0].confidence == "low"
    assert ledger.relations[0].evidence_ids == []
    assert ledger.metrics.key_claim_evidence_coverage == 0.5
    assert ledger.metrics.unsupported_inference_count == 1


def test_metrics_count_independent_source_groups_not_reprints():
    ledger = normalize_research_ledger(
        {
            "sources": [
                {"id": "s1", "title": "原始公告", "url": "https://example.com/a", "independence_group": "a"},
                {"id": "s2", "title": "转载一", "url": "https://example.com/b", "independence_group": "a"},
                {"id": "s3", "title": "独立报道", "url": "https://example.com/c", "independence_group": "c"},
            ],
            "claims": [],
            "relations": [],
        }
    )

    assert ledger.metrics.source_count == 3
    assert ledger.metrics.independent_source_group_count == 2


def test_parse_payload_accepts_json_code_fence_and_rejects_non_object():
    payload = parse_research_payload('```json\n{"sources": [], "claims": [], "relations": []}\n```')
    assert payload == {"sources": [], "claims": [], "relations": []}

    try:
        parse_research_payload(json.dumps(["not-an-object"]))
    except ValueError as exc:
        assert "JSON 对象" in str(exc)
    else:
        raise AssertionError("列表不应被接受为研究账本")


def test_fallback_ledger_marks_user_input_and_keeps_material_sources():
    ledger = build_fallback_ledger(
        markdown=(
            "# 测试报告\n\n"
            "```DIAGRAM\n"
            '{"nodes":[{"id":"A"},{"id":"B"}],"edges":[{"source":"A","target":"B","label":"资金支持","type":"economic"}]}\n'
            "```\n\n## 结论\n\n系统暂时无法提取结构化判断。"
        ),
        input_text="用户称 A 公司已经停止服务。",
        materials={
            "items": [
                {
                    "title": "A 公司公告",
                    "url": "https://example.com/a",
                    "text": "A 公司宣布停止服务。",
                    "kept": True,
                }
            ],
            "sources": [{"title": "A 公司公告", "url": "https://example.com/a"}],
        },
        reason="结构化提取失败",
    )

    assert isinstance(ledger, ResearchLedger)
    assert ledger.status == "fallback"
    assert ledger.sources[0].url == "https://example.com/a"
    assert ledger.claims[0].claim_type == "user_input"
    assert ledger.claims[0].confidence == "unknown"
    assert ledger.relations[0].status == "inferred"
    assert ledger.relations[0].confidence == "low"
    assert ledger.relations[0].evidence_ids == []
    assert ledger.gaps[0].question == "哪些关键判断仍缺少逐条证据绑定？"
    assert ledger.warnings == ["结构化提取失败"]


def test_no_evidence_ledger_is_not_report_generation_fallback():
    ledger = build_fallback_ledger(
        markdown="# 测试报告",
        materials={"items": [], "sources": []},
        input_text="待核验事件",
        reason="当前没有可核验来源，已跳过结构化证据提取",
        status="no_evidence",
    )

    assert ledger.status == "no_evidence"
    assert ledger.claims[0].claim_type == "user_input"
    assert ledger.metrics.source_count == 0


def test_source_intelligence_rates_sources_and_collapses_duplicate_evidence():
    ledger = normalize_research_ledger(
        {
            "sources": [
                {
                    "id": "s1",
                    "title": "国务院政策文件",
                    "url": "https://www.gov.cn/zhengce/content/2026/a.html",
                    "excerpt": "政策明确要求平台公开关键治理规则。",
                },
                {
                    "id": "s2",
                    "title": "转载：国务院政策文件",
                    "url": "https://news.example.com/reprint/a",
                    "excerpt": "政策明确要求平台公开关键治理规则。",
                    "source_type": "self_media",
                },
                {
                    "id": "s3",
                    "title": "用户论坛讨论",
                    "url": "https://bbs.example.net/thread/10",
                    "excerpt": "有用户声称平台已经执行。",
                    "source_type": "forum",
                },
            ],
            "claims": [
                {
                    "id": "c1",
                    "text": "政策要求公开治理规则",
                    "claim_type": "fact",
                    "evidence_ids": ["s1", "s2"],
                    "confidence": "high",
                }
            ],
        }
    )

    assert ledger.schema_version == "1.2"
    assert ledger.sources[0].source_type == "official"
    assert ledger.sources[0].quality_tier == "A"
    assert ledger.sources[1].duplicate_of == "s1"
    assert ledger.sources[1].content_fingerprint == ledger.sources[0].content_fingerprint
    assert ledger.sources[2].quality_tier == "D"
    assert ledger.metrics.source_count == 3
    assert ledger.metrics.independent_source_group_count == 2
    assert ledger.metrics.duplicate_source_count == 1
    assert ledger.metrics.high_quality_source_count == 1


def test_nodes_relations_timeline_and_ranked_gaps_are_normalized():
    ledger = normalize_research_ledger(
        {
            "sources": [
                {
                    "id": "s1",
                    "title": "公司公告",
                    "url": "https://company.example.com/a",
                    "source_type": "company",
                    "published_at": "2026-08-10",
                }
            ],
            "claims": [
                {
                    "id": "c1",
                    "text": "公司改变了渠道策略",
                    "claim_type": "fact",
                    "confidence": "medium",
                    "evidence_ids": ["s1"],
                }
            ],
            "nodes": [
                {
                    "id": "company",
                    "label": "公司",
                    "role": "决策者",
                    "interests": ["收入", "控制权"],
                    "stance": "收缩渠道",
                    "weight": 0.82,
                    "confidence": "medium",
                    "evidence_ids": ["s1"],
                    "first_seen": "2026-08-01",
                    "last_seen": "2026-08-10",
                    "stance_history": [
                        {"at": "2026-08-01", "stance": "扩张渠道", "evidence_ids": ["s1"]},
                        {"at": "2026-08-10", "stance": "收缩渠道", "evidence_ids": ["s1"]},
                    ],
                }
            ],
            "relations": [
                {
                    "id": "r1",
                    "source_node": "company",
                    "target_node": "channel",
                    "label": "控制",
                    "strength": 4,
                    "interest_types": ["power", "economic"],
                    "direction": "directed",
                    "polarity": "negative",
                    "confidence": "medium",
                    "evidence_ids": ["s1"],
                    "claim_id": "c1",
                    "status": "confirmed",
                    "valid_from": "2026-08-10",
                }
            ],
            "timeline": [
                {
                    "id": "t2",
                    "date": "2026-08-10",
                    "title": "渠道策略收缩",
                    "event_type": "stance_change",
                    "actor_ids": ["company"],
                    "claim_ids": ["c1"],
                    "evidence_ids": ["s1"],
                    "confidence": "medium",
                    "turning_point": True,
                },
                {
                    "id": "t1",
                    "date": "2026-08-01",
                    "title": "渠道扩张",
                    "actor_ids": ["company"],
                    "evidence_ids": ["s1"],
                    "confidence": "medium",
                },
            ],
            "gaps": [
                {"id": "g1", "question": "缺少合同", "priority": "critical", "material_type": "contract"},
                {"id": "g2", "question": "缺少采访", "priority": "medium", "material_type": "interview"},
            ],
        }
    )

    assert ledger.nodes[0].weight == 0.82
    assert ledger.nodes[0].stance_history[-1].stance == "收缩渠道"
    assert ledger.relations[0].strength == 4
    assert ledger.relations[0].interest_types == ["power", "economic"]
    assert ledger.relations[0].evidence_count == 1
    assert [event.id for event in ledger.timeline] == ["t1", "t2"]
    assert ledger.timeline[1].turning_point is True
    assert ledger.gaps[0].priority == "critical"
    assert ledger.gaps[0].material_type == "contract"
    assert ledger.metrics.relation_evidence_coverage == 1.0
    assert ledger.metrics.temporal_completeness == 1.0


def test_p2_downgrades_unsupported_analogues_counterfactuals_and_numbers():
    ledger = normalize_research_ledger(
        {
            "sources": [
                {
                    "id": "s1",
                    "title": "历史处置公告",
                    "url": "https://example.com/history",
                    "source_type": "official",
                }
            ],
            "analogues": [
                {
                    "id": "a1",
                    "title": "有证据的历史案例",
                    "summary": "同一行业曾发生类似争议。",
                    "similarities": ["均涉及规则调整"],
                    "differences": ["主体规模不同"],
                    "response": "公开说明并调整规则",
                    "outcome": "争议在两周后降温",
                    "evidence_ids": ["s1"],
                    "comparability": "medium",
                    "confidence": "medium",
                },
                {
                    "id": "a2",
                    "title": "没有来源的相似案例",
                    "outcome": "据称效果很好",
                    "evidence_ids": ["missing"],
                    "comparability": "high",
                    "confidence": "high",
                },
            ],
            "counterfactuals": [
                {
                    "id": "cf1",
                    "premise": "如果没有发布争议规则",
                    "changed_condition": "争议规则未发布",
                    "baseline_outcome": "用户不满扩散",
                    "alternative_outcome": "短期冲突可能较弱",
                    "causal_chain": ["缺少直接刺激", "集中讨论减少"],
                    "assumptions": ["其他运营动作不变"],
                    "invalidation_signals": ["同期存在另一项强刺激事件"],
                    "evidence_ids": [],
                    "confidence": "high",
                }
            ],
            "quantitative_observations": [
                {
                    "id": "q1",
                    "metric_name": "公告发布时间",
                    "value": "2026-08-01 10:00",
                    "unit": "北京时间",
                    "status": "observed",
                    "methodology": "读取公告页面时间戳",
                    "evidence_ids": ["s1"],
                },
                {
                    "id": "q2",
                    "metric_name": "支持率",
                    "value": 63,
                    "unit": "%",
                    "status": "observed",
                    "evidence_ids": [],
                },
                {
                    "id": "q3",
                    "metric_name": "互动增幅",
                    "value": 2.5,
                    "unit": "倍",
                    "status": "derived",
                    "evidence_ids": ["s1"],
                    "formula": "",
                },
            ],
        }
    )

    assert ledger.schema_version == "1.2"
    assert ledger.analogues[0].confidence == "medium"
    assert ledger.analogues[1].confidence == "low"
    assert ledger.analogues[1].comparability == "unknown"
    assert ledger.counterfactuals[0].confidence == "low"
    assert ledger.counterfactuals[0].status == "insufficient"
    assert ledger.quantitative_observations[0].status == "observed"
    assert ledger.quantitative_observations[1].status == "unknown"
    assert ledger.quantitative_observations[1].value is None
    assert "缺少可核验来源" in ledger.quantitative_observations[1].caveats
    assert ledger.quantitative_observations[2].status == "unknown"
    assert ledger.quantitative_observations[2].value is None
    assert "派生值缺少透明公式" in ledger.quantitative_observations[2].caveats


def test_p2_adds_transparent_graph_counts_and_density():
    ledger = normalize_research_ledger(
        {
            "sources": [
                {"id": "s1", "title": "公告", "url": "https://example.com/a"}
            ],
            "nodes": [
                {"id": "a", "label": "A", "evidence_ids": ["s1"]},
                {"id": "b", "label": "B", "evidence_ids": ["s1"]},
                {"id": "c", "label": "C", "evidence_ids": ["s1"]},
            ],
            "relations": [
                {"id": "r1", "source_node": "a", "target_node": "b", "evidence_ids": ["s1"]},
                {"id": "r2", "source_node": "b", "target_node": "c", "evidence_ids": []},
            ],
        }
    )

    metrics = {item.id: item for item in ledger.quantitative_observations}
    assert metrics["system_actor_count"].value == 3
    assert metrics["system_relation_count"].value == 2
    assert metrics["system_evidenced_relation_count"].value == 1
    assert metrics["system_graph_density"].value == 0.333
    assert metrics["system_graph_density"].formula == "E / (N * (N - 1)) = 2 / (3 * 2)"
    assert all(item.status == "derived" for item in metrics.values())
    assert ledger.metrics.quantitative_observation_count == 4
    assert ledger.metrics.sourced_quantitative_rate == 1.0


def test_string_list_fields_are_not_split_into_individual_characters():
    ledger = normalize_research_ledger(
        {
            "claims": [
                {
                    "id": "c1",
                    "text": "待核验判断",
                    "confidence_reasons": "直接来自用户提供的材料。",
                    "evidence_ids": [],
                }
            ]
        }
    )

    assert ledger.claims[0].confidence_reasons == ["直接来自用户提供的材料。"]
