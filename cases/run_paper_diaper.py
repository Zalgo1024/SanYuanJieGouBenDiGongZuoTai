"""
案例脚本（深度重写版）— 符合国标的有毒纸尿裤：甲酰胺事件的多主体制度博弈分析
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from engine import CaseAnalysisEngine

TITLE = "符合国标的有毒纸尿裤：甲酰胺事件的多主体制度博弈分析"

BODY = r"""
## 一、案例事实摘要

2026年6月，《经济参考报》发布调查报告，称在"好奇""碧芭宝贝""Babycare"等多个知名品牌的婴幼儿纸尿裤中检出毒性物质甲酰胺。山东省公共卫生临床中心的医学检测进一步证实，多名婴幼儿血液和尿液中检出该物质，且成人样本中的检出率和检出量远低于婴幼儿，提示甲酰胺来源与纸尿裤高度相关。

关键事实：

- 检测品牌：好奇（Huggies）、碧芭宝贝、Babycare 等市场主流品牌
- 检出物质：甲酰胺（Formamide），长期接触可损伤肝肾功能、影响生殖系统
- 婴幼儿症状：反复红臀、皮肤破溃，停用后明显缓解
- 成人对照：成人血液样本中甲酰胺检出率和检出量远低于婴幼儿
- 国标空白：现行《纸尿裤 第1部分：婴儿纸尿裤》（GB/T 28004.1—2021）未设置甲酰胺检测项目和限量要求

各方回应：

- 涉事企业：多表示"产品符合国家标准"，未正面回应甲酰胺问题
- 检测专家：山东省公共卫生临床中心特聘主任于兆衍呼吁全行业排查，修订国标
- 监管部门：待核查
- 媒体：《经济参考报》率先曝光，引发全网关注

## 二、分析框架说明

**核心命题**：有毒纸尿裤事件不是个别企业的道德失守，而是制度设计系统性滞后于风险的必然结果。当"检测什么"的权力由行业主导时，被排除在国标之外的有毒物质就是行业的"合法排污口"。

## 三、利益主体识别

| 主体 | 在事件中的位置 | 核心诉求 |
|---|---|---|
| 生产企业 | 合规背书方 | 以最低成本维持生产，规避新增检测成本 |
| 家长/婴幼儿 | 风险承担方 | 购买安全产品，但无法律追责武器 |
| 监管部门 | 制度守门人 | 修订周期长，行业利益掣肘 |
| 检测专家 | 证据生产者 | 发现问题但无制度权力 |
| 媒体 | 舆论放大器 | 曝光问题但无法替代制度 |

五方利益合谋的结果，是"合法伤害"的制度缺口被系统性维持。

## 四、三元结构分析正文

### 1. 企业的成本账：我不知道，所以我没责任

甲酰胺不是纸尿裤的必需成分，它是生产过程中发泡剂或交联剂的残留物。这意味着企业完全可以通过更换原料或增加后处理工序来消除甲酰胺，但这会增加成本。

这就是制度设计的问题：当合规成本为零、安全成本为正时，市场不会自动选择安全。

企业不是道德败坏，它们是在现有制度激励下做出了最"理性"的选择。问题不在企业的良心，在制度让良心变成了成本。

