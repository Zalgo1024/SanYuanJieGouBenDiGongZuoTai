"""
北京一人公司政策分析 — 强类型 PolicyReport 版
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
    "2024年7月1日，新修订《中华人民共和国公司法》施行，全面取消一人有限责任公司"
    "设立数量限制及最低注册资本要求。北京市市场监督管理局同日发布"
    "《开展“一标四维”登记促进经营主体高质量发展工作措施》，"
    "是全国最早完成政策衔接的省市之一。\n\n"
    "核心参数：登记平台“e窗通”（ect.scjgj.beijing.gov.cn），全程网办；"
    "中关村、经开区推行集群注册和工位注册；注册时限1个工作日内；"
    "公章刻制免费1套；取消一人公司数量、最低注册资本、再投资限制；出资期限5年内缴足。"
)

fact_timeline = [
    TimelineEntry(date="2024年7月1日", event="新修订《公司法》施行，北京“一标四维”工作措施同日发布"),
]

fact_sources = [
    FactSource(name="《中华人民共和国公司法》（2024修订）", url="https://www.gov.cn"),
    FactSource(name="北京市市场监管局“一标四维”工作措施", url="https://scjgj.beijing.gov.cn"),
]

# ── 分析框架 ─────────────────────────────────────────────────

core_tension = (
    "北京“一标四维”将一人公司登记从行政审批变为标准化流程——"
    "这降低了创业门槛，但标准化在提高效率的同时，"
    "是否在另一端制造了“数字鸿沟”？"
)

core_proposition = (
    "北京政策的核心不是“取消了多少限制”，而是“用标准化替代行政审批”——"
    "从人治到规治的登记制度转型。"
)

concepts = [
    ConceptSelection(
        observed_pattern="取消限制后立即发布标准化框架——不是简单放开，而是用新规则替代旧限制",
        concept_name="制度管道",
        how_it_explains="旧管道阀门（数量限制）被拆除，新管道被标准化规则替代",
        analysis_question="标准化是降低了门槛还是用新门槛替换了旧门槛？",
    ),
    ConceptSelection(
        observed_pattern="“e窗通”全程网办，电子执照即时发放",
        concept_name="成本-收益核算",
        how_it_explains="科技创业者的注册成本接近零；中老年个体户的数字学习成本反而上升",
        analysis_question="数字化便利对不同群体的成本影响是否对称？",
    ),
    ConceptSelection(
        observed_pattern="工位注册降低物理门槛",
        concept_name="激励-约束",
        how_it_explains="物理门槛降低激励了注册量增长，但地址虚拟化削弱了债权人识别信用的能力",
        analysis_question="物理门槛降低是否等同于信用门槛降低？",
    ),
]

# ── 政策对象图谱 ───────────────────────────────────────────────

policy_name = "北京“一标四维”登记制度+营商环境工作方案"
policy_date = "2024年7月1日"
policy_type = "地方规范性文件"
policy_scope = "北京市"

issuer_description = (
    "北京市市场监管局是政策的主要推动者。作为首都市场监管部门，"
    "其政策风格倾向于标准化和规范化——“一标四维”的命名本身就体现了这个特征。"
    "北京既是政策执行者也是全国登记制度改革的标杆——其政策设计往往被其他省市参照。"
)

actors = [
    ActorInfo(
        name="北京市市场监管局",
        role=ActorRole.POLICY_ISSUER,
        identification="首都市场监管部门，推动标准化登记制度改革",
        interest="建立可复制、可推广的标准化登记制度，保证新公司法平稳落地",
        immediate_impact="取消限制后注册量激增，系统需要扛住；标准化框架投入运行",
        long_term_impact="一旦标准化框架成熟，北京模式成为全国范本",
        interest_impact="行政效率提升，审查员裁量空间被系统替代",
    ),
    ActorInfo(
        name="科技创业者、互联网从业者、自由职业者",
        role=ActorRole.BENEFICIARY,
        identification="依赖互联网工具、追求高效注册流程的群体",
        interest="低门槛、快速度、可预期的注册体验",
        immediate_impact="全程网办几乎零成本，工位注册进一步降低启动成本",
        long_term_impact="连续创业者可持有多家公司，创业生态扩大",
        interest_impact="注册成本从时间和金钱双维度下降",
    ),
    ActorInfo(
        name="传统注册代理机构、不熟悉数字操作的中老年个体经营者",
        role=ActorRole.LOSER,
        identification="依赖线下代办赚取服务费的机构；不擅长线上操作的中老年经营者",
        interest="维持代办收入（代理）；维持线下办事渠道（中老年）",
        immediate_impact="代办需求下降，收入压缩；全程网办造成数字鸿沟",
        long_term_impact="代理需转型为专业咨询；中老年群体被边缘化",
        interest_impact="代办增值空间从“跑流程”压缩到“专业咨询”；数字能力不足者被挡在线上外",
    ),
    ActorInfo(
        name="已成立的大型企业、不使用公司形式的极小型经营者",
        role=ActorRole.UNAFFECTED,
        identification="已有完善治理结构的大企业；不需要法人资格的极小型经营者",
        interest="日常经营不受影响",
        immediate_impact="无直接影响",
        long_term_impact="无直接影响",
        interest_impact="不涉及利益重新分配",
    ),
]

industry_impacts = [
    IndustryImpact(level="直接影响", industry="企业注册代理、商业地产租赁", transmission_path="标准化降低代办需求；工位注册削弱实体办公室的注册地址功能"),
    IndustryImpact(level="间接影响", industry="科技创业服务、自由职业平台", transmission_path="一人公司低门槛促进创业生态扩大"),
    IndustryImpact(level="潜在机会", industry="在线财税SaaS、合规咨询", transmission_path="一人公司数量增长催生轻量级财税和合规服务需求"),
]

time_dimensions = [
    TimeDimension(phase="短期", time_window="2024-2025", forecast="注册量快速增长，系统承载能力经受考验"),
    TimeDimension(phase="中期", time_window="2026-2028", forecast="标准化框架成熟，北京模式向全国推广"),
    TimeDimension(phase="长期", time_window="2029-", forecast="首批五年出资期限到期，检验存量公司合规率"),
]

# ── 政策权重与空间分析 ────────────────────────────────────────────

policy_system = PolicySystem.CHINA
policy_level = PolicyLevel.L6  # 地方规范性文件级

upper_coverage_check = (
    "上位法为新《公司法》（全国人大常委会通过的法律级），"
    "北京政策是对上位法的具体实施和便利化补充，不存在与上位法冲突的问题。"
)

same_level_check = (
    "北京作为率先落实的城市，其政策与其他省市不存在竞合——"
    "创业者根据自身情况选择注册地。"
)

clause_analyses = [
    ClauseAnalysis(
        clause_name="“一标四维”标准化登记",
        nature=ClauseNature.OBLIGATORY,
        precision=ClausePrecision.HIGH,
        target="北京市各级登记机关",
        analysis="统一登记标准明确合规边界，审查员裁量空间被压缩，操作规范刚性执行",
    ),
    ClauseAnalysis(
        clause_name="集群注册和工位注册",
        nature=ClauseNature.AUTHORIZING,
        precision=ClausePrecision.MEDIUM,
        target="中关村、经开区等特定区域的创业者",
        analysis="物理门槛从“一间办公室”降到“一个工位”，具体区域范围可调整",
    ),
    ClauseAnalysis(
        clause_name="全程网办（e窗通）",
        nature=ClauseNature.OBLIGATORY,
        precision=ClausePrecision.HIGH,
        target="所有注册申请人",
        analysis="系统自动校验、标准统一透明、全程留痕可追溯",
    ),
]

space_weight_linkage = (
    "地方规范性文件（中低权重）× 标准化操作（低弹性）= 执行一致性高，"
    "政策变动的弹性集中在区域范围和系统功能层面。"
)

# ── 分析正文 ─────────────────────────────────────────────────

diag_issuer = {
    "viz": "network",
    "title": "北京政策发布方的目标与工具",
    "nodes": [
        {"id":"a", "label":"北京市场监管局", "type":"political"},
        {"id":"b", "label":"一标四维", "type":"material"},
        {"id":"c", "label":"e窗通平台", "type":"material"},
        {"id":"d", "label":"登记量激增", "type":"actor"}
    ],
    "edges": [
        {"source":"a", "target":"b", "label":"发布", "type":"power"},
        {"source":"a", "target":"c", "label":"运行", "type":"power"},
        {"source":"b", "target":"d", "label":"标准化应对", "type":"legal"},
        {"source":"c", "target":"d", "label":"全程网办承载", "type":"legal"}
    ]
}

diag_beneficiary = {
    "viz": "network",
    "title": "北京既得利益群体的受益逻辑",
    "nodes": [
        {"id":"a", "label":"科技创业者", "type":"material"},
        {"id":"b", "label":"自由职业者", "type":"material"},
        {"id":"c", "label":"e窗通注册", "type":"material"},
        {"id":"d", "label":"工位注册", "type":"material"}
    ],
    "edges": [
        {"source":"c", "target":"a", "label":"零成本进入", "type":"economic"},
        {"source":"c", "target":"b", "label":"法人身份获得", "type":"economic"},
        {"source":"d", "target":"a", "label":"极低物理成本", "type":"economic"}
    ]
}

diag_loser = {
    "viz": "network",
    "title": "北京利益受损群体的损失逻辑",
    "nodes": [
        {"id":"a", "label":"传统代理机构", "type":"actor"},
        {"id":"b", "label":"中老年个体户", "type":"actor"},
        {"id":"c", "label":"代办需求下降", "type":"material"},
        {"id":"d", "label":"数字鸿沟", "type":"material"}
    ],
    "edges": [
        {"source":"c", "target":"a", "label":"收入压缩", "type":"economic"},
        {"source":"d", "target":"b", "label":"被挡在线上外", "type":"economic"}
    ]
}

analysis_sections = [
    AnalysisSection(
        title="标准化替代行政审批——制度管道的重建",
        body=(
            "旧公司法对一人公司的规制是行政审批式的：限制数量、最低注册资本、限制再投资。"
            "这些阀门的共同逻辑是——在入口处设置障碍，挡住的既有滥用者也包括合法创业者。"
            "2024年修法把这些阀门拆除了。\n\n"
            "但北京没有停在“拆除”这一步。它同时架设了一套新的标准化规则——“一标四维”。"
            "统一登记标准明确了什么是合规的；四个维度（规范、便利、透明、智慧）"
            "分别解决流程中的不同痛点。\n\n"
            "旧管道的问题是主观裁量——审查员的判断决定着你能不能进门，"
            "不一致、不可预期、可寻租。新管道的逻辑是客观规则——"
            "系统自动校验、标准统一透明、全程留痕可追溯。\n\n"
            "这不仅仅是“让办事更方便”，而是用制度管道重构改变了政府与市场主体的关系。"
        ),
        three_paths=ThreePath(
            path_a_condition="标准化登记规则稳定运行，审查口径一致",
            path_a_behavior="企业按标准自助填报，系统自动校验通过",
            path_a_result="登记效率大幅提升，北京成为全国标准化标杆",
            path_b_condition="标准化规则频繁调整，合规标准不稳定",
            path_b_behavior="企业和审查员都在适应新规则，执行标准不一致",
            path_b_result="合规不确定性上升，标准化优势被抵消",
            path_c_condition="标准化规则过于僵化，无法适应特殊情形",
            path_c_behavior="特殊行业或特殊情形的企业无法通过标准流程注册",
            path_c_result="制度管道对边缘案例失效，需要补充例外机制",
            synthesis="路径A为大概率（北京作为首都执行力强，标准化方向明确），路径B取决于规则迭代的频率和透明度",
        ),
        diagram=diag_issuer,
        sub_conclusion="标准化不是降低门槛，是用新门槛替换了旧门槛——从人治到规治",
    ),
    AnalysisSection(
        title="数字化便利的隐性成本",
        body=(
            "“e窗通”把注册变成全线上流程，对熟练使用互联网的创业者来说是几乎零成本。"
            "但对于不熟悉数字操作的中老年个体户——那些可能经营了十几年小生意、"
            "想从个体户升级为公司的人——全程网办不是便利而是障碍。\n\n"
            "制度设计中的便利从来不是均质的。同样一条管道，不同人群的通行体验完全不同。"
            "北京需要在保持线上效率的同时，为数字能力不足的群体保留线下通道。"
        ),
        three_paths=ThreePath(
            path_a_condition="线上流程持续优化，同时保留线下辅助通道",
            path_a_behavior="数字能力强的群体走线上，数字能力弱的群体走线下辅助",
            path_a_result="两类群体都能顺利完成注册，数字鸿沟被有效弥合",
            path_b_condition="线下通道逐步取消，所有注册必须通过线上完成",
            path_b_behavior="中老年个体户被迫学习数字操作或放弃注册",
            path_b_result="数字鸿沟扩大，部分潜在创业者被制度排除",
            path_c_condition="第三方代办服务填补线下空白，但有偿服务推高实际成本",
            path_c_behavior="中老年群体依赖付费代办完成线上注册",
            path_c_result="名义上的免费注册实际上被代办费用侵蚀",
            synthesis="路径A为理想状态但需要财政投入维持线下通道，路径B是自发趋势需要政策干预，路径C是市场自发补偿",
        ),
        diagram=diag_beneficiary,
        sub_conclusion="数字化便利对不同群体产生了不对称的影响——便利不是均质的",
    ),
    AnalysisSection(
        title="工位注册——物理门槛与信用门槛的分离",
        body=(
            "工位注册将创业的物理门槛从“一间办公室”降到“一个工位”。"
            "但门槛降低的收益由创业者享受，识别成本——"
            "判断一家工位地址的公司是否可信——转移给了债权人。"
            "制度设计需要意识到这个不对称，并在其他环节补上信用信息。"
        ),
        three_paths=ThreePath(
            path_a_condition="标准化登记成熟运行，信用信息配套到位",
            path_a_behavior="北京成为全国标杆，工位注册企业信用可查",
            path_a_result="制度稳定运行，创业门槛和信用门槛同时可控",
            path_b_condition="标准化规则频繁变动，合规不确定性上升",
            path_b_behavior="企业和审查员都在适应新规则，工位注册信用体系滞后",
            path_b_result="制度优势打折扣，信用风险积累",
            path_c_condition="存量闲置公司激增，大量工位注册公司无实际经营",
            path_c_behavior="注销潮引发二次震荡，债权人损失扩大",
            path_c_result="政策被迫收紧，工位注册门槛重新提高",
            synthesis="路径A为大概率（北京政策执行力强），路径C取决于五年出资期限到期后的存量筛查效果",
        ),
        diagram=diag_loser,
        sub_conclusion="物理门槛降低不等于信用门槛降低——门槛降低的收益和成本分配不对称",
    ),
]

# ── 结论 ────────────────────────────────────────────────────────

confluence = (
    "北京一人公司政策的核心逻辑是“用标准化替代行政审批”。"
    "这不是简单的“降低门槛”，而是制度管道从人治到规治的转型。"
    "标准化提高了效率和可预期性，但数字化便利对不同群体产生了不对称的影响。"
)

endgame_direction = EndgameDirection.DIRECT_EXECUTION
endgame_key_nodes = [
    "2024-2025年：注册量快速增长，系统承载能力经受考验",
    "2026-2028年：标准化框架成熟，北京模式向全国推广",
    "2029年：首批五年出资期限到期，检验存量公司合规率",
]

golden_sentence = "最好的登记制度不是让注册越来越简单，而是让该进来的人进得来、不该进来的人能被认出来。"

# ── 附录 ────────────────────────────────────────────────────────

appendix_sources = [
    FactSource(name="《中华人民共和国公司法》（2024修订）", url="https://www.gov.cn"),
    FactSource(name="北京市市场监管局：“一标四维”登记工作措施", url="https://scjgj.beijing.gov.cn"),
    FactSource(name="北京市企业服务e窗通平台", url="https://ect.scjgj.beijing.gov.cn"),
]

# ── 组装报告 ─────────────────────────────────────────────────

report = PolicyReport(
    title="一标四维与AI赋能——北京一人公司政策分析",
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
