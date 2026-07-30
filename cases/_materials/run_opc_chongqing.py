"""
重庆一人公司政策分析 — 强类型 PolicyReport 版
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
    "2024年7月1日，新修订《中华人民共和国公司法》施行。"
    "重庆市在2026年3月发布《经营主体登记服务指南》，并推出多项特色便利化措施。\n\n"
    "核心参数：登记平台“渝快办”（zwfw.cq.gov.cn），支持线上线下多渠道；"
    "“1人1工位1公司”——全市推行集群注册和工位注册；自贸区内注册时限0.5个工作日；"
    "自贸区内公章免费；“渝质金服”质量金融服务体系；"
    "个转企绿色通道+创业担保贷款最高300万元、财政贴息50%；"
    "外资准入前国民待遇+负面清单管理。"
)

fact_timeline = [
    TimelineEntry(date="2024年7月1日", event="新修订《公司法》施行"),
    TimelineEntry(date="2026年3月24日", event="重庆市发布《经营主体登记服务指南》"),
]

fact_sources = [
    FactSource(name="《中华人民共和国公司法》（2024修订）", url="https://www.gov.cn"),
    FactSource(name="重庆市市场监管局《经营主体登记服务指南》", url="https://scjgj.cq.gov.cn"),
]

# ── 分析框架 ─────────────────────────────────────────────────

core_tension = (
    "重庆把一人公司的进入门槛压到极限（1人1工位1公司），"
    "但进入成本为零不等于经营风险为零——"
    "极低门槛在激励创业同时，也可能制造壳公司和休眠公司。"
)

core_proposition = (
    "重庆政策的核心是“用最低进入成本吸引最大创业群体”，"
    "但这套逻辑的前提是——进来的大多数人是来创业的，不是来套利的。"
)

concepts = [
    ConceptSelection(
        observed_pattern="工位注册将进入成本压到几百元/月，可以最低成本维持法人身份",
        concept_name="成本-收益核算",
        how_it_explains="进入成本极低意味着投机者进入成本也极低——几百元注册公司用于单次交易欺诈的风险收益比可能很高",
        analysis_question="低门槛在激励创业的同时是否也在激励投机？",
    ),
    ConceptSelection(
        observed_pattern="“个转企”绿色通道缩短个体户与公司的制度距离",
        concept_name="制度管道",
        how_it_explains="个体户（无限责任、税负轻）和一人公司（有限责任、合规重）是两条管道，绿色通道缩短了转换距离",
        analysis_question="政策推力是否在创造“被动转型”？",
    ),
    ConceptSelection(
        observed_pattern="“渝质金服”提供质量+金融服务——用后续筛选弥补前置门槛的缺失",
        concept_name="激励-约束",
        how_it_explains="门槛的降低用后续筛选来平衡——通过金融服务体系识别和支持优质企业",
        analysis_question="后续筛选能否有效替代前置门槛的功能？",
    ),
]

# ── 政策对象图谱 ───────────────────────────────────────────────

policy_name = "重庆经营主体登记服务指南+“一人工位一公司”便利化措施"
policy_date = "2026年3月24日"
policy_type = "地方规范性文件"
policy_scope = "重庆市"

issuer_description = (
    "重庆市市场监管局的策略明显不同于北京——不是先建标准化框架，"
    "而是先用极低门槛吸引注册量增长，再通过后续金融服务筛选优质企业。"
    "“渝质金服”体系的设计反映了这个逻辑：门槛可以很低，"
    "但进入后的质量评估和金融支持可以作为筛选工具。"
)

actors = [
    ActorInfo(
        name="重庆市市场监督管理局",
        role=ActorRole.POLICY_ISSUER,
        identification="重庆市场主体登记管理部门",
        interest="通过极低进入成本刺激市场主体增长，再用金融配套实现“量质并举”",
        immediate_impact="注册量快速增长，工位注册模式接受市场检验",
        long_term_impact="“渝质金服”筛选效果显现，优质企业被识别和支持",
        interest_impact="市场主体数量增长带来政绩，但监管压力同步上升",
    ),
    ActorInfo(
        name="个体户转型者、微型创业者、外资中小企业",
        role=ActorRole.BENEFICIARY,
        identification="受益于极低门槛和金融配套的群体",
        interest="最低启动成本（微型创业者）；贴息贷款支持（个转企）；准入前国民待遇（外资）",
        immediate_impact="几百元即可注册公司；个转企享受贴息贷款；外资以最轻法人结构进入",
        long_term_impact="创业生态扩大；优质企业获得金融支持；外资进入门槛最低",
        interest_impact="启动资金压力最小化；转型成本被补贴对冲",
    ),
    ActorInfo(
        name="传统注册代理机构、以出租实体办公室为业的商业地产",
        role=ActorRole.LOSER,
        identification="依赖代办流程赚取服务费的机构；依赖注册地址功能收取租金的地产",
        interest="维持代办收入（代理）；维持注册地址功能（地产）",
        immediate_impact="极低门槛进一步压缩代办需求；工位注册削弱实体办公室注册地址功能",
        long_term_impact="代理需转型或退出；商业地产注册地址功能持续弱化",
        interest_impact="代办市场萎缩；注册地址租金收入下降",
    ),
    ActorInfo(
        name="已稳定运营的非一人公司、不需要法人资格的极小型经营者",
        role=ActorRole.UNAFFECTED,
        identification="已有稳定运营模式的企业；规模太小不需要公司形式的经营者",
        interest="日常经营不受影响",
        immediate_impact="无直接影响",
        long_term_impact="无直接影响",
        interest_impact="不涉及利益重新分配",
    ),
]

industry_impacts = [
    IndustryImpact(level="直接影响", industry="企业注册代理、商业地产", transmission_path="代办需求下降；实体办公室注册地址功能削弱"),
    IndustryImpact(level="间接影响", industry="微型创业生态、外资服务", transmission_path="低门槛促进市场准入扩大"),
    IndustryImpact(level="潜在机会", industry="在线财税、质量认证、金融服务", transmission_path="“渝质金服”体系催生配套服务"),
]

time_dimensions = [
    TimeDimension(phase="短期", time_window="2026-2027", forecast="注册量快速增长，工位注册模式接受市场检验"),
    TimeDimension(phase="中期", time_window="2028-2029", forecast="首批存量筛查开始，“渝质金服”筛选效果显现"),
    TimeDimension(phase="长期", time_window="2029-", forecast="五年出资期限到期，检验工位注册公司的存活率"),
]

# ── 政策权重与空间分析 ────────────────────────────────────────────

policy_system = PolicySystem.CHINA
policy_level = PolicyLevel.L6  # 地方规范性文件级

upper_coverage_check = (
    "上位法为新《公司法》，重庆政策是对上位法的具体实施和便利化补充。"
    "重庆与北京不存在政策竞合——创业者可以根据自身情况选择注册地。"
)

same_level_check = (
    "与其他省市的商事登记改革措施不存在竞合，重庆特色在于"
    "“1人1工位1公司”的极简模式和“渝质金服”的后续筛选体系。"
)

clause_analyses = [
    ClauseAnalysis(
        clause_name="“1人1工位1公司”工位注册",
        nature=ClauseNature.AUTHORIZING,
        precision=ClausePrecision.LOW,
        target="重庆市全体创业者",
        analysis="方向性口号而非精确标准，工位注册审查尺度和集群注册认定标准有弹性空间",
    ),
    ClauseAnalysis(
        clause_name="“个转企”绿色通道+贴息贷款",
        nature=ClauseNature.ENCOURAGING,
        precision=ClausePrecision.MEDIUM,
        target="个体工商户转型者",
        analysis="创业担保贷款最高300万元、财政贴息50%，政策推力明确但转型真实成本需个体核算",
    ),
    ClauseAnalysis(
        clause_name="“渝质金服”质量金融服务体系",
        nature=ClauseNature.AUTHORIZING,
        precision=ClausePrecision.MEDIUM,
        target="注册后需要金融配套的优质企业",
        analysis="用后续筛选弥补前置门槛缺失，筛选效率取决于金融服务体系的运行能力",
    ),
]

space_weight_linkage = (
    "地方规范性文件（中低权重）× 高操作弹性 = 政策效果高度依赖地方执行力度。"
    "两江新区等自贸片区的执行力强于偏远区县，可能导致区域内政策执行不均衡。"
)

# ── 分析正文 ─────────────────────────────────────────────────

diag_issuer = {
    "viz": "network",
    "title": "重庆政策发布方的目标与工具",
    "nodes": [
        {"id":"a", "label":"重庆市场监管局", "type":"political"},
        {"id":"b", "label":"工位注册", "type":"material"},
        {"id":"c", "label":"渝质金服", "type":"material"},
        {"id":"d", "label":"注册量增长", "type":"actor"}
    ],
    "edges": [
        {"source":"a", "target":"b", "label":"推行", "type":"power"},
        {"source":"a", "target":"c", "label":"建立", "type":"power"},
        {"source":"b", "target":"d", "label":"刺激", "type":"economic"},
        {"source":"c", "target":"d", "label":"后续筛选", "type":"economic"}
    ]
}

diag_beneficiary = {
    "viz": "network",
    "title": "重庆既得利益群体的受益逻辑",
    "nodes": [
        {"id":"a", "label":"个体户转型者", "type":"material"},
        {"id":"b", "label":"微型创业者", "type":"material"},
        {"id":"c", "label":"外资中小企业", "type":"material"},
        {"id":"d", "label":"个转企绿色通道", "type":"material"},
        {"id":"e", "label":"工位注册极低成本", "type":"material"}
    ],
    "edges": [
        {"source":"d", "target":"a", "label":"贴息贷款", "type":"economic"},
        {"source":"e", "target":"b", "label":"几百元可注册", "type":"economic"},
        {"source":"e", "target":"c", "label":"准入前国民待遇", "type":"legal"}
    ]
}

analysis_sections = [
    AnalysisSection(
        title="进入成本为零之后——低门槛的双面效应",
        body=(
            "“1人1工位1公司”将创业的物理门槛压到了接近零。"
            "但进入成本为零意味着退出成本也很低——"
            "投机者花几百元注册公司用于单次交易、"
            "事后以有限责任为由逃废债务的操作空间被拉大。"
        ),
        three_paths=ThreePath(
            path_a_condition="大部分注册者是真实创业，少数投机者在市场中被自然淘汰",
            path_a_behavior="注册量增长反映真实创业需求，投机者因经营不善自行注销",
            path_a_result="低门槛政策效果正面，创业生态健康发展",
            path_b_condition="投机式注册引发合同纠纷上升，监管被迫收紧",
            path_b_behavior="大量壳公司和休眠公司被用于欺诈或逃债，司法系统压力增大",
            path_b_result="政策被迫收紧反误伤真实创业者，低门槛优势丧失",
            path_c_condition="工位注册在判例中被认定为经营场所不实",
            path_c_behavior="法院对工位地址注册的公司适用法人人格否认",
            path_c_result="工位注册信用基础崩塌，制度创新被迫回退",
            synthesis="路径A为大概率（大部分创业者是真实的），路径B取决于投机注册的比例和司法反应速度，路径C为极端情形",
        ),
        diagram=diag_issuer,
        sub_conclusion="低门槛在激励创业的同时也在激励投机——关键变量是投机注册的实际比例",
    ),
    AnalysisSection(
        title="“个转企”的推力与个体的理性",
        body=(
            "政策用贴息贷款和绿色通道鼓励个体户转公司。"
            "但个体户的优势在于税负轻、监管松、退出简单——"
            "一旦转为公司，这些便利消失。"
            "对于月营业额两三万的社区便利店来说，转型大概率不划算。"
            "政策可以鼓励，但不应用补贴模糊转型的真实成本。"
        ),
        three_paths=ThreePath(
            path_a_condition="贴息贷款和绿色通道有效降低转型成本，且转型后经营改善",
            path_a_behavior="符合条件的个体户主动利用绿色通道完成转型",
            path_a_result="个转企规模扩大，市场主体质量提升",
            path_b_condition="转型成本被补贴掩盖，个体户被动转型后发现合规成本高于预期",
            path_b_behavior="部分转型企业因合规负担过重又转回个体户或注销",
            path_b_result="政策效果打折扣，部分补贴资金浪费",
            path_c_condition="贴息贷款政策被用于套利（注册公司仅为获取贷款）",
            path_c_behavior="虚假个转企骗取贴息贷款，贷款资金未用于经营",
            path_c_result="金融风险积累，政策被迫收紧贷款审核",
            synthesis="路径A为政策设计预期，路径B取决于转型后合规成本的真实感受，路径C为极端套利情形",
        ),
        diagram=diag_beneficiary,
        sub_conclusion="政策推力不等于个体理性——转型与否取决于真实成本收益核算而非补贴力度",
    ),
    AnalysisSection(
        title="“渝质金服”——用后续筛选弥补前置门槛",
        body=(
            "重庆的策略是“前门大开、后门筛选”——"
            "用极低的进入门槛吸引市场主体，"
            "然后用“渝质金服”体系在后端识别优质企业、提供金融支持。"
            "这个逻辑是否成立取决于筛选机制的效率——"
            "如果筛选能力跟不上注册增长速度，低门槛就可能变成了零筛选。"
        ),
        three_paths=ThreePath(
            path_a_condition="“渝质金服”筛选机制高效，能快速识别优质企业",
            path_a_behavior="优质企业获得金融支持并成长，劣质企业自然淘汰",
            path_a_result="“量质并举”目标实现，低门槛+后端筛选模式成功",
            path_b_condition="筛选机制效率跟不上注册增长速度",
            path_b_behavior="大量注册企业未被有效筛选，劣质企业积累",
            path_b_result="低门槛变成了零筛选，壳公司和休眠公司问题加剧",
            path_c_condition="筛选标准不合理，优质企业被误判为劣质",
            path_c_behavior="真正需要支持的企业未获得金融服务，资源错配",
            path_c_result="筛选机制公信力受损，企业对“渝质金服”失去信任",
            synthesis="路径A为政策设计预期，路径B为最大风险（筛选能力建设滞后于注册增长），路径C取决于筛选标准设计",
        ),
        sub_conclusion="“前门大开、后门筛选”的有效性取决于筛选速度能否跟上注册增长速度",
    ),
]

# ── 结论 ────────────────────────────────────────────────────────

confluence = (
    "重庆的核心策略是“以极低门槛换最大覆盖”，"
    "用“渝质金服”做后端筛选来平衡前端门槛的缺失。"
    "这个策略的有效性取决于筛选机制能否跟上注册增长速度。"
)

endgame_direction = EndgameDirection.MODIFIED_EXECUTION
endgame_key_nodes = [
    "2026-2027年：注册量快速增长，工位注册模式接受市场检验",
    "2028-2029年：首批存量筛查开始，“渝质金服”筛选效果显现",
    "2029年：五年出资期限到期，检验工位注册公司的存活率和合规率",
]

golden_sentence = "最低的门槛不意味着最好的制度——好的制度是让有心创业的人进得来，让有心套利的人暴露得快。"

# ── 附录 ────────────────────────────────────────────────────────

appendix_sources = [
    FactSource(name="《中华人民共和国公司法》（2024修订）", url="https://www.gov.cn"),
    FactSource(name="重庆市市场监管局：经营主体登记服务指南", url="https://scjgj.cq.gov.cn"),
    FactSource(name="渝快办政务服务平台", url="https://zwfw.cq.gov.cn"),
    FactSource(name="重庆市：“渝质金服”质量金融服务体系", url="https://scjgj.cq.gov.cn"),
]

# ── 组装报告 ─────────────────────────────────────────────────

report = PolicyReport(
    title="一人工位一家公司——重庆一人公司政策分析",
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
