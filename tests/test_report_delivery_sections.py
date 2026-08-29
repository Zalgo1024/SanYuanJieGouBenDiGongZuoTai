from docx import Document

from engine import CaseAnalysisEngine


def test_event_delivery_sections_are_not_dropped_from_word_output(tmp_path):
    body = """# 章节交付测试

## 情况概述

这是一段交代范围与结论的自然概述。

## 案例事实摘要

1. 一条可核验事实。（来源：测试来源）

## 分析框架说明

本案不是表面争执，而是利益计价顺序的冲突。

## 利益主体识别

| 主体 | 角色 | 核心利益 | 成本 |
|---|---|---|---|
| 甲方 | 决策方 | 资源 | 声誉 |

## 利益动线与转化

甲方与乙方围绕资源配置形成交换关系。

## 核心冲突点

1. 【甲方】对【乙方】在【资源配置】上的张力：双方对成本承担的预期不同。
2. 【乙方】对【平台】在【执行边界】上的张力：执行速度与申诉空间冲突。
3. 【平台】对【公众】在【解释权】上的张力：规则透明度影响接受度。

## 三元结构分析正文

### 甲方的成本账

甲方不是单纯追求效率，而是在既有约束下重新配置成本。

```DIAGRAM
{"viz":"network","title":"关系网络","nodes":[{"id":"a","label":"甲方","type":"actor"},{"id":"b","label":"乙方","type":"actor"}],"edges":[{"source":"a","target":"b","label":"交换","type":"economic"}]}
```

图 1 展示了甲方与乙方之间的主要交换关系。

## 结论

### 汇流段

甲方、乙方与平台并非争论静态对错，而是在争成本由谁先承担。

### 核心判断

本案的本质不是执行分歧，而是规则中的利益计价顺序。

### 博弈终局预判

1. 规则公开后，乙方申诉成本下降。
2. 甲方补充解释后，公众疑虑减弱。
3. 平台复核常态化后，冲突转入制度协商。

## 行动建议

- 对甲方：公开规则边界，并保留复核记录。
- 对平台：设置独立申诉通道，并按月披露处理数据。

## 附录

[测试来源](https://example.com/source)
"""
    result = CaseAnalysisEngine().export_from_text(
        "章节交付测试", body, output_dir=str(tmp_path), slug="delivery-sections"
    )
    document = Document(result["word"])
    text = "\n".join(paragraph.text for paragraph in document.paragraphs)

    assert "情况概述" in text
    assert "核心冲突点" in text
    assert "行动建议" in text