```DIAGRAM
{"viz": "network", "title": "有毒纸尿裤事件全景利益关系图",
 "nodes": [
   {"id": "enterprise", "label": "生产企业(好奇等)", "type": "actor"},
   {"id": "parent", "label": "家长/婴幼儿", "type": "public"},
   {"id": "regulator", "label": "监管部门(国标委)", "type": "political"},
   {"id": "expert", "label": "检测专家", "type": "actor"},
   {"id": "media", "label": "经济参考报", "type": "identity_culture"},
   {"id": "standard", "label": "国标(无甲酰胺项)", "type": "institutional_future"},
   {"id": "safety", "label": "婴幼儿健康安全", "type": "security"}
 ],
 "edges": [
   {"source": "enterprise", "target": "standard", "label": "符合国标(合规)", "type": "legal"},
   {"source": "standard", "target": "safety", "label": "未覆盖甲酰胺", "type": "legal"},
   {"source": "enterprise", "target": "parent", "label": "销售含甲酰胺纸尿裤", "type": "economic"},
   {"source": "parent", "target": "safety", "label": "承担健康风险", "type": "security"},
   {"source": "expert", "target": "media", "label": "检测发现", "type": "cultural"},
   {"source": "media", "target": "regulator", "label": "舆论监督", "type": "cultural"},
   {"source": "regulator", "target": "standard", "label": "国标修订权", "type": "power"},
   {"source": "enterprise", "target": "safety", "label": "成本压缩→安全缺位", "type": "economic"}
 ]}
```

### 2. 家长的信任税：我买的明明是正规品牌

家长购买好奇、Babycare 等品牌，是基于对"大品牌=安全"的信任。这种信任不是盲目的，它是建立在"品牌有声誉要维护"和"国家标准能兜底"两个假设之上的。

这就是逆反失能的结构性根源：家长不是不想维权，是维权没有法律武器。国标没有规定甲酰胺限量，企业就没有违法；企业没有违法，消费者就无法追责。制度缺口把消费者的伤害变成了"合法伤害"。

家长购买的不是纸尿裤，是一份对制度的信任合同。当制度本身有漏洞时，信任合同就变成了单方面承担风险的卖身契。

```DIAGRAM
{"viz": "network", "title": "家长与婴幼儿视角：合法伤害的结构",
 "nodes": [
   {"id": "parent", "label": "家长/婴幼儿", "type": "public"},
   {"id": "enterprise", "label": "生产企业", "type": "actor"},
   {"id": "standard", "label": "国标漏洞", "type": "institutional_future"},
   {"id": "safety", "label": "健康损害", "type": "security"}
 ],
 "edges": [
   {"source": "enterprise", "target": "parent", "label": "销售含毒产品", "type": "economic"},
   {"source": "standard", "target": "enterprise", "label": "合规背书", "type": "legal"},
   {"source": "parent", "target": "safety", "label": "承担伤害", "type": "security"},
   {"source": "enterprise", "target": "safety", "label": "压缩安全成本", "type": "economic"}
 ]}
```

### 3. 监管的制度滞后：国标为什么没跟上

现行纸尿裤国标 GB/T 28004.1—2021 发布于2021年。甲酰胺在欧洲已被列为限制物质（欧盟REACH法规），但中国国标未纳入。

这套账本的结果是：制度更新的驱动力不是"确保安全"，而是"出事之后不得不改"。当一个有害物质没有被纳入国标时，它不是"被评估为无害"，而是"没有人去评估它"。两者在法律上等价，但在安全上完全不等价。

国标不是安全的天花板，而是安全的底线。但问题在于，当底线的制定跟不上工业技术的更新时，"符合国标"就成了一个骗人的话。

```DIAGRAM
{"viz": "network", "title": "监管视角：制度滞后的结构",
 "nodes": [
   {"id": "regulator", "label": "监管部门", "type": "political"},
   {"id": "enterprise", "label": "生产企业", "type": "actor"},
   {"id": "standard", "label": "国标(2年修订周期)", "type": "institutional_future"},
   {"id": "public", "label": "公众安全", "type": "public"},
   {"id": "media", "label": "媒体监督", "type": "identity_culture"}
 ],
 "edges": [
   {"source": "regulator", "target": "standard", "label": "制度制定", "type": "power"},
   {"source": "standard", "target": "enterprise", "label": "合规依据", "type": "legal"},
   {"source": "standard", "target": "public", "label": "安全底线性", "type": "security"},
   {"source": "media", "target": "regulator", "label": "舆论推动修订", "type": "cultural"},
   {"source": "enterprise", "target": "regulator", "label": "行业利益游说", "type": "power"}
 ]}
```

