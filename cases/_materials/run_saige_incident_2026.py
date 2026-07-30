"""
西安赛格商户坠楼事件 — 三元结构理论案例分析报告

事件：2026年7月1日，西安赛格国际购物中心商户负责人严某坠楼身亡
来源：基于公开新闻报道与官方通报
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from typed_report import (
    FactSource, TimelineEntry, ConceptSelection,
    AnalysisSection, ThreePath,
    CaseReport,
    Stakeholder, ImpactEntry, TimeDimension,
    DimensionDiagnosis, InterestTypeAnalysis, InterestFlow,
    NarrativeAnalysis, InstitutionAnalysis, HistoricalDynamics,
)
from engine import CaseAnalysisEngine


# ═══════════════════════════════════════════════════════════════
# CaseReport 构建
# ═══════════════════════════════════════════════════════════════

case_report = CaseReport(
    title="规则之刃与生存之殇：西安赛格商户坠楼事件三元结构分析",

    # 一、事实摘要
    fact_summary="""
2021年，西安赛格国际购物中心店庆促销期间，商户陕西利和商贸有限公司（负责人严某）门店员工为促销量，将大额订单拆分为多笔结算以使用更多满减优惠券（俗称"拆券"）。该行为在当时属行业普遍做法，商场管理层巡场时默许。事后，商场单独对严某店铺开出1145.6万元罚单，并冻结千万级货款数月不予结算。

此后四年（2021-2026），严某多次向商场高层申诉，希望减免罚款、解冻货款，均无果。期间公司资金链断裂，从巅峰时期代理多个一线运动品牌、拥有400余家门店，萎缩至仅在赛格保留两家店铺。尽管困境，严某从未拖欠员工工资，被员工称为"像个老大哥一样"的老板。

2026年6月初，商场通知严某两家店铺因"经营不善"须在6月底前撤柜。6月26日，严某在朋友圈发文质问商场罚款合法性，称"赛格也没有这么大的执法罚款权"，随后删除。6月30日晚，五楼店铺被拆除，负一楼店铺被新品牌取代。7月1日12时10分，严某从赛格商场高处坠落，当场身亡。

7月2日，西安市雁塔区联合调查处置工作专班发布通报，确认坠楼者为赛格商场某商户负责人，已排除刑事案件，并成立由市场监管、商务、公安、司法等部门组成的联合调查组开展调查。
    """.strip(),

    fact_timeline=[
        TimelineEntry(date="2021年", event="赛格商场店庆促销，发放满减优惠券。严某门店员工实施'拆券'销售，属行业普遍做法，商场默许。"),
        TimelineEntry(date="2021年事后", event="商场单独对严某店铺开出1145.6万元罚单，冻结千万级货款数月。涉事员工被开除。"),
        TimelineEntry(date="2021-2026年", event="严某多次向商场高层申诉，希望减免罚款、解冻货款，均无果。公司资金链断裂，门店从400余家萎缩至2家。"),
        TimelineEntry(date="2026年6月初", event="商场通知严某：负一楼和五楼两家店铺因'经营不善'，6月底前必须撤柜。"),
        TimelineEntry(date="2026年6月26日", event="严某在朋友圈发文质问商场罚款合法性，称'赛格也没有这么大的执法罚款权'，随后删除。"),
        TimelineEntry(date="2026年6月30日", event="商场发出最后通牒，要求撤场。当晚五楼店铺被拆除，负一楼店铺被新品牌取代。"),
        TimelineEntry(date="2026年7月1日12:10", event="严某从赛格商场高处坠落，当场死亡。商场工作人员持围布遮挡现场。"),
        TimelineEntry(date="2026年7月2日", event="雁塔区联合调查处置工作专班发布通报，排除刑事案件，成立联合调查组。"),
    ],

    fact_sources=[
        FactSource(name="百度百科-7·1西安男子商场坠亡事件", url="https://baike.baidu.com/item/7%C2%B71%E8%A5%BF%E5%AE%89%E7%94%B7%E5%AD%90%E5%95%86%E5%9C%BA%E5%9D%A0%E4%BA%A1%E4%BA%8B%E4%BB%B6/68113788"),
        FactSource(name="腾讯新闻-西安赛格商户坠楼详情披露", url="https://news.qq.com/rain/a/20260702A08VWV00"),
        FactSource(name="搜狐-1145万罚单与商户坠亡", url="https://www.sohu.com/a/1044963118_100210476"),
        FactSource(name="搜狐-拆单用券被罚1145万", url="https://www.sohu.com/a/1044956070_122756350"),
    ],

    # 二、分析框架
    core_tension="大型商业体对规则的绝对制定权与解释权，与中小商户生存权之间的极端不对称",
    core_proposition="当商场既当运动员（促销组织者）又当裁判员（违规处罚者），且掌握合同续约、货款结算等全部权力时，商户几乎没有制度化救济渠道，悲剧具有结构性必然",

    concepts=[
        ConceptSelection(
            observed_pattern="商场在促销期间默许拆券行为，事后对单一商户追溯巨额处罚，同时冻结货款、终止合同",
            concept_name="选择性执法与规则武器化",
            how_it_explains="解释为什么商场可以在'大家都这么做'的情况下，只对特定商户开出毁灭性罚单——规则成为打压特定对象的工具",
            analysis_question="规则的制定者是否有权单方面定义违规、单方面量刑、单方面执行，而无需独立第三方仲裁？",
        ),
        ConceptSelection(
            observed_pattern="商户从400家门店萎缩至2家，最终在经营场所坠楼身亡，而商场年营收130亿继续运转",
            concept_name="力量不对称与结构性暴力",
            how_it_explains="解释为什么一个拥有2000名员工的企业家会在一个商业纠纷中被彻底碾碎——双方的经济体量、法律资源、议价能力完全不对等",
            analysis_question="当一方掌握另一方的全部生存命脉（货款、场地、规则解释权）时，商业契约是否还能保障弱势方的基本权利？",
        ),
        ConceptSelection(
            observed_pattern="拆券行为从'行业普遍做法'被重新定义为'严重违规'，公众舆论迅速站在商户一方",
            concept_name="叙事的翻转与合法性危机",
            how_it_explains="解释为什么商场试图以'维护规则'自我辩护，但公众完全不接受这一叙事——因为规则的执行方式本身已经摧毁了规则的合法性",
            analysis_question="当规则的执行方式比被禁止的行为更具破坏性时，规则本身是否还值得遵守？",
        ),
    ],

    # 三、事件对象图谱
    event_profile="""
