"""
杨世祥案 — typed CaseReport 完整流程（含深度分析 + DIAGRAM）
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from typed_report import *
from engine import CaseAnalysisEngine

report = CaseReport(
    title='一个财政局副局长的主动投案——杨世祥案的结构性分析',
    fact_summary='2026年6月26日，惠州市纪委监委通过"惠州清风"通报：惠城区财政局副局长杨世祥涉嫌严重违法，主动投案，接受惠城区监委监察调查。根据2025年11月发布的局领导分工调整通知，杨世祥分管经济建设股、政府采购事务中心、工程预结算审核中心、政府债务监测中心等8个部门——涵盖政府采购、工程审核、政府债务三大高风险领域。',
    fact_timeline=[
        TimelineEntry('2025-11','惠城区财政局发布领导分工调整通知，杨世祥分管8个部门（采购、审核、债务）'),
        TimelineEntry('2026-06-26','杨世祥主动投案，同日接受惠城区监委监察调查'),
    ],
    fact_sources=[
        FactSource('惠州清风 2026.6.26',''),
        FactSource('南方都市报 2026.6.26',''),
    ],
    core_tension='一个分管政府采购和工程审核的副局长选择主动投案——这不是道德觉醒，而是监察压力下的理性计算。为什么是现在？为什么以这种方式？为什么在这个岗位？',
    core_proposition='杨世祥的主动投案是制度威慑与个人利益核算的共同产物——当被查出的概率超过心理阈值，投案从考虑项变为最优项。',
    concepts=[
        ConceptSelection('主动投案的时间选择——在已有线索但未正式立案时投案可适用从宽条款','成本-收益核算','投案不是道德选择，是法律计算。监察法第31条确立的从宽机制使投案成为博弈中的理性策略','为什么选择在6月26日这个时点投案？投案可以为他争取到什么？'),
        ConceptSelection('杨世祥同时分管政府采购、工程审核、政府债务三个高风险领域——制度分工将权力集中在一人身上','制度管道','财政局内部的分工体系形成了一条从资金分配到采购招标到工程审计的利益管道。三个原本应相互制衡的权力集中在同一分管领导手中','制度分工如何塑造了一个岗位的廉政风险结构？这种集权是否可避免？'),
        ConceptSelection('监委通报用"涉嫌严重违法"而非"涉嫌严重违纪违法"——缺一个"违纪"二字','激励-约束','措辞差异暗示被调查人可能为非党员，或案件性质偏重职务违法。调查路径因此不同：非党员不经过纪委审查环节，监委直接启动调查','措辞的选择如何影响调查路径？这对杨世祥的法律处境意味着什么？'),
    ],
    analysis_sections=[
        AnalysisSection(
            title='主动投案的成本收益核算——为什么是这个时点',
            body='监察法第31条规定：自动投案、如实供述自己罪行的，可以从宽处罚。这个"可以从宽"包含实体上的量刑减让和程序上的强制措施宽松。对于已经被纪委监委纳入视线的人来说，在正式立案调查之前主动投案，是法律框架内唯一的减损策略。杨世祥选择在2026年6月投案，最可能的场景是：他已经感知到调查线索正在逼近——同事被约谈、关联企业被调查、银行流水被调取。当"被查到的概率"超过某个心理阈值时，投案就从"考虑选项"变成了"最优选项"。这不是道德觉醒——是制度改变了博弈的成本函数。',
            three_paths=ThreePath(
                path_a_condition='监委已掌握部分线索并开始外围调查',
                path_a_behavior='杨世祥感知到压力，主动投案',
                path_a_result='适用从宽条款，争取量刑减让和强制措施宽松',
                path_b_condition='监委调查线索不足或被调查人误判了风险',
                path_b_behavior='杨世祥选择观望等待而非投案',
                path_b_result='如果侥幸逃脱则为零成本；如果最终被查则为从严惩处',
                path_c_condition='关联案件中牵出更严重的违法事实',
                path_c_behavior='即使投案也无法获得实质性从宽',
                path_c_result='投案对量刑影响有限，面临较重的刑事责任',
                synthesis='路径A最可能——6月26日的投案时间点暗示线索已逼近到不可忽视的程度。同时投案可以获得确定性的从宽收益，而继续等待的不确定性损失更大。',
            ),
            diagram={
                "viz":"network","title":"杨世祥投案的成本收益博弈",
                "nodes":[
                    {"id":"a","label":"杨世祥","type":"actor"},
                    {"id":"b","label":"监委","type":"political"},
                    {"id":"c","label":"投案从宽","type":"material"},
                    {"id":"d","label":"被查从严","type":"material"},
                    {"id":"e","label":"关联案件","type":"actor"},
                ],
                "edges":[
                    {"source":"a","target":"b","label":"主动投案","type":"power"},
                    {"source":"a","target":"c","label":"争取","type":"legal"},
                    {"source":"b","target":"d","label":"线索逼近","type":"power"},
                    {"source":"e","target":"a","label":"牵出风险","type":"power"},
                ]
            },
            sub_conclusion='投案时点的选取本身就是一场信息不对称下的博弈——谁更早感知到线索逼近，谁就更早占据从宽的先机。',
        ),
        AnalysisSection(
            title='制度管道的结构性风险——为什么是这个岗位',
            body='杨世祥分管的八个部门构成了一条完整的财政业务链。经济建设股负责资金分配——钱从哪里来；政府采购事务中心负责招标——钱怎么花；工程预结算审核中心负责审计——花了怎么算；政府债务监测中心负责举债——不够花怎么借。从钱从哪里来到钱怎么花到花了怎么审到不够花怎么借——杨世祥恰好处于这条管道的枢纽位置。这不是说分工本身是错的。需要关注的是，当"资金分配""采购审批""工程审计"这三个原本应该相互制衡的权力集中在同一个分管领导手中时，权力制衡机制就被绕过了。一个想在这条链上牟利的人不需要"打通"三个不同的领导——他只需要搞定一个。',
            three_paths=ThreePath(
                path_a_condition='制度分工不调整',
                path_a_behavior='后续接任者同样集权管采购+审核+债务',
                path_a_result='同一岗位再次爆发廉政风险，形成制度性漏洞',
                path_b_condition='惠城区财政局调整分工',
                path_b_behavior='将采购和审核分离给不同副局长分管',
                path_b_result='管道的制衡功能恢复，同一岗位的风险降低',
                path_c_condition='全市财政系统推行标准化分工',
                path_c_behavior='高风险业务条线强制分离到不同分管领导',
                path_c_result='系统性降低财政系统廉政风险',
                synthesis='路径B是最优的制度修复——但需要组织部门的配合。监委可以发监察建议，但无权直接调整行政分工。本案后的制度整改效果取决于监委和组织部门的协同效率。',
            ),
            diagram={
                "viz":"network","title":"杨世祥分管的财政权力管道",
                "nodes":[
                    {"id":"a","label":"经济建设股\n资金分配","type":"material"},
                    {"id":"b","label":"采购中心\n招标","type":"material"},
                    {"id":"c","label":"审核中心\n审计","type":"material"},
                    {"id":"d","label":"债务中心\n举债","type":"material"},
                    {"id":"e","label":"杨世祥\n分管副局长","type":"actor"},
                ],
                "edges":[
                    {"source":"e","target":"a","label":"分管","type":"power"},
                    {"source":"e","target":"b","label":"分管","type":"power"},
                    {"source":"e","target":"c","label":"分管","type":"power"},
                    {"source":"e","target":"d","label":"分管","type":"power"},
                    {"source":"a","target":"b","label":"资金→采购","type":"economic"},
                    {"source":"b","target":"c","label":"采购→审计","type":"legal"},
                ]
            },
            sub_conclusion='制度分工决定了一个岗位的廉政风险结构——不是人的问题，是权力配置的问题。',
        ),
        AnalysisSection(
            title='"涉嫌严重违法"的措辞密码——缺一个"违纪"意味着什么',
            body='监委通报的措辞从来不是随机的。"涉嫌严重违法"和"涉嫌严重违纪违法"之间差了一个"违纪"——通常意味着被调查人不是中共党员，或者是职务违法的性质远重于党纪违规。如果杨世祥是非中共党员（民主党派或无党派人士），监察调查的路径就不同于党员。对党员的调查是纪委和监委联合进行——纪委审查党纪问题在前，监委调查职务违法犯罪在后。对非党员的调查，监委直接启动，不经过纪委审查环节。这个制度管道差异会影响案件走向。非党员不涉及党纪处分，监委的调查结论直接进入司法程序——调查效率可能更高，但也意味着缺少了一次党内审查的缓冲。对杨世祥来说，他也无法通过党内程序争取"主动交代"的从宽认定——所有从宽的依据都来自监察法而非党纪。',
            three_paths=ThreePath(
                path_a_condition='杨世祥确为非党员',
                path_a_behavior='监委直接调查，不经过纪委审查',
                path_a_result='调查效率高，但从宽认定的渠道只有监察法',
                path_b_condition='杨世祥为党员但违法性质重于违纪',
                path_b_behavior='纪委和监委联合调查',
                path_b_result='双渠道从宽认定，但双渠道追责',
                path_c_condition='调查发现涉及更复杂的犯罪网络',
                path_c_behavior='案件移交上级监委或并案处理',
                path_c_result='调查周期延长，从宽认定的时间窗口可能关闭',
                synthesis='路径A最可能——通报措辞的选择暗示杨世祥可能为非党员，且违法性质偏重经济问题。这对他最直接的后果是从宽认定只能走监察法渠道。',
            ),
        ),
    ],
    confluence='杨世祥案不是一个贪官的道德沦陷故事，而是一个制度压力、岗位风险和个人计算三者交汇的产物。主动投案的本质是监察体制改革后，制度改变了博弈的成本函数——当自己走进来的代价低于被带走的代价时，投案就从觉悟问题变成了效率问题。从制度分工角度看，一个人同时分管采购、审核、债务——不是他个人的问题，是权力配置的制度风险。从措辞选择角度看，"涉嫌严重违法"五个字背后隐藏着身份信息和调查路径的差异——这些细节共同构成了一个比"又一个贪官落马"更丰富的制度故事。',
    # 三、事件对象图谱
    event_profile=(
        "Who：惠城区财政局副局长杨世祥，分管经济建设股、政府采购事务中心、工程预结算审核中心、政府债务监测中心等8个部门。"
        "When：2025年11月领导分工调整 → 2026年6月26日主动投案。"
        "What：涉嫌严重违法，主动投案接受惠城区监委监察调查。"
        "How：通过主动投案争取监察法第31条从宽条款。"
        "Where：惠州市惠城区财政局。"
        "Why：分管领域（采购、审核、债务）构成完整利益管道，制度性风险集中爆发。"
        "How much：涉及8个部门的分管权力，涵盖政府采购、工程审核、政府债务三大高风险领域。"
    ),
    event_stakeholders=[
        Stakeholder(name='杨世祥', role='当事人/利益受损者', identification='惠城区财政局副局长，主动投案', interest='通过投案争取从宽处理，降低刑事责任', immediate_impact='人身自由受限，进入监察调查程序', long_term_impact='可能面临刑事判决和职业终结'),
        Stakeholder(name='惠城区监委', role='制度执行者', identification='案件调查主体', interest='通过查办案件展示制度威慑力，巩固监察体制改革成果', immediate_impact='案件进入调查程序，需投入调查资源', long_term_impact='强化主动投案信号，推动财政系统内控完善'),
        Stakeholder(name='惠城区财政局', role='制度关联者', identification='杨世祥的任职单位', interest='维护机构廉政声誉，推动内控制度修复', immediate_impact='声誉受损，面临组织部门的分工调整压力', long_term_impact='内控机制完善，分管机制调整'),
        Stakeholder(name='社会公众', role='旁观者/信息接收者', identification='通过媒体报道了解案件的公众', interest='知情权、对基层财政系统廉政状况的监督权', immediate_impact='形成对监察制度有效性的认知', long_term_impact='每一次主动投案都在强化公众对制度的信任'),
    ],
    event_social_impact=[
        ImpactEntry(level='直接影响', target='惠城区财政系统', transmission_path='副局长主动投案 → 机构声誉受损 → 组织部门面临调整分管机制的压力'),
        ImpactEntry(level='间接影响', target='广东财政系统', transmission_path='同日通报多起案件 → 集群效应 → 财政系统廉政风险被广泛关注'),
        ImpactEntry(level='潜在机会', target='监察体制改革', transmission_path='主动投案案例积累 → 制度威慑信号强化 → 推动更多潜在投案者理性计算'),
    ],
    event_time_dimension=[
        TimeDimension(phase='短期', time_window='2026年6-12月', forecast='监委调查完成，移送检察机关审查起诉；惠城区财政局可能面临分管调整'),
        TimeDimension(phase='中期', time_window='2026-2028年', forecast='司法判决落地，从宽幅度确定；财政系统内控机制可能升级；同类岗位风险排查'),
        TimeDimension(phase='长期', time_window='2028年以后', forecast='主动投案成为制度常态，监察威慑持续强化；制度分工改革效果取决于执行力度'),
    ],
    core_judgment='杨世祥投案不是因为比别人更诚实，而是因为他比别人更早算清楚了账——制度分工把他放在了高风险岗位上，监察压力让他最先感知到线索逼近，法律从宽条款给了他一个比逃亡更理性的出口。',
    golden_sentence='当制度让自己走进来比被带走更划算时，投案就不是觉悟问题，是效率问题。',
    endgame_direction='制度完善——监委调查推动财政系统内控机制升级，主动投案成为理性常态',
    endgame_key_nodes=[
        '关键节点1：监委调查结论发布，确定杨世祥涉案性质和金额',
        '关键节点2：检察机关审查起诉，从宽幅度进入司法裁定阶段',
        '关键节点3：惠城区财政局完成分管机制调整，制度性修复落地',
    ],
    appendix_sources=[
        FactSource('惠州清风 2026.6.26',''),
        FactSource('南方都市报 2026.6.26',''),
        FactSource('金羊网 2026.6.26',''),
    ],
    # ── 深度分析 ──
    dimension_diagnosis=DimensionDiagnosis(
        primary_dimension='利益',
        secondary_dimensions=['逆反'],
        diagnosis_rationale='本案的核心驱动是利益维度——杨世祥的分管领域（采购、审核、债务）构成完整的利益管道，涉及物质利益（资金分配权）和政治利益（监管制度）。次维度是逆反——主动投案是对监察压力的反向行为，属于逆反中的个体被动反应。',
    ),
    interest_analysis=[
        InterestTypeAnalysis('物质利益','杨世祥','分管政府采购和工程审核，掌握资金分配和项目发包的实际权力','具体金额未公开——待监委调查结论'),
        InterestTypeAnalysis('政治利益','监委','通过查办主动投案案件展示制度威慑力，巩固监察体制改革的政治成果','同一天广东通报多起案件——形成集群效应'),
        InterestTypeAnalysis('安全利益','杨世祥','投案后的法律处境：监察留置→取保候审→量刑从宽的全链条争取','取决于认罪态度和配合程度'),
        InterestTypeAnalysis('身份与文化利益','惠州清风/监委','"主动投案"叙事取代"被抓"叙事——塑造腐败分子的认罪形象，强化公众对制度的信任','微信公众号+官方媒体转发的传播矩阵'),
        InterestTypeAnalysis('制度性未来利益','惠城区财政局','案件暴露出财政系统分工结构的制度风险——组织部门面临调整分管机制的压力','制度修复的窗口期——调查结论发布后'),
        InterestTypeAnalysis('公共利益','社会公众','对基层财政系统廉政状况的知情权和对监查制度有效性的认知','案件公开程度决定了公共利益兑现的充分性'),
    ],
    flow_tracking=[
        InterestFlow('杨世祥','监委','power','主动投案信息+个人行踪','监委通报触发','启动监察调查程序，杨世祥人身自由受限'),
        InterestFlow('监委','公众','cultural','"惠州清风"案件通报','舆论关注','建立制度威慑的社会认知，强化主动投案信号'),
        InterestFlow('监委','惠城区财政局','legal','监察建议（可能的后续）','调查发现分工制度风险','推动分工调整和内控机制完善'),
        InterestFlow('关联企业','杨世祥','economic','可能的利益输送','监委调查','揭开政府采购和工程审核中的利益链'),
    ],
    narrative_analysis=NarrativeAnalysis(
        dominant_narrative='"主动投案彰显反腐震慑力"——将个人行为转化为制度成效',
        narrator='纪委监委（惠州清风为官方渠道）',
        channel='微信公众号首发+南方都市报等官方媒体转发',
        counter_narrative='暂无公开反叙事——杨世祥本人尚未公开发声，辩护律师未介入公开阶段',
        legitimacy_effect='双重效果：①向同级官员传递"早投案早从宽"的信号 ②向公众展示监察制度的有效性——每一次主动投案都在强化下一次投案的理性预期',
    ),
    institution_analysis=InstitutionAnalysis(
        relevant_institution='监察法第31条（主动投案从宽）+惠城区财政局内控制度+政府采购法',
        function='监察法31条为主动投案提供制度层面的从宽激励。财政内控和政府采购制度本应在事前起到权力制衡作用——这次案件暴露了制度执行的缺口',
        path_dependency='监察体制改革以来（2018年至今），主动投案数量逐年上升——制度信号正在转化为行为惯性。每一个主动投案都在巩固"投案是更理性选择"的社会认知',
        winners='监委（制度威慑力增强）、后续投案者（先例从宽效果）',
        losers='杨世祥（面临刑事责任）、惠城区财政局（廉政声誉受损）、政府采购领域（制度信任受冲击）',
    ),
    historical_dynamics=HistoricalDynamics(
        incentive_constraint='监察法31条"主动投案从宽"=投案的激励；监委外围调查能力=逃脱的约束。激励-约束同时加强，使投案成为理性最优解',
        embedding_institutionalization='主动投案从2018年监察法实施初期的"个案"固化为2026年的"制度预期"——每一个投案都在强化下一个投案者的理性计算，形成自我强化的正反馈',
        legitimation_narrativization='"惠州清风"通报选择"涉嫌严重违法"而非"涉嫌严重违纪违法"——措辞本身就是叙事选择。一个字的差异决定了公众对案件性质的理解框架',
        chain_spillover='6月26日广东同日通报多起案件——单个投案被集群效应放大为系统性信号。财政系统的风险外溢到政府采购和工程审核领域的制度信任',
    ),
)

if __name__ == "__main__":
    from typed_report import validate_report
    errors = validate_report(report, 'case')
    if errors:
        print(f"校验未通过 ({len(errors)} 项):")
        for e in errors:
            print(f"  - {e}")
        sys.exit(1)
    
    engine = CaseAnalysisEngine()
    result = engine.export_from_typed(report)
    
    print("=" * 60)
    print("报告生成完成！")
    print(f"  Word:  {result['word']}")
    print(f"  PDF:   {result['pdf']}" if result['pdf'] else "  PDF:   未生成")
    print(f"  目录:  {result['folder']}")
    diagrams = result.get("diagrams", [])
    if diagrams:
        print(f"  图表 ({len(diagrams)} 张):")
        for d in diagrams:
            print(f"      {d['title']}")
    print("=" * 60)