### 4. 检测专家的破局：我发现了，然后呢

山东省公共卫生临床中心的于兆衍团队做了两件事：一是从纸尿裤中检出甲酰胺，二是从婴幼儿血液中检出同一物质。这两组数据构成了完整的"来源—暴露—吸收"证据链。

专家发现了问题，媒体曝光了问题，但真正能解决问题的是制度修订，而修订需要时间、需要博弈、需要成本。在这个过程中，每一包卖出去的纸尿裤都带着甲酰胺。

### 5. 五方权力博弈：制度缺口如何被系统性维持

当五方利益放在一起：

- 企业：不想增加成本，不主动检测，用"符合国标"挡箭
- 消费者：受到伤害但无法追责，只能停用
- 监管：修订周期长，行业利益掣肘，被动等待出事推动
- 专家：发现问题但没有制度权力，只能通过媒体发声
- 媒体：可以推动舆论，但无法替代制度

没有人希望婴幼儿受到伤害。但每个人的利益计算合在一起，就产生了一个"合法伤害"的制度缺口。

这个缺口不是谁故意制造的，它是企业成本最小化（不检测）、制度更新滞后（修订周期长）、消费者维权无门（法律依据缺失）三个因素叠加的结果。每一个参与者都在自己的利益坐标系里做出了理性选择，但这些理性选择的合谋结果，就是非理性的公共安全后果。

## 五、结论

**汇流段**：有毒纸尿裤事件不是一家企业的道德事故，而是一套制度的系统性失败。国标没有要求检测甲酰胺，企业就不检测；企业不检测，消费者就无法追责；消费者无法追责，制度就没有修订的动力。这是一个闭合的"合法伤害"循环。打破这个循环需要外部力量，而每一次，这个外部力量都是已经受到伤害的消费者和愿意说真话的专家。

**核心判断**：纸尿裤的甲酰胺问题不是"企业违法"的问题，它是"合法但有毒"的问题。当"符合国标"和"安全无害"之间的差距足够大时，制度本身就成了伤害的帮凶。合规不是终点，安全才是，但问题是，当前的制度只考核合规，不考核安全。

> 国标应该是安全的下限，而不是行业的挡箭牌。当"符合国标"成为免罪金牌，国标就背叛了它存在的意义。

## 六、附录

数据来源：

- [经济参考报调查报道：多款纸尿裤被指侵害婴幼儿健康](http://www.jjckb.cn)
- [经济参考报官方微博转载（@经济参考报）](https://weibo.com)
- [现行国标 GB/T 28004.1—2021《纸尿裤 第1部分：婴儿纸尿裤》](http://www.sac.gov.cn)
- [欧盟 REACH 法规：甲酰胺（Formamide）限制要求](https://echa.europa.eu)

不确定性声明：本分析基于《经济参考报》公开调查报道及微博发布信息，部分细节（如涉事企业的具体内部回应、监管部门后续动作）以公开报道为准。

分析框架：三元结构理论 © 2026, CC BY-NC-SA 4.0，国作登字-2026-A-00048134
"""

if __name__ == "__main__":
    engine = CaseAnalysisEngine()
    result = engine.export_from_text(TITLE, BODY, overwrite=True)

    print("=" * 60)
    print("报告生成完成！")
    print(f"  Word:  {result['word']}")
    print(f"  PDF:   {result['pdf']}" if result['pdf'] else "  PDF:   未生成（请安装 LibreOffice 或 pandoc）")
    print(f"  目录:  {result['folder']}")
    diagrams = result.get("diagrams", [])
    if diagrams:
        print(f"  图表 ({len(diagrams)} 张):")
        for dd in diagrams:
            print(f"      {dd['title']}")
    else:
        print("  图表: 无")
    print("=" * 60)