**Who（谁）**：陕西利和商贸有限公司负责人严某（死者），赛格国际购物中心（商场方），涉事员工，2000余名员工，联合调查组
**When（何时）**：2021年拆券行为 → 2021年罚单 → 2021-2026年申诉 → 2026年6月30日撤店 → 2026年7月1日坠楼
**What（什么）**：因员工拆券使用优惠券，商户被罚款1145.6万元、冻结货款、强制撤店，最终负责人坠楼身亡
**Where（何地）**：西安赛格国际购物中心（年营收约130亿，西北地区单体规模最大的购物中心之一）
**Why（为何）**：商场称维护促销规则；商户称被针对、罚款不合理；公众称大欺小、逼死人
**How（如何）**：拆券（行业普遍做法）→ 选择性追责 → 巨额罚款 → 冻结货款 → 资金链断裂 → 撤店 → 绝望 → 坠楼
**How much（多少）**：罚款1145.6万元，冻结货款千万级，巅峰400余家门店，最终2家门店，2000余名员工
    """.strip(),

    event_stakeholders=[
        Stakeholder(
            name="严某（陕西利和商贸负责人）",
            role="受害者",
            identification="代理耐克、阿迪达斯等一线运动品牌的陕西头部代理商，曾拥有400余家门店，年销8.5亿元。对待员工宽厚，被称为'像个老大哥一样'，从未拖欠工资",
            interest="减免不合理罚款、解冻货款、继续经营、保障2000名员工生计",
            immediate_impact="失去全部身家，企业破产，个人死亡",
            long_term_impact="家庭破碎，员工失业，成为商业体压迫商户的标志性案例",
        ),
        Stakeholder(
            name="赛格国际购物中心",
            role="加害者/规则制定者",
            identification="年营收约130亿的西部商业巨兽，西北地区单体规模最大的购物中心之一，2013年开业，总建筑面积约25万平方米",
            interest="维护商场规则权威、收取罚款、引入新品牌获取更高租金或入驻费、消除'不听话'的商户",
            immediate_impact="面临政府联合调查、品牌形象严重受损、公众舆论谴责",
            long_term_impact="可能面临法律诉讼、商户信任危机、行业规则被迫调整",
        ),
        Stakeholder(
            name="陕西利和商贸员工（约2000人）",
            role="受损者/间接受害者",
            identification="分布在400余家门店（巅峰期）的销售人员、管理人员",
            interest="稳定工作、按时发放工资、职业发展",
            immediate_impact="福利下降，撤店后7人回家待岗，其余门店陆续关闭",
            long_term_impact="失业或转岗，失去一位善待员工的老板",
        ),
        Stakeholder(
            name="赛格商场其他商户",
            role="旁观者/潜在受害者",
            identification="同样实施过拆券但未受罚的商户，以及所有依赖赛格平台生存的中小商家",
            interest="正常经营、公平对待、不因 arbitrary 规则被处罚",
            immediate_impact="兔死狐悲，担心成为下一个严某",
            long_term_impact="可能集体要求规则透明化，或考虑撤离赛格平台",
        ),
        Stakeholder(
            name="雁塔区联合调查组",
            role="制度介入者",
            identification="由市场监管、商务、公安、司法等部门组成",
            interest="查明事实、维护社会稳定、回应公众关切",
            immediate_impact="启动调查程序，但结论尚未公布",
            long_term_impact="调查结果可能影响赛格品牌及商业地产行业规则",
        ),
        Stakeholder(
            name="消费者",
            role="间接受益者/间接受害者",
            identification="在赛格购物的普通消费者",
            interest="获得优惠价格、良好购物体验",
            immediate_impact="拆券被禁止后可能面临价格上涨；事件后对赛格品牌信任下降",
            long_term_impact="若赛格品牌受损，可能影响商场服务质量和竞争格局",
        ),
    ],

    event_social_impact=[
        ImpactEntry(level="直接影响", target="严某家庭", transmission_path="家庭支柱死亡 → 家庭经济崩溃 → 精神创伤"),
        ImpactEntry(level="直接影响", target="陕西利和商贸员工", transmission_path="企业破产 → 失业或转岗 → 收入中断"),
        ImpactEntry(level="间接影响", target="赛格商场品牌形象", transmission_path="负面舆论发酵 → 公众抵制情绪 → 客流量下降"),
        ImpactEntry(level="间接影响", target="西安商业地产行业", transmission_path="标志性悲剧事件 → 行业规则受质疑 → 政府可能出台监管措施"),
        ImpactEntry(level="潜在机会", target="中小商户权益保护", transmission_path="舆论关注 → 立法或行业自律机制建立 → 商户议价能力提升"),
    ],

    event_time_dimension=[
        TimeDimension(phase="短期", time_window="2026年7-12月", forecast="联合调查组公布结论；家属可能提起民事诉讼；舆论持续发酵；赛格采取危机公关措施"),
        TimeDimension(phase="中期", time_window="2027-2028年", forecast="若调查认定商场行为违法，可能面临赔偿和行政处罚；其他商户可能集体维权；商业地产行业规则可能调整"),
        TimeDimension(phase="长期", time_window="2029年以后", forecast="事件成为商业体与商户关系研究的典型案例；可能推动相关立法完善；赛格品牌能否恢复取决于其后续整改态度"),
    ],

    # 四、三元结构分析正文
    analysis_sections=[
        AnalysisSection(
            title="1. 生存维度：130亿巨兽面前的蝼蚁",
            body="""
