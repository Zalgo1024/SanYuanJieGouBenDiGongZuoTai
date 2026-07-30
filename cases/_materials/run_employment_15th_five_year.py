"""
《实施就业优先战略“十五五”规划》政策分析 — 强类型 PolicyReport 版
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from typed_report import (
    PolicyReport, PolicyLevel, PolicySystem, EndgameDirection,
    ActorRole, ClauseNature, ClausePrecision,
    FactSource, TimelineEntry, ConceptSelection, ActorInfo,
    ClauseAnalysis, ThreePath, AnalysisSection, IndustryImpact, TimeDimension,
)
from engine import CaseAnalysisEngine


# ── 事实摘要 ─────────────────────────────────────────────────

fact_summary = (
    "国务院印发《实施就业优先战略“十五五”规划》，"
    "作为“十五五”（2026-2030年）专项规划体系的重要组成部分。"
    "这是继“十四五”就业促进规划（国发〔2021〕14号）之后，"
    "就业领域第二个五年专项规划。\n\n"
    "时间背景：2025年城镇新增就业1267万人，城镇调查失业率平均5.2%；"
    "“十四五”期间年均城镇新增就业超过1200万人；"
    "2026年政府工作报告提出“就业数据是硬指标”。\n\n"
    "政策背景：2023年起中国进入人口负增长，劳动年龄人口持续下降；"
    "AI和自动化对中等技能岗位的替代效应开始显现；"
    "灵活就业人口超过2亿，但社会保障覆盖率不足；"
    "高校毕业生规模持续创历史新高，2026年预计超过1200万人。"
)

fact_timeline = [
    TimelineEntry(date="2023年", event="中国进入人口负增长，劳动年龄人口持续下降"),
    TimelineEntry(date="2025年", event="城镇新增就业1267万人，“十四五”年均超1200万"),
    TimelineEntry(date="2026年", event="高校毕业生预计超1200万人，“十五五”就业优先战略规划发布"),
]

fact_sources = [
    FactSource(name="中国政府网 2026年：国务院政策文件库", url="https://www.gov.cn/zhengce/xxgk/"),
    FactSource(name="新华社 2026年3月5日：李强作政府工作报告", url="https://www.xinhuanet.com/"),
    FactSource(name="人社部 2024-2025年：就业工作统计数据", url="https://www.mohrss.gov.cn/"),
]

# ── 分析框架 ─────────────────────────────────────────────────

core_tension = (
    "就业优先战略要在劳动力“量减质升”的结构性转型期发挥作用——"
    "就业人口总量在下降，但特定群体的就业压力在上升。"
    "如何在总盘子缩小的同时让最需要工作的人找到工作，是这个规划的根本难题。"
)

core_proposition = (
    "本次规划的核心任务不是“创造更多岗位”——总量上的就业压力正在缓解——"
    "而是“让岗位与人匹配得更精准”，同时为灵活就业者建立制度安全网。"
)

concepts = [
    ConceptSelection(
        observed_pattern="劳动力总量下降但青年失业率高企——总量缓和与结构紧张的矛盾",
        concept_name="成本-收益核算",
        how_it_explains="企业的招聘成本收益核算在变化：招一个年轻人的培训成本高、留存率低，招一个有经验的中年人更划算。结果是岗位不缺但缺“合适的人”",
        analysis_question="为什么就业总量压力缓解但特定群体的就业反而更难？",
    ),
    ConceptSelection(
        observed_pattern="灵活就业规模扩大但社保覆盖滞后——新就业形态的制度缺口在扩大",
        concept_name="制度管道",
        how_it_explains="传统就业制度管道（劳动合同+社保）是为“一个雇主一份工作”设计的，但新就业形态是多平台、零工化、非标准的。旧管道装不下新形态",
        analysis_question="制度管道如何扩容来容纳灵活就业？扩容的成本由谁承担？",
    ),
    ConceptSelection(
        observed_pattern="技术进步（AI/自动化）既消灭岗位也创造岗位——但消灭和创造的速度不匹配，创造的岗位技能要求更高",
        concept_name="激励-约束",
        how_it_explains="企业采用AI的激励很强（降本增效），但被替代的劳动力的再就业约束很紧（技能不匹配、年龄偏大、转行成本高）。激励快于约束，政策需要拉平这个差距",
        analysis_question="技术进步创造的岗位和消灭的岗位是否在同一群体身上？如果不在，中间缺失的“过渡桥”是什么？",
    ),
]

# ── 政策对象图谱 ───────────────────────────────────────────────

policy_name = "《实施就业优先战略“十五五”规划》"
policy_date = "2026年"
policy_type = "专项规划（行政法规级指导文件）"
policy_scope = "全国"

issuer_description = (
    "国务院是规划的发布机关，人力资源和社会保障部是牵头起草和主要执行部门。"
    "从“十四五”就业促进规划到“十五五”就业优先战略规划的名称变化——"
    "“促进”改为“优先战略”——反映了就业政策在政府议程中的权重提升。"
)

actors = [
    ActorInfo(
        name="国务院、人力资源和社会保障部",
        role=ActorRole.POLICY_ISSUER,
        identification="规划发布机关和牵头执行部门",
        interest="总量压力缓解但结构性压力加大——“优先战略”升级意味着就业指标在绩效考核中权重提升",
        immediate_impact="就业指标从“软约束”尝试升级为“硬约束”，地方政府执行压力增加",
        long_term_impact="灵活就业社保制度建立，技能培训从供给驱动转向需求驱动",
        interest_impact="政策工具箱扩充但执行效果取决于地方考核机制设计",
    ),
    ActorInfo(
        name="高校毕业生、技能培训受益者、灵活就业平台企业",
        role=ActorRole.BENEFICIARY,
        identification="政策明确扶持的群体和行业",
        interest="就业质量提升（毕业生）；再培训补贴（技能培训者）；灵活就业制度化（平台企业）",
        immediate_impact="国企和事业单位招聘名额保持；产教融合培训启动；平台企业获得合法性认可",
        long_term_impact="市场化就业渠道和创业扶持扩大；平台面临更高合规要求（社保缴纳、劳动保护）",
        interest_impact="政策资源直接注入，但需承担配套合规义务",
    ),
    ActorInfo(
        name="低技能中年劳动者、传统中介和派遣机构",
        role=ActorRole.LOSER,
        identification="AI替代的主要受害者 + 制度管道收窄的机构",
        interest="维持现有岗位和收入（劳动者）；维持中介角色（派遣机构）",
        immediate_impact="中等技能岗位被AI替代；再培训效果受学习能力和年龄制约；中介“润滑剂”角色被削弱",
        long_term_impact="需“降维转型”到高接触性服务岗位；中介需转型为“能力匹配”服务",
        interest_impact="三重压力叠加（年龄+技能+制度变化），覆盖最弱",
    ),
    ActorInfo(
        name="已退休人员、自愿退出劳动力市场者",
        role=ActorRole.UNAFFECTED,
        identification="不在就业政策调整范围内的群体",
        interest="不受直接影响",
        immediate_impact="无直接影响",
        long_term_impact="自愿退出者若重新进入劳动力市场将面临技能断层风险",
        interest_impact="不涉及利益重新分配",
    ),
]

industry_impacts = [
    IndustryImpact(level="直接影响", industry="灵活就业平台（外卖、网约车、直播电商）", transmission_path="灵活就业制度化带来合法性认可，但合规要求提高（社保缴纳、劳动保护）"),
    IndustryImpact(level="间接影响", industry="技能培训、产教融合", transmission_path="培训从政府主导向企业主导转型，产教融合型企业获得政策支持"),
    IndustryImpact(level="潜在机会", industry="养老护理、社区服务、物流末端配送", transmission_path="AI无法替代的高接触性服务岗位成为“降维转型”目的地"),
]

time_dimensions = [
    TimeDimension(phase="短期", time_window="2026", forecast="规划配套实施方案出台，考核指标具体化，灵活就业社保试点启动"),
    TimeDimension(phase="中期", time_window="2027-2028", forecast="首批灵活就业社保全覆盖试点城市运行数据出炉，AI替代岗位再就业统计制度建立"),
    TimeDimension(phase="长期", time_window="2029-2030", forecast="灵活就业社保全国推广，技能培训需求驱动模式成熟，“十五五”目标完成度盘点"),
]

# ── 政策权重与空间分析 ────────────────────────────────────────────

policy_system = PolicySystem.CHINA
policy_level = PolicyLevel.L3  # 行政法规级

upper_coverage_check = (
    "就业促进法（L2法律级）确立了国家促进就业的基本法律框架，"
    "“十五五”规划是对该法律在规划期内的具体实施安排，方向一致无冲突。"
)

same_level_check = (
    "同为“十五五”专项规划的教育规划、科技规划、产业规划等与就业规划存在交叉——"
    "其他规划中的“技能人才培养”和“就业创造”目标需要与就业规划协同。"
    "实际执行中可能存在规出多门、统计口径不统一的问题。"
)

clause_analyses = [
    ClauseAnalysis(
        clause_name="就业指标考核权重提升",
        nature=ClauseNature.OBLIGATORY,
        precision=ClausePrecision.MEDIUM,
        target="地方政府",
        analysis="“优先战略”升级意味着就业指标在绩效考核中权重提升，但能否真正变成“硬约束”取决于考核机制设计",
    ),
    ClauseAnalysis(
        clause_name="灵活就业社保制度",
        nature=ClauseNature.OBLIGATORY,
        precision=ClausePrecision.LOW,
        target="灵活就业平台和劳动者",
        analysis="“多方共担”框架（平台+劳动者+政府）的具体比例和分担方式待试点确定，操作弹性大",
    ),
    ClauseAnalysis(
        clause_name="技能培训转型",
        nature=ClauseNature.ENCOURAGING,
        precision=ClausePrecision.MEDIUM,
        target="企业、培训机构",
        analysis="从“政府主导”转向“企业主导”——产教融合和企业新型学徒制是主要模式",
    ),
]

space_weight_linkage = (
    "中等权重（L3）× 高操作空间 = 执行效果高度依赖地方政府的重视程度。"
    "东部发达地区就业压力相对较小但就业质量要求更高；"
    "中西部地区就业总量压力更大但财政资源更有限——"
    "同一份规划在不同地区的落地效果差异可能很大。"
)

# ── 分析正文 ─────────────────────────────────────────────────

diag_issuer = {
    "viz": "network",
    "title": "政策发布方的约束与选择",
    "nodes": [
        {"id":"a", "label":"人社部", "type":"political"},
        {"id":"b", "label":"总量压力缓解", "type":"material"},
        {"id":"c", "label":"结构压力加大", "type":"material"},
        {"id":"d", "label":"高校毕业生1200万", "type":"actor"},
        {"id":"e", "label":"AI替代效应", "type":"actor"},
        {"id":"f", "label":"地方政府执行", "type":"actor"}
    ],
    "edges": [
        {"source":"a", "target":"b", "label":"劳动人口下降", "type":"economic"},
        {"source":"a", "target":"c", "label":"技能门槛提高", "type":"economic"},
        {"source":"c", "target":"d", "label":"供给持续增加", "type":"economic"},
        {"source":"e", "target":"c", "label":"中等岗位替代", "type":"economic"},
        {"source":"a", "target":"f", "label":"指标下达", "type":"power"},
        {"source":"f", "target":"a", "label":"GDP优先可能对冲", "type":"power"}
    ]
}

diag_beneficiary = {
    "viz": "network",
    "title": "既得利益群体的受益逻辑",
    "nodes": [
        {"id":"a", "label":"高校毕业生", "type":"actor"},
        {"id":"b", "label":"技能培训受益者", "type":"actor"},
        {"id":"c", "label":"平台企业", "type":"actor"},
        {"id":"d", "label":"就业质量提升", "type":"material"},
        {"id":"e", "label":"再培训补贴", "type":"material"},
        {"id":"f", "label":"灵活就业制度化", "type":"material"}
    ],
    "edges": [
        {"source":"d", "target":"a", "label":"不再只求有岗", "type":"economic"},
        {"source":"e", "target":"b", "label":"技能转型", "type":"economic"},
        {"source":"f", "target":"c", "label":"合法性和稳定性", "type":"legal"}
    ]
}

diag_loser = {
    "viz": "network",
    "title": "利益受损群体的损失逻辑",
    "nodes": [
        {"id":"a", "label":"低技能中年劳动者", "type":"actor"},
        {"id":"b", "label":"AI替代", "type":"actor"},
        {"id":"c", "label":"年龄歧视", "type":"actor"},
        {"id":"d", "label":"传统中介", "type":"actor"},
        {"id":"e", "label":"灵活就业制度化", "type":"material"}
    ],
    "edges": [
        {"source":"b", "target":"a", "label":"岗位消失", "type":"economic"},
        {"source":"c", "target":"a", "label":"再就业困难", "type":"economic"},
        {"source":"e", "target":"d", "label":"中介角色削弱", "type":"economic"}
    ]
}

analysis_sections = [
    AnalysisSection(
        title="总量缓和与结构紧张——规划面对的真正矛盾",
        body=(
            "中国劳动年龄人口从2012年开始下降，2023年进入总人口负增长。"
            "这意味着就业的总量压力在趋势性缓解——不创造新岗位，自然退休也会腾出空间。"
            "2025年城镇新增就业1267万人，超额完成了“1200万人以上”的年度目标。\n\n"
            "但总量缓和没有带来就业压力的均匀下降。相反，结构性紧张在加剧。"
            "2026年高校毕业生预计超过1200万人——这意味着单是这一个群体的就业需求"
            "就接近全年的新增就业目标。在岗位总量足够的背景下，"
            "为什么年轻人还是找不到工作？\n\n"
            "原因在于岗位与技能之间的错配。企业不是不缺人，是缺“合适的人”。"
            "一个有经验的数控机床操作工比一个刚毕业的计算机专业本科生更难招到——"
            "尽管前者学历更低。AI和自动化的推进正在拉大这个错配："
            "被替代的中等技能岗位（基础编程、数据录入、会计记账）"
            "恰好是许多年轻人“入门级”的职业选择。\n\n"
            "这是一个典型的成本-收益核算问题。企业的招聘决策是理性计算的结果："
            "招一个需要培训半年的应届毕业生，前六个月的产出是负的，"
            "第一年的留存率可能只有50%。招一个从同行跳槽过来的熟手，上手就能干活。"
            "在岗位总量充裕的市场中，企业等待“对的人”的成本远低于培养“不对的人”的成本。"
        ),
        three_paths=ThreePath(
            path_a_condition="技能培训从供给驱动转向需求驱动，企业主导培训有效运行",
            path_a_behavior="高校毕业生通过企业新型学徒制快速获得市场所需技能",
            path_a_result="岗位与技能错配逐步缓解，结构性就业压力下降",
            path_b_condition="技能培训仍以政府主导为主，培训内容与市场需求脱节",
            path_b_behavior="高校毕业生继续面临“有岗无人、有人无岗”的结构性矛盾",
            path_b_result="结构性就业问题在“十五五”中期进一步积累",
            path_c_condition="AI替代速度加快，中等技能岗位消失速度超过再培训速度",
            path_c_behavior="大量中等技能劳动者进入“过渡盲区”，再就业率持续下降",
            path_c_result="结构性就业问题升级为社会问题，规划被迫从“结构优化”转回“总量刺激”",
            synthesis="路径A为政策设计预期，路径B为执行不力的风险，路径C为外部技术变量超预期的极端情形",
        ),
        diagram=diag_issuer,
        sub_conclusion="总量缓和没有带来就业压力的均匀下降——结构性的技能错配才是真正矛盾",
    ),
    AnalysisSection(
        title="灵活就业制度化——旧管道如何装新形态",
        body=(
            "中国灵活就业人口超过2亿。外卖骑手、网约车司机、直播电商主播——"
            "这些岗位在十年前几乎不存在。它们创造了一种全新的劳动形态："
            "非标准工时、多平台接单、自备生产工具、收入不稳定。\n\n"
            "但为这种新形态提供保障的制度管道仍然是旧的。"
            "劳动合同制度是为“一个雇主一份工作”设计的——"
            "固定的雇佣关系、固定的工资支付、固定的社会保险。"
            "灵活就业者可能今天在A平台跑外卖、明天在B平台开网约车、"
            "后天接一个装修散活——他们的劳动关系分散在多个平台上，"
            "每个平台的合作时间都不足以构成传统的“劳动关系”。\n\n"
            "制度管道的扩容是规划的核心任务之一。但扩容面临一个关键问题：成本由谁承担？"
            "如果要求平台为所有骑手缴纳社保，平台的用工成本将大幅上升——"
            "这个成本最终会通过涨价转移到消费者身上，"
            "或者通过降低骑手单价转移到劳动者身上。无论哪种转移，都会产生新的利益受损群体。\n\n"
            "规划可能的解决方案是设置一个“多方共担”的制度框架："
            "平台承担基础比例、劳动者自愿补充、财政给予补贴——"
            "把旧管道的“双边模式”（雇主+雇员）升级为“三边模式”（平台+劳动者+政府）。"
        ),
        three_paths=ThreePath(
            path_a_condition="“多方共担”框架达成共识，试点城市运行良好",
            path_a_behavior="平台承担基础比例社保，劳动者自愿补充，财政给予补贴",
            path_a_result="灵活就业社保覆盖率快速提升，制度管道扩容成功",
            path_b_condition="多方成本分摊方案未达成共识，平台抵制或劳动者不愿承担",
            path_b_behavior="社保覆盖率提升缓慢，灵活就业者继续处于制度保障盲区",
            path_b_result="制度管道扩容失败，2亿灵活就业者的保障缺口持续扩大",
            path_c_condition="强制平台全额缴纳社保，用工成本大幅上升",
            path_c_behavior="平台通过涨价或降单价转嫁成本，消费者和劳动者利益受损",
            path_c_result="社保覆盖率达标但产生新的利益受损群体，政策效果打折扣",
            synthesis="路径A为政策设计预期，路径B为最大风险（利益博弈未达成共识），路径C为强制执行的副作用",
        ),
        diagram=diag_beneficiary,
        sub_conclusion="旧管道装不下新形态——扩容的成本由谁承担是制度设计的核心难题",
    ),
    AnalysisSection(
        title="AI替代的过渡桥——谁在被替代，谁在创造",
        body=(
            "AI和自动化对就业的影响不是“消灭岗位”这么简单。"
            "真实的情况是：它同时消灭和创造岗位，但消灭和创造的速度不匹配，"
            "更重要的是——消灭的岗位和创造的岗位不在同一群人身上。\n\n"
            "被AI替代的岗位以中等技能白领为主：会计、翻译、法律文书、基础编程、客户服务。"
            "这些岗位的特征是：规则明确、重复性高、不需要面对面互动。"
            "创造的岗位以两端为主：高端（AI训练师、数据分析师、算法工程师）"
            "和低端（养老护理、社区服务、物流配送）。\n\n"
            "问题在于：一个被AI替代的35岁会计，不太可能转型为AI训练师"
            "（技能鸿沟太大），也不太愿意去做养老护理（社会地位和收入落差太大）。"
            "他处于创造和毁灭之间的“过渡盲区”。\n\n"
            "规划中的技能培训如果只覆盖“可培训”的群体——年轻、有一定学历、学习能力强——"
            "那么最需要帮助的人（中年、低学历、转行困难）就会被漏掉。"
            "一个真正有效的过渡桥，不是让所有人从旧岗位跳到新岗位，"
            "而是为掉下来的人提供缓冲——这个缓冲可以是："
            "转岗补贴、“降维就业”的社会认可、以及失业保险的覆盖面扩大。"
        ),
        three_paths=ThreePath(
            path_a_condition="过渡桥机制完善，转岗补贴和失业保险覆盖面扩大",
            path_a_behavior="被替代劳动者获得缓冲期收入支持，逐步完成“降维转型”",
            path_a_result="AI替代的社会成本被有效吸收，过渡平稳",
            path_b_condition="过渡桥机制缺失，被替代劳动者直接进入失业状态",
            path_b_behavior="中年低技能劳动者长期失业，家庭收入断崖式下降",
            path_b_result="AI替代的社会成本由最脆弱群体承担，社会风险积累",
            path_c_condition="AI替代速度远超预期，大规模失业超出过渡桥承载能力",
            path_c_behavior="失业保险基金承压，财政被迫大规模投入救急",
            path_c_result="规划从“结构优化”被迫转回“总量刺激”，长期目标延迟",
            synthesis="路径A为理想状态，路径B为当前最大风险（过渡桥缺失），路径C为极端情形",
        ),
        diagram=diag_loser,
        sub_conclusion="AI消灭的岗位和创造的岗位不在同一群人身上——“过渡盲区”是最大政策缺口",
    ),
]

# ── 结论 ────────────────────────────────────────────────────────

confluence = (
    "就业优先战略从“十四五”的就业促进规划升级为“十五五”的就业优先战略规划，"
    "名称变化的背后是政策重心的转移。"
    "总量就业压力在缓解，结构性的技能错配、灵活就业的制度缺口、"
    "技术替代的过渡缺失——这三个问题才是“十五五”就业的主战场。"
    "规划不是在跟失业率赛跑，而是在跟三个结构性变化赛跑："
    "人口结构、技术结构、就业形态结构。"
)

endgame_direction = EndgameDirection.MODIFIED_EXECUTION
endgame_key_nodes = [
    "2026年：规划配套实施方案出台，考核指标具体化，灵活就业社保试点启动",
    "2027-2028年：首批灵活就业社保全覆盖试点城市运行数据出炉",
    "2029-2030年：AI替代岗位再就业统计制度建立，“十五五”目标完成度盘点",
]

golden_sentence = "就业优先不是让每个人都有一个岗位，而是让每个想要工作的人都能找到与自己匹配的位置——匹配不上的时候，制度兜底。"

# ── 附录 ────────────────────────────────────────────────────────

appendix_sources = [
    FactSource(name="中国政府网 2026年：国务院关于印发《实施就业优先战略“十五五”规划》的通知", url="https://www.gov.cn/zhengce/xxgk/"),
    FactSource(name="新华社 2026年3月5日：李强作政府工作报告", url="https://www.xinhuanet.com/"),
    FactSource(name="人社部 2024-2025年：就业工作统计数据", url="https://www.mohrss.gov.cn/"),
]

# ── 组装报告 ─────────────────────────────────────────────────

report = PolicyReport(
    title="就业优先的制度化——《实施就业优先战略“十五五”规划》政策分析",
    fact_summary=fact_summary,
    fact_timeline=fact_timeline,
    fact_sources=fact_sources,
    core_tension=core_tension,
    core_proposition=core_proposition,
    concepts=concepts,
    policy_name=policy_name,
    policy_date=policy_date,
    policy_type=policy_type,
    policy_scope=policy_scope,
    issuer_description=issuer_description,
    actors=actors,
    industry_impacts=industry_impacts,
    time_dimensions=time_dimensions,
    policy_system=policy_system,
    policy_level=policy_level,
    upper_coverage_check=upper_coverage_check,
    same_level_check=same_level_check,
    clause_analyses=clause_analyses,
    space_weight_linkage=space_weight_linkage,
    analysis_sections=analysis_sections,
    confluence=confluence,
    endgame_direction=endgame_direction,
    endgame_key_nodes=endgame_key_nodes,
    golden_sentence=golden_sentence,
    appendix_sources=appendix_sources,
)

# ── 导出 ─────────────────────────────────────────────────────

if __name__ == "__main__":
    engine = CaseAnalysisEngine()
    try:
        result = engine.export_from_typed(report)
        print("=" * 60)
        print("报告生成完成！")
        print(f"  Word: {result['word']}")
        if result['pdf']:
            print(f"  PDF:  {result['pdf']}")
        else:
            print("  PDF:  未生成")
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
