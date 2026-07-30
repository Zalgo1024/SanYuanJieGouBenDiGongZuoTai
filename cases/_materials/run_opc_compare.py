"""
北京 vs 重庆：一人公司政策对比与落地指南 — 强类型 ComparisonReport 版
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from typed_report import (
    ComparisonReport, ComparisonDimension, FactSource,
    ConceptSelection, AnalysisSection, ThreePath,
)
from engine import CaseAnalysisEngine


# ── 事实摘要 ─────────────────────────────────────────────────

fact_summary = (
    "2024年7月1日，新修订《中华人民共和国公司法》施行，"
    "全面取消一人有限责任公司设立数量限制和最低注册资本要求。"
    "北京和重庆作为率先落实的公司法地方配套城市，形成了两种不同的政策路径。\n\n"
    "北京路径：“一标四维”标准化登记 + AI赋能 + 全程网办（e窗通平台）\n"
    "重庆路径：“1人1工位1公司”极简注册 + 金融配套（渝质金服）+ 个转企绿色通道\n\n"
    "本报告聚焦于两个问题：\n"
    "1. 北京和重庆的政策差异在哪些维度上？各自的利弊是什么？\n"
    "2. 一个创业者如果要在北京或重庆注册一人公司，从申请到落地的完整流程是什么？"
)

fact_sources = [
    FactSource(name="《中华人民共和国公司法》（2024修订）", url="https://www.gov.cn"),
    FactSource(name="北京市市场监管局“一标四维”工作措施", url="https://scjgj.beijing.gov.cn"),
    FactSource(name="重庆市市场监管局《经营主体登记服务指南》", url="https://scjgj.cq.gov.cn"),
]

# ── 分析框架 ─────────────────────────────────────────────────

core_tension = (
    "北京选择“先建标准再开门”——用标准化框架替代旧的行政审批，确保门开得规范；"
    "重庆选择“先把门开到最大再配套”——用最低的物理门槛吸引最多的创业者，"
    "然后通过金融服务和质量体系来筛选和支持其中的优质企业。"
    "两条路径没有绝对的对错，但各有其适用的创业者类型。"
)

core_proposition = (
    "北京路径适合有明确商业计划、重视制度确定性的创业者；"
    "重庆路径适合试水型、成本敏感的微型创业者。"
    "两地共同面临的挑战是：低门槛带来注册量增长的同时，"
    "如何识别和处置“投机性注册”和“休眠公司”。"
)

concepts = [
    ConceptSelection(
        observed_pattern="北京用标准化暴露投机者，重庆用金融筛选暴露投机者",
        concept_name="制度管道",
        how_it_explains="两条路径用不同的制度管道设计来实现同一目标——让该进来的人进得来，不该进来的人暴露得快",
        analysis_question="标准化筛选和金融筛选哪种方式的暴露效率更高？",
    ),
    ConceptSelection(
        observed_pattern="北京标准化程度高但数字鸿沟大；重庆门槛低但筛选滞后",
        concept_name="成本-收益核算",
        how_it_explains="两种路径的成本和收益分布在不同群体上——北京的收益集中在科技创业者，重庆的收益集中在微型创业者",
        analysis_question="两种路径下，谁是净受益者、谁是净受损者？",
    ),
]

# ── 对比维度 ─────────────────────────────────────────────────

comparison_dimensions = [
    ComparisonDimension(
        name="政策文件",
        value_a="“一标四维”登记措施（2024.7）",
        value_b="经营主体登记服务指南（2026.3）",
        analysis="北京先于重庆发布配套政策，政策衔接更早",
    ),
    ComparisonDimension(
        name="网上平台",
        value_a="“e窗通”（ect.scjgj.beijing.gov.cn）",
        value_b="“渝快办”（zwfw.cq.gov.cn）",
        analysis="两地均有线上平台，北京更强调全程网办，重庆支持线上线下多渠道",
    ),
    ComparisonDimension(
        name="住所门槛",
        value_a="中关村/经开区集群注册+工位注册",
        value_b="全市推行“1人1工位=1公司”",
        analysis="重庆门槛更低——全市推行而非限定特定区域",
    ),
    ComparisonDimension(
        name="注册时限",
        value_a="1个工作日内",
        value_b="0.5个工作日内（自贸区）",
        analysis="重庆自贸区内更快，但北京全市统一1个工作日",
    ),
    ComparisonDimension(
        name="金融配套",
        value_a="无专门一人公司金融产品",
        value_b="“渝质金服”质量金融服务体系",
        analysis="重庆独有的后续筛选机制——用金融服务识别和支持优质企业",
    ),
    ComparisonDimension(
        name="个转企支持",
        value_a="无专门绿色通道",
        value_b="绿色通道+创业担保贷款贴息（最高300万，贴息50%）",
        analysis="重庆对个体户转型有更强的政策推力",
    ),
    ComparisonDimension(
        name="外资准入",
        value_a="国民待遇，无额外限制",
        value_b="准入前国民待遇+负面清单",
        analysis="重庆对外资更友好——负面清单管理提供更清晰的准入预期",
    ),
    ComparisonDimension(
        name="路径逻辑",
        value_a="标准化优先——让程序更可预期",
        value_b="进入成本优先——把物理门槛压到最低",
        analysis="北京适合需要制度确定性的创业者；重庆适合试水型、成本敏感的创业者",
    ),
    ComparisonDimension(
        name="筛选机制",
        value_a="标准化——审查口径统一，异常自动暴露",
        value_b="金融筛选——“渝质金服”后端识别优质企业",
        analysis="北京靠制度暴露，重庆靠金融暴露——前者即时但刚性，后者滞后但柔性",
    ),
]

# ── 分析正文 ─────────────────────────────────────────────────

analysis_sections = [
    AnalysisSection(
        title="两条路径的核心逻辑差异",
        body=(
            "北京的路径逻辑是标准化优先。"
            "“一标四维”的核心不是“减少程序”，而是“让程序更可预期”——"
            "登记标准统一、审查口径一致、系统自动校验。"
            "这套逻辑适合有明确商业计划、需要稳定的制度预期的创业者——"
            "特别是科技创新类一人公司。\n\n"
            "重庆的路径逻辑是进入成本优先。"
            "“1人1工位1公司”的核心是把创业的物理门槛压到最低——"
            "一个工位月租几百元即可维持一家公司的法人身份。"
            "这套逻辑适合试水型创业者——"
            "先低成本注册一家公司试试看，跑不通用工位的最低成本退场。\n\n"
            "两条路径代表了两种不同的制度设计哲学："
            "北京是“先建标准再开门”，重庆是“先把门开到最大再配套”。"
        ),
        three_paths=ThreePath(
            path_a_condition="两地政策各自运行，创业者按自身特征选择注册地",
            path_a_behavior="科技创业者流向北京，微型创业者流向重庆",
            path_a_result="两种路径各自服务目标群体，形成差异化竞争",
            path_b_condition="一地政策优势过于明显，创业者大量涌入单一城市",
            path_b_behavior="另一地的政策吸引力下降，注册量停滞",
            path_b_result="政策竞争失衡，落后城市被迫调整政策",
            path_c_condition="两地政策趋同，差异化优势消失",
            path_c_behavior="创业者不再基于政策差异选择注册地，而是基于其他因素",
            path_c_result="政策对比的意义降低，对比分析失去价值",
            synthesis="路径A为大概率（两地政策定位差异化明确），路径B取决于政策效果差异的显著程度",
        ),
        sub_conclusion="北京标准化优先 vs 重庆进入成本优先——两种制度设计哲学服务不同类型的创业者",
    ),
    AnalysisSection(
        title="利益得失对比——谁是净受益者",
        body=(
            "科技/互联网创业者在北京路径下受益——标准化登记+数字化流程适合技术背景的创业者。"
            "个体户转型者在重庆路径下受益——绿色通道+贴息贷款的政策推力最强。"
            "微型成本敏感型创业者在重庆路径下受益——极低工位成本，启动资金压力最小。\n\n"
            "中老年不擅长数字操作的创业者在北京路径下受损——全程网办造成数字鸿沟；"
            "在重庆路径下中性偏受益——重庆保留了更多线下渠道。\n\n"
            "传统代理注册机构在两地路径下均受损——"
            "北京的标准化和重庆的极低门槛都在压缩代办需求。"
        ),
        three_paths=ThreePath(
            path_a_condition="两地政策互补运行，各类创业者各取所需",
            path_a_behavior="科技创业者选北京，成本敏感型选重庆，代理机构两地均需转型",
            path_a_result="利益分配最优化，两地政策各自服务目标群体",
            path_b_condition="一类创业者被两地政策同时忽视",
            path_b_behavior="该群体在两地均面临制度障碍，无法获得有效服务",
            path_b_result="政策覆盖出现盲区，需要第三种路径或政策调整",
            path_c_condition="利益受损群体（如代理机构）形成集体行动",
            path_c_behavior="代理机构游说或集体施压，要求政策调整",
            path_c_result="政策被迫为利益受损群体提供过渡期或补偿",
            synthesis="路径A为大概率（两地政策定位差异化明确），路径B取决于是否存在政策盲区",
        ),
        sub_conclusion="两地政策的利益得失分布在不同群体上——没有一条路径能让所有人受益",
    ),
]

# ── 总结 ────────────────────────────────────────────────────────

summary_table = (
    "| 创业者类型 | 推荐城市 | 理由 |\n"
    "|---|---|---|\n"
    "| 科技/互联网创业 | 北京 | 标准化登记+中关村生态+AI赋能 |\n"
    "| 个体工商户升级 | 重庆 | 绿色通道+贴息贷款+低工位成本 |\n"
    "| 试水型创业（预算极低） | 重庆 | 极低工位月租+0.5天注册+免费公章 |\n"
    "| 追求制度确定性 | 北京 | “一标四维”标准化框架更加成熟 |\n"
    "| 外资中小企业 | 重庆 | 准入前国民待遇+负面清单+低成本进入 |\n"
    "| 需要金融配套 | 重庆 | “渝质金服”体系提供融资和质量服务 |\n"
    "| 不熟悉线上操作 | 重庆 | 保留更多线下办理渠道 |"
)

findings = (
    "北京和重庆的一人公司政策代表了两种不同的制度设计哲学。"
    "北京选择“先建标准再开门”——用标准化框架替代旧的行政审批，确保门开得规范；"
    "重庆选择“先把门开到最大再配套”——用最低的物理门槛吸引最多的创业者，"
    "然后通过金融服务和质量体系来筛选和支持其中的优质企业。\n\n"
    "两条路径没有绝对的对错。北京的路径更适合有明确商业计划、重视制度确定性的创业者；"
    "重庆的路径更适合试水型、成本敏感的微型创业者。\n\n"
    "两地共同面临的挑战是：低门槛带来注册量增长的同时，"
    "如何识别和处置“投机性注册”和“休眠公司”。\n\n"
    "注册落地流程方面，两地均为5步：名称申报→填报信息→电子签名→领取执照→后续手续。"
    "北京全程线上（e窗通），重庆支持线上线下（渝快办）。"
    "重庆自贸区内注册更快（0.5工作日 vs 1工作日），且有贴息贷款和金融服务等独有配套。"
)

golden_sentence = "最好的创业政策不是让注册越来越简单，而是让该进来的人进得来、不该进来的人暴露得快——北京选择了“标准化”来暴露，重庆选择了“金融筛选”来暴露。"

# ── 附录 ────────────────────────────────────────────────────────

appendix_sources = [
    FactSource(name="《中华人民共和国公司法》（2024修订）", url="https://www.gov.cn"),
    FactSource(name="北京市市场监管局：“一标四维”登记工作措施", url="https://scjgj.beijing.gov.cn"),
    FactSource(name="北京市企业服务e窗通平台", url="https://ect.scjgj.beijing.gov.cn"),
    FactSource(name="重庆市市场监管局：经营主体登记服务指南", url="https://scjgj.cq.gov.cn"),
    FactSource(name="渝快办政务服务平台", url="https://zwfw.cq.gov.cn"),
]

# ── 组装报告 ─────────────────────────────────────────────────

report = ComparisonReport(
    title="北京vs重庆：一人公司政策对比与落地指南",
    subject_a="北京",
    subject_b="重庆",
    comparison_dimensions=comparison_dimensions,
    summary_table=summary_table,
    findings=findings,
    fact_summary=fact_summary,
    fact_sources=fact_sources,
    core_tension=core_tension,
    core_proposition=core_proposition,
    concepts=concepts,
    analysis_sections=analysis_sections,
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