生存维度分析的核心问题是：在这场博弈中，各方的基本生存权是否得到了保障？

从商户严某的视角看，答案是否定的。1145.6万元的罚款加上千万级货款的冻结，直接切断了一个拥有400家门店、2000名员工的企业的生命线。拆券行为本质上是一种促销手段——商场发放优惠券的目的是促进销售，员工拆券的目的是多卖货，顾客得到了实惠，商场获得了流水。这是一个多方共赢的行为，却被事后追溯为"严重违规"。

更关键的是，商场作为民事主体，本不具备行政处罚权。律师指出，所谓的"罚单"在法律上只能被解释为违约金，而违约金的支付以合同约定为前提，即使有约定，当事人也有权请求法院调整过高的违约金。但严某没有走法律途径——或者说，他走了四年的申诉途径，但全部失败。为什么？因为商场掌握着他的货款、他的场地、他的生存命脉。一场官司可能拖两三年，而他的企业等不起。

从商场的视角看，维护规则是其正当权利。但问题在于，规则的执行必须是普遍的、一致的、可预期的。如果"大家都拆券，只有他被罚"，那么规则就不是规则，而是武器。

从员工和公众的视角看，这是一个"大欺小"的经典叙事。130亿对8.5亿（巅峰期），不对等的力量导致了不对等的结果。严某在绝境中依然撑住了2000多名员工的工资，这让他获得了广泛的同情。公众不问法律细节，只问一个简单的问题："有必要把人逼死吗？"
            """.strip(),
            three_paths=ThreePath(
                path_a_condition="若联合调查组认定商场罚款及货款冻结行为违法",
                path_a_behavior="商场被迫退还罚款、赔偿损失，相关责任人被追责",
                path_a_result="严某家属获得经济赔偿，但人死不能复生；商场品牌形象严重受损；可能成为推动商业地产行业规则改革的契机",
                path_b_condition="若调查组认定商场行为在合同框架内合法，但存在不合理之处",
                path_b_behavior="商场与家属达成和解，赔偿部分损失；商场调整内部管理规则",
                path_b_result="悲剧被淡化处理，公众注意力转移；类似事件可能在其他商场重演；中小商户处境无实质性改善",
                path_c_condition="若调查不了了之，或认定商场完全合法",
                path_c_behavior="商场继续原有做法，可能对其他商户采取类似手段；家属继续法律维权",
                path_c_result="公众信任进一步崩塌；其他商户人人自危；可能引发更大规模的集体维权或舆论风暴",
                synthesis="无论调查结果如何，这起事件已经暴露了中国商业地产中商户权益保护的系统性缺失。单靠个案调查无法解决结构性问题，需要行业规则、法律框架、仲裁机制的多重改革。",
            ),
            sub_conclusion="生存维度的极端失衡是这场悲剧的根本原因。当一方掌握另一方的全部生存命脉时，契约自由就变成了契约奴役。",
            diagram={
                "viz": "network",
                "title": "130亿巨兽与蝼蚁——生存维度的力量悬殊",
                "nodes": [
                    {"id": "a", "label": "赛格商场\n年营收130亿", "type": "political"},
                    {"id": "b", "label": "严某\n巅峰年销8.5亿\n→萎缩至2店", "type": "actor"},
                    {"id": "c", "label": "罚款1145.6万\n=23年利润", "type": "material"},
                    {"id": "d", "label": "冻结货款\n千万级", "type": "material"},
                    {"id": "e", "label": "其他拆券商户\n未被处罚", "type": "actor"},
                    {"id": "f", "label": "2000名员工\n生计依赖", "type": "actor"},
                ],
                "edges": [
                    {"source": "a", "target": "c", "label": "选择性开出罚单", "type": "power"},
                    {"source": "c", "target": "b", "label": "=5-23年利润\n生存摧毁", "type": "economic"},
                    {"source": "a", "target": "d", "label": "持续冻结数月", "type": "economic"},
                    {"source": "d", "target": "b", "label": "资金链断裂", "type": "economic"},
                    {"source": "a", "target": "e", "label": "同样拆券\n默许不罚", "type": "power"},
                    {"source": "b", "target": "f", "label": "从未拖欠工资", "type": "economic"},
                    {"source": "a", "target": "b", "label": "掌握货款+场地+规则\n=全部生存命脉", "type": "power"},
                ],
            },
        ),
        AnalysisSection(
            title="2. 繁殖维度：谁在进行繁殖，谁被剥夺了繁殖权？",
            body="""
