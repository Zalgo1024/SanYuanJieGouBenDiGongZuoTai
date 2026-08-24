import json

import pytest

from app.report_quality import evaluate_report_quality


def _valid_report() -> str:
    diagram = json.dumps(
        {
            "viz": "network",
            "title": "利益关系网络",
            "nodes": [
                {"id": "a", "label": "监管部门", "type": "political"},
                {"id": "b", "label": "经营主体", "type": "material"},
            ],
            "edges": [
                {"source": "a", "target": "b", "label": "监管", "type": "power"}
            ],
        },
        ensure_ascii=False,
    )
    return f"""# 测试事件的制度博弈分析

## 情况概述

这是一项围绕监管规则调整展开的事件，分析范围覆盖监管部门与经营主体之间的执行关系。核心结论是规则透明度决定协商成本。

事件表面是执行争议，实质是成本如何在主体之间重新分配。

## 案例事实摘要

1. 监管部门发布了新规则。（来源：正式公告）
2. 经营主体提出执行成本异议。（来源：行业说明）
3. 双方建立了反馈渠道。（来源：公开答复）

## 分析框架说明

本案不是一次普通争议，而是规则成本与解释权的重新分配。

## 利益主体识别

| 主体 | 角色 | 核心利益 | 成本 |
|---|---|---|---|
| 监管部门 | 规则制定者 | 执行稳定 | 解释成本 |
| 经营主体 | 规则承受者 | 经营连续 | 合规成本 |

## 利益动线与转化

监管要求转化为经营主体的合规成本，反馈又转化为规则修订压力。

## 核心冲突点

1. 【监管部门】对【经营主体】在【执行标准】上的张力：双方对边界理解不同。
2. 【经营主体】对【监管部门】在【合规成本】上的张力：成本承担与收益不对称。
3. 【监管部门】对【经营主体】在【反馈速度】上的张力：制度节奏慢于经营变化。

## 制度与叙事作用

正式规则提供执行依据，公开说明决定社会如何理解这项调整。

## 三元结构分析正文

### 监管部门的执行账

监管部门先维持规则稳定，再处理反馈压力，其行为由制度责任约束。

图 1 展示监管部门与经营主体之间的权力和成本关系。

```DIAGRAM
{diagram}
```

### 经营主体的成本账

经营主体争取的不是豁免，而是可预期的执行边界。

## 结论

### 汇流段

监管部门与经营主体并非只在争静态对错，而是在争同一规则下谁先承担成本、谁拥有解释权。

### 核心判断

本案的本质不是执行摩擦，而是制度成本与解释权的重新分配。

### 博弈终局预判

1. 规则解释将更公开（触发条件：反馈持续增加；影响：监管部门解释成本上升）。
2. 合规流程将被细化（触发条件：经营主体成本可量化；影响：执行预期改善）。
3. 协商机制将常态化（触发条件：争议重复出现；影响：双方冲突成本下降）。

## 行动建议

### 对监管部门

1. 公开执行口径，并保留复核渠道。
2. 建立反馈时限，约束解释周期。

### 对经营主体

1. 量化合规成本，并提交可核验材料。
2. 统一行业反馈，避免重复沟通。

## 附录

- [正式公告](https://example.com/notice)
- [行业说明](https://example.com/industry)
"""


def _codes(result, severity=None):
    return {
        issue.code
        for issue in result.issues
        if severity is None or issue.severity == severity
    }


def test_complete_report_passes_quality_gate():
    result = evaluate_report_quality(
        _valid_report(), analysis_type="case", used_web_sources=True
    )

    assert result.valid is True
    assert result.score == 100
    assert result.issues == []


@pytest.mark.parametrize(
    ("code", "mutate", "web"),
    [
        ("required_sections", lambda md: md.replace("## 利益动线与转化", "## 其他章节"), False),
        ("material_label", lambda md: md + "\n【联网抓取素材】原始段落", False),
        ("diagram_invalid", lambda md: md.replace("```DIAGRAM\n", "```DIAGRAM\nnot-json\n", 1), False),
        # conflict_count：阈值放宽到 2-6，删到只剩 1 条才触发 error
        ("conflict_count", lambda md: md.replace("2. 【经营主体】对【监管部门】在【合规成本】上的张力：成本承担与收益不对称。\n", "").replace("3. 【监管部门】对【经营主体】在【反馈速度】上的张力：制度节奏慢于经营变化。\n", ""), False),
        # conclusion_structure：mutate 要去掉"判断"关键词（新规则容忍 ### 一般判断 等含"判断"的标题）
        ("conclusion_structure", lambda md: md.replace("### 核心判断", "### 总览"), False),
        ("action_grouping", lambda md: md.replace("### 对监管部门", "监管部门：").replace("### 对经营主体", "经营主体："), False),
        ("source_links", lambda md: md.replace("[正式公告](https://example.com/notice)", "正式公告").replace("[行业说明](https://example.com/industry)", "行业说明"), True),
        ("figure_reference", lambda md: md.replace("图 1 展示", "下图展示"), False),
    ],
)
def test_each_hard_error_is_detected(code, mutate, web):
    result = evaluate_report_quality(
        mutate(_valid_report()), analysis_type="case", used_web_sources=web
    )

    assert result.valid is False
    assert code in _codes(result, "error")


@pytest.mark.parametrize(
    ("code", "mutate"),
    [
        # failure_placeholder 从 error 降级到 warning：合法上下文使用不应 block 生成
        ("failure_placeholder", lambda md: md + "\n（未提供关键主体，建议补充。）"),
        ("fact_count", lambda md: md.replace("3. 双方建立了反馈渠道。（来源：公开答复）\n", "")),
        ("overview_paragraphs", lambda md: md.replace("\n\n事件表面是执行争议，实质是成本如何在主体之间重新分配。", "")),
        ("generic_actors", lambda md: md.replace("监管部门", "有关部门").replace("经营主体", "相关方")),
        ("conclusion_actor_names", lambda md: md.replace("监管部门与经营主体并非只在争静态对错", "各方并非只在争静态对错", 1)),
        ("terminal_trigger", lambda md: md.replace("触发条件", "前提")),
        ("repeated_analysis", lambda md: md + "\n\n同一个结论不应在摘要、框架、正文和结论中反复换一种措辞重复出现，这会降低报告的信息密度。\n\n同一个结论不应在摘要、框架、正文和结论中反复换一种措辞重复出现，这会降低报告的信息密度。"),
    ],
)
def test_each_quality_warning_is_reported_without_blocking(code, mutate):
    result = evaluate_report_quality(
        mutate(_valid_report()), analysis_type="case", used_web_sources=False
    )

    assert result.valid is True
    assert code in _codes(result, "warning")
    assert result.score <= 95