繁殖维度分析的核心问题是：在这场博弈中，谁获得了扩张和发展的机会，谁被剥夺了繁衍和复制的能力？

赛格商场无疑是繁殖的赢家。年营收130亿，总建筑面积25万平方米，它是西北地区单体规模最大的购物中心之一。在严某坠楼当天，商场照常营业；在他坠楼后不久，他的店铺已经被新品牌取代。商场的繁殖机器没有因为一个人的死亡而停顿一秒。

但我们需要问：商场的繁殖是以什么为代价的？严某从400家门店萎缩至2家，这不是市场竞争的结果，而是规则武器化的结果。如果拆券真的是"严重违规"，那么所有实施过拆券的商户都应该受到处罚。但事实是，只有严某受到了毁灭性打击。这让人不得不怀疑：商场的繁殖，是否部分建立在对特定商户的系统性掠夺之上？

从更宏观的视角看，中国商业地产正在经历一个从"培育商户"到"收割商户"的周期转换。在早期，商场需要吸引优质商户入驻，双方是共生关系；但当商场成为流量寡头，商户变成可替换的零件时，关系就变成了寄生关系。赛格可以在一天之内撤掉严某的店铺并引入新品牌，这说明在商场的繁殖逻辑中，单个商户的价值接近于零。

但商场忽略了一个重要的事实：商户不是零件，人不是数字。严某的2000名员工、他的家庭、他的合作伙伴，构成了一个复杂的社会网络。当这个网络被强行切断时，产生的社会成本远远超过了1145.6万元的罚款。
            """.strip(),
            three_paths=ThreePath(
                path_a_condition="若事件引发行业规则改革，建立商户权益保护机制",
                path_a_behavior="商场与商户关系从寄生转向共生；合同续约、罚款、货款结算引入独立仲裁机制",
                path_a_result="商场长期竞争力提升（商户稳定性增加）；中小商户生存空间扩大；行业生态更健康",
                path_b_condition="若事件仅引发短期舆论风暴，无制度性改变",
                path_b_behavior="商场继续原有模式，可能更加谨慎地避免极端案例；其他商场观望",
                path_b_result="悲剧被遗忘；商户权益保护无实质进展；下一个严某可能在其他商场出现",
                path_c_condition="若商场采取更强硬的危机公关和法务手段",
                path_c_behavior="打压舆论、威胁其他商户、加强合同条款",
                path_c_result="商户处境进一步恶化；可能引发更大规模的社会反弹；商场品牌长期受损",
                synthesis="繁殖维度揭示了商业地产的权力结构：商场是平台，商户是依附者。当平台垄断了流量和规则，依附者就变成了可以被随意替换的零件。改变这种结构，需要制度层面的干预，而非仅靠道德谴责。",
            ),
            sub_conclusion="繁殖维度的分析揭示了商业地产生态中的寄生关系。商场的扩张不应建立在对商户的系统性剥夺之上，否则整个生态终将崩溃。",
            diagram={
                "viz": "network",
                "title": "从共生到寄生——商业地产的繁殖权力结构",
                "nodes": [
                    {"id": "a", "label": "赛格商场\n25万㎡/130亿", "type": "political"},
                    {"id": "b", "label": "严某\n400店→2店", "type": "actor"},
                    {"id": "c", "label": "新品牌\n当天取代", "type": "actor"},
                    {"id": "d", "label": "其他商户\n兔死狐悲", "type": "actor"},
                    {"id": "e", "label": "流量垄断\n商户可替换", "type": "material"},
                    {"id": "f", "label": "培育期→收割期\n周期转换", "type": "material"},
                ],
                "edges": [
                    {"source": "a", "target": "e", "label": "垄断流量与规则", "type": "power"},
                    {"source": "e", "target": "b", "label": "从共生变寄生\n价值归零", "type": "economic"},
                    {"source": "a", "target": "b", "label": "一天撤店\n400→2", "type": "power"},
                    {"source": "a", "target": "c", "label": "立即引入\n无缝替换", "type": "economic"},
                    {"source": "b", "target": "d", "label": "前车之鉴\n人人自危", "type": "power"},
                    {"source": "f", "target": "a", "label": "从培育到收割\n权力反转", "type": "material"},
                ],
            },
        ),
        AnalysisSection(
            title="3. 反抗维度：从申诉到朋友圈，再到一跃而下",
            body="""
反抗维度分析的核心问题是：在这场力量极端不对称的博弈中，弱势方采取了哪些反抗策略，为什么这些策略都失败了？

严某的反抗经历了三个阶段：

**第一阶段：制度化反抗（2021-2026年）**
严某多次向商场高层申诉，希望减免罚款、解冻货款。这是一种典型的制度化反抗——在对方设定的规则框架内寻求救济。但结果是"均无果"。为什么？因为商场既是规则的制定者，又是规则的执行者，还是规则的仲裁者。在运动员和裁判员是同一个人的比赛中，申诉注定是徒劳的。

**第二阶段：舆论反抗（2026年6月26日）**
严某在朋友圈发文，质问商场"难道赛格把人逼死才能解决这个事吗？"这是一种舆论反抗——试图通过公开曝光来施压。但这条朋友圈很快被删除。舆论反抗的弱点在于：发布者自身就是弱势方，而对方掌握着更多的舆论资源和法律资源。一条朋友圈无法改变130亿商业帝国的决策。

**第三阶段：终极反抗（2026年7月1日）**
严某选择了最惨烈的方式——从商场高处坠落。这是一种以生命为代价的终极反抗。他的死亡最终引发了政府联合调查和社会舆论的广泛关注。讽刺的是，四年的申诉不如一条人命更能引起关注。

从反抗理论的角度看，严某的案例完美地印证了詹姆斯·斯科特的"弱者的武器"理论：当制度化渠道被堵死、公开反抗风险太大时，弱者只能选择隐藏的、个体化的反抗形式。但严某甚至连"隐藏的反抗"都无法实施——因为他的货款被冻结、店铺被撤除，他失去了所有反抗的资源。最终，他只能以自己的身体作为最后的武器。

这一跃，是对一个商业帝国的最强烈的控诉，也是对一个制度缺陷的最悲凉的证词。
            """.strip(),
            three_paths=ThreePath(
                path_a_condition="若联合调查组认真调查并追究商场责任",
                path_a_behavior="商场面临法律制裁和舆论压力，被迫改变做法",
                path_a_result="严某的死亡成为推动制度改革的催化剂；其他商户获得制度化救济渠道；悲剧产生积极的社会意义",
                path_b_condition="若调查轻描淡写，仅做表面文章",
                path_b_behavior="商场付出少量赔偿或公关费用，继续原有模式",
                path_b_result="严某的死亡被浪费；其他商户失去希望；公众对制度和商业伦理的信任进一步崩塌",
                path_c_condition="若商场利用法律漏洞完全脱责",
                path_c_behavior="商场更加肆无忌惮；可能对其他商户采取更激进手段",
                path_c_result="商户权益保护倒退；可能出现更多极端案例；社会矛盾积累",
                synthesis="反抗维度的分析揭示了一个残酷的现实：在力量极端不对称的博弈中，弱势方的制度化反抗和舆论反抗往往无效，只有极端的、悲剧性的反抗才能引起关注。这是制度缺陷的悲哀，也是社会公正的耻辱。",
            ),
            sub_conclusion="反抗维度的分析表明，当制度化救济渠道被堵死时，弱势方的反抗会从理性走向绝望，从制度内走向制度外，最终走向自我毁灭。改变这种局面的唯一办法，是建立独立、公正、可预期的第三方仲裁机制。",
            diagram={
                "viz": "network",
                "title": "从申诉到一跃而下——反抗的三阶段与管道堵塞",
                "nodes": [
                    {"id": "a", "label": "赛格商场\n立法者+执法者+裁判者", "type": "political"},
                    {"id": "b", "label": "严某\n四年抗争", "type": "actor"},
                    {"id": "c", "label": "阶段1：内部申诉\n4年均无果", "type": "material"},
                    {"id": "d", "label": "阶段2：朋友圈发声\n被迫删除", "type": "material"},
                    {"id": "e", "label": "阶段3：以命发声\n7.1坠楼", "type": "material"},
                    {"id": "f", "label": "外部司法\n诉讼成本过高", "type": "actor"},
                    {"id": "g", "label": "联合调查组\n死后才介入", "type": "actor"},
                ],
                "edges": [
                    {"source": "b", "target": "c", "label": "制度化反抗", "type": "power"},
                    {"source": "c", "target": "a", "label": "申诉→自己裁定→驳回\n闭环死路", "type": "power"},
                    {"source": "b", "target": "d", "label": "舆论反抗", "type": "power"},
                    {"source": "d", "target": "d", "label": "弱势方发声\n被压制删除", "type": "power"},
                    {"source": "b", "target": "f", "label": "想走法律途径\n但等不起", "type": "legal"},
                    {"source": "f", "target": "a", "label": "赛格法律资源\n碾压式优势", "type": "legal"},
                    {"source": "b", "target": "e", "label": "终极反抗\n身体作为武器", "type": "power"},
                    {"source": "e", "target": "g", "label": "一条命>四年申诉\n才引发介入", "type": "power"},
                ],
            },
        ),
    ],

    # 五、核心判断
    core_judgment="""
**事件本质**：这是一起由商业规则武器化引发的结构性悲剧。西安赛格国际购物中心利用其对规则的解释权、处罚权、货款结算权和合同续约权，对单一商户实施了毁灭性打击，最终导致商户负责人坠楼身亡。

**悲剧根源**：
1. **权力绝对化**：商场集规则制定、执行、仲裁于一身，商户没有任何制衡手段
2. **选择性执法**：拆券是行业普遍做法，但只有严某受到处罚，规则成为打压工具
3. **救济渠道缺失**：四年的申诉无果，法律途径成本太高、周期太长，商户等不起
4. **力量不对称**：130亿对8.5亿（巅峰期），双方在经济资源、法律资源、议价能力上完全不对等

**核心结论**：
这不是一个孤立的商业纠纷，而是中国商业地产生态中系统性问题的缩影。当大型商业体可以单方面定义违规、单方面量刑、单方面执行，而商户没有任何独立救济渠道时，类似的悲剧将不可避免地再次发生。

严某的死亡，是这个畸形生态的牺牲品，也是对其最强烈的控诉。
    """.strip(),

    golden_sentence="在130亿面前，一个商户的声音能有多大？当规则可以由一方随意制定、随意解释、随意执行的时候，另一方的活路在哪里？",

    # 六、深度分析
    dimension_diagnosis=DimensionDiagnosis(
        primary_dimension="生存维度",
        secondary_dimensions=["反抗维度", "繁殖维度"],
        diagnosis_rationale="这起事件的核心冲突是商户的基本生存权（经营、资金、员工工资）与商场的绝对权力（罚款、冻结货款、撤店）之间的极端失衡。严某从400家门店萎缩至2家，最终失去生命，这是生存维度被完全压制的典型表现。反抗维度（四年申诉无果）和繁殖维度（商场继续扩张，商户被替换）是生存维度失衡的直接后果。",
    ),

    interest_analysis=[
        InterestTypeAnalysis(
            interest_type="直接经济利益",
            which_entity="赛格商场",
            specific_content="1145.6万元罚款 + 千万级货款冻结 + 新品牌入驻费/更高租金",
            scale="对商场而言是九牛一毛（占年营收130亿的不到0.1%），对商户而言是灭顶之灾",
        ),
        InterestTypeAnalysis(
            interest_type="象征利益（权威维护）",
            which_entity="赛格商场",
            specific_content="通过惩罚'违规'商户树立规则权威，向其他商户传递'不听话就会被收拾'的信号",
            scale="无形的但长期的——决定了商场对商户的控制力",
        ),
        InterestTypeAnalysis(
            interest_type="生存利益",
            which_entity="严某及员工",
            specific_content="企业经营权、货款使用权、员工就业权、个人生存权",
            scale="全部丧失——企业破产、个人死亡、员工失业",
        ),
        InterestTypeAnalysis(
            interest_type="间接受益",
            which_entity="消费者",
            specific_content="拆券期间获得价格优惠；事件后可能获得更公平的购物环境（若规则改革）",
            scale="微小但广泛",
        ),
    ],

    flow_tracking=[
        InterestFlow(
            source="赛格商场（促销活动组织者）",
            target="商户（促销执行者）",
            path_type="正向激励",
            item="满减优惠券",
            trigger="店庆促销",
            outcome="商户多卖货，顾客得实惠，商场获流水",
        ),
        InterestFlow(
            source="商户员工",
            target="顾客",
            path_type="操作技巧",
            item="拆券（拆分订单使用多张优惠券）",
            trigger="促销KPI压力",
            outcome="顾客省更多钱，员工完成销售任务",
        ),
        InterestFlow(
            source="赛格商场（规则执行者）",
            target="严某商户",
            path_type="惩罚性转移",
            item="1145.6万元罚款",
            trigger="商场事后追溯认定'严重违规'",
            outcome="商户资金链断裂，经营陷入困境",
        ),
        InterestFlow(
            source="赛格商场（货款结算方）",
            target="赛格商场自身",
            path_type="非法占有",
            item="千万级货款冻结",
            trigger="商场单方面决定",
            outcome="商户无钱进货，无法正常经营",
        ),
        InterestFlow(
            source="赛格商场（场地出租方）",
            target="新品牌商户",
            path_type="资源重新配置",
            item="撤店后的场地",
            trigger="合同到期不续约",
            outcome="新品牌入驻，商场可能获得更高租金或入驻费",
        ),
        InterestFlow(
            source="严某（绝望中的最后反抗）",
            target="社会公众/政府",
            path_type="悲剧性曝光",
            item="生命",
            trigger="四年申诉无果，店铺被撤，走投无路",
            outcome="引发政府联合调查和社会舆论风暴",
        ),
    ],

    narrative_analysis=NarrativeAnalysis(
        dominant_narrative="商场叙事：'维护促销规则，打击违规行为，保护公平的商业环境'",
        narrator="赛格商场管理层及公关团队",
        channel="官方通报、法律文件、合同条款",
        counter_narrative="商户/公众叙事：'大欺小，选择性执法，利用规则武器化打压商户，最终导致人死'",
        legitimacy_effect="商场叙事在法律框架内可能站得住脚（若合同有约定），但在道德和公众认知层面完全失败。'大家都拆券，只有他被罚'这一事实，彻底摧毁了商场叙事的合法性。",
    ),

    institution_analysis=InstitutionAnalysis(
        relevant_institution="商业地产租赁合同制度 + 商场内部管理规则 + 商业纠纷仲裁机制",
        function="理论上应保障双方权益，实现公平竞争；实际上，合同条款往往由商场单方面制定，商户没有议价能力",
        path_dependency="中国商业地产从'培育期'进入'收割期'，商场从需要吸引商户转变为可以挑选商户，权力天平严重倾斜",
        winners="大型商业体（流量寡头）、新入驻品牌（可能支付更高费用）",
        losers="中小商户、被处罚商户的员工、商业生态的多样性",
    ),

    historical_dynamics=HistoricalDynamics(
        incentive_constraint="商场有强烈的动机利用规则武器化来清除'不听话'的商户或引入支付更高租金的新品牌；商户没有制衡手段，只能接受或退出",
        embedding_institutionalization="这种'商场绝对权力'的模式已经嵌入到中国商业地产的运营逻辑中，成为行业潜规则。没有外部制度干预，很难自我纠正",
        legitimation_narrativization="商场试图以'维护规则'来合法化其行为，但选择性执法和巨额罚款暴露了其真实动机。公众完全不接受这一叙事",
        chain_spillover="这起事件可能引发连锁反应：其他商户维权、政府出台监管措施、消费者抵制、行业规则调整",
    ),

    # 七、博弈终局预判
    endgame_direction="收敛与制度调整（事件引发政府调查，短期内舆论持续发酵，中期可能推动行业规则改革，长期取决于调查结论和商场整改态度）",
    endgame_key_nodes=[
        "联合调查组结论公布（罚款合法性、货款冻结合法性、撤店程序合法性）",
        "家属是否提起民事诉讼及赔偿金额",
        "赛格商场是否调整内部管理规则和商户申诉机制",
        "其他商户是否集体维权或要求规则透明化",
        "政府是否出台商业地产商户权益保护相关指导意见或法规",
        "赛格品牌形象恢复情况及客流量变化",
        "事件是否成为中国商业地产行业规则的转折点",
    ],

    # 八、附录
    appendix_sources=[
        FactSource(name="百度百科-7·1西安男子商场坠亡事件", url="https://baike.baidu.com/item/7%C2%B71%E8%A5%BF%E5%AE%89%E7%94%B7%E5%AD%90%E5%95%86%E5%9C%BA%E5%9D%A0%E4%BA%A1%E4%BA%8B%E4%BB%B6/68113788", date="2026-07-02"),
        FactSource(name="腾讯新闻-西安赛格商户坠楼详情披露", url="https://news.qq.com/rain/a/20260702A08VWV00", date="2026-07-02"),
        FactSource(name="搜狐-1145万罚单与商户坠亡", url="https://www.sohu.com/a/1044963118_100210476", date="2026-07-02"),
        FactSource(name="搜狐-拆单用券被罚1145万", url="https://www.sohu.com/a/1044956070_122756350", date="2026-07-02"),
        FactSource(name="腾讯新闻-60岁商户在西安赛格跳楼", url="https://news.qq.com/rain/a/20260703A09ST100", date="2026-07-03"),
        FactSource(name="搜狐-西安赛格商户坠楼事件", url="https://www.sohu.com/a/1044877970_120094090", date="2026-07-02"),
    ],
)


# ═══════════════════════════════════════════════════════════════
# 执行区
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    engine = CaseAnalysisEngine()
    try:
        result = engine.export_from_typed(case_report)
        print("=" * 60)
        print("报告生成完成！")
        print(f"  Word: {result['word']}")
        if result['pdf']:
            print(f"  PDF:  {result['pdf']}")
        else:
            print("  PDF:  未生成（需安装 LibreOffice）")
        print(f"  目录: {result['folder']}")
        diagrams = result.get("diagrams", [])
        if diagrams:
            print(f"  图表 ({len(diagrams)} 张):")
            for d in diagrams:
                print(f"    - {d['title']}")
        print("=" * 60)
    except ValueError as e:
        print("=" * 60)
        print("❌ 报告校验未通过，无法生成：")
        print(e)
        print("=" * 60)
        sys.exit(1)
