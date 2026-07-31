"""提示词装配 — 把 analysis_prompt.md 的「写作铁律 + DIAGRAM 格式」与
theory_config.json 的「概念池 / 利益类型 / 节点边类型」组装成系统提示词。

设计要点：
- analysis_prompt.md 是单一真相源（案例型规则），运行时读取，不复制。
- 5 类型骨架（T4）：case/policy/org/opinion/combo，各自换一套报告结构；
- **双轨护栏**：SENTINEL_SECTIONS 逐字取自 KERNEL parser._SECTION_IDS，
  系统提示词强制产出与所选类型匹配的哨兵章节标题（org 7 项 / opinion 6 项 /
  case 4 项 / policy 2 项 / combo 不强制单类），生成后由 contract 后校验。
- 把理论语境（可选概念、节点/边 type 取值）注入提示词，约束 LLM 输出可被
  engine.parser + viz_network 正确消费的 Markdown。
"""
import json
import os
from app.settings import settings

# 提示词版本（阶段四：与每次生成结果一起持久化，保证报告可复现、可审计）。
# 当系统提示词（analysis_prompt.md / 结构要求 / 理论语境）发生重大变更时，递增此版本号。
PROMPT_VERSION = "1.1"

# 5 类型哨兵章节（逐字取自 KERNEL parser._SECTION_IDS，保证内核路由命中）。
# combo 不强制单类（走「≥2 类哨兵」后校验，见 contract._count_sentinel_modes）。
SENTINEL_SECTIONS: dict[str, list[str]] = {
    "case": ["案例事实摘要", "利益主体识别", "利益动线与转化", "制度与叙事作用"],
    "policy": ["政策对象图谱", "政策权重与空间分析"],
    "org": [
        "组织画像",
        "架构拆解与资金来源",
        "生存诊断",
        "繁衍诊断",
        "利益关系网络与利益集团拆解",
        "逆反诊断",
        "利益转化与组织—社会关系",
    ],
    "opinion": [
        "事件与时间线",
        "利益主体与沉默方",
        "叙事竞争矩阵",
        "三元生命维度",
        "逆反性质与层级",
        "演化曲线与系统回应",
    ],
    "combo": [],
}

# 章节数（供前端展示「所选类型 → 预计章节数」，双轨护栏显性化）
EXPECTED_CHAPTERS: dict[str, int] = {
    "case": 8,
    "policy": 8,
    "org": 9,
    "opinion": 7,
    "combo": 0,  # 组合按作者源序，不固定
}


def _read_prompt_template() -> str:
    p = os.path.join(settings.engine_dir, "analysis_prompt.md")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            return f.read()
    return ""


def _theory_context() -> str:
    cfg_path = os.path.join(settings.engine_dir, "theory_config.json")
    if not os.path.exists(cfg_path):
        return ""
    try:
        with open(cfg_path, encoding="utf-8") as f:
            data = json.load(f)
        concepts = [c.get("name", "") for c in data.get("concept_pool", [])][:24]
        interests = [
            f'{t.get("id")}({t.get("name", "")})'
            for t in data.get("interest_types", [])
        ]
        nodes = [
            f'{n.get("id")}({n.get("name", "")})'
            for n in data.get("visualization", {}).get("node_types", [])
        ]
        edges = [
            f'{e.get("id")}({e.get("name", "")})'
            for e in data.get("visualization", {}).get("edge_types", [])
        ]
        lines = []
        if concepts:
            lines.append("可选概念池（单篇选用 ≤3 个）：" + "、".join(concepts))
        if interests:
            lines.append("六类利益：" + "，".join(interests))
        if nodes:
            lines.append("网络图节点 type 取值：" + "，".join(nodes))
        if edges:
            lines.append("网络图边 type 取值：" + "，".join(edges))
        return "\n".join(lines)
    except Exception:
        return ""


# 案例型 8 段结构（含事件深度分析哨兵章节，与 parser._SECTION_IDS 对齐）
CASE_STRUCTURE = """报告结构（严格按顺序，用 ## 二级标题）：
## 案例事实摘要
## 分析框架说明
## 利益主体识别
## 利益动线与转化
## 制度与叙事作用
## 三元结构分析正文（下设 ### 第N节：冲突式标题）
## 结论
## 附录
"""

# 政策型 8 段结构（与 parser 已知 section id 对齐）
POLICY_STRUCTURE = """报告结构（严格按顺序，用 ## 二级标题）：
## 封面页
## 独立事实摘要
## 分析框架说明
## 政策对象图谱（下设 ### 基本信息 / ### 发布主体与主题画像 / ### 受影响群体（四分法） / ### 行业影响矩阵 / ### 时间维度预判）
## 政策权重与空间分析（下设 ### 权重层级判定 / ### 操作空间评估）
## 三元结构分析正文（下设 ### 第N节：冲突式标题）
## 结论与推导（下设 ### 汇流段 / ### 博弈终局预判 / ### 可传播金句）
## 附录/数据溯源
"""

# 组织诊断 9 段结构（哨兵 7 项 + 诊断结论 + 附录）
ORG_STRUCTURE = """报告结构（严格按顺序，用 ## 二级标题）：
## 组织画像
## 架构拆解与资金来源
## 生存诊断
## 繁衍诊断
## 利益关系网络与利益集团拆解
## 逆反诊断
## 利益转化与组织—社会关系
## 诊断结论
## 附录
"""

# 舆情分析 7 段结构（哨兵 6 项 + 结论 + 附录）
OPINION_STRUCTURE = """报告结构（严格按顺序，用 ## 二级标题）：
## 事件与时间线
## 利益主体与沉默方
## 叙事竞争矩阵
## 三元生命维度
## 逆反性质与层级
## 演化曲线与系统回应
## 结论
## 附录
"""

# 组合模式：至少 2 类哨兵混编（作者源序），不强制单类骨架
COMBO_STRUCTURE = """报告结构（组合模式）：
融合至少两类分析框架（事件/政策/组织/舆情）的章节骨架，按作者分析顺序组织；
必须至少包含 2 类以上的哨兵章节（如「政策对象图谱」+「组织画像」+「事件与时间线」混编）。
用 ## 二级标题，顺序自定，结尾以 ## 附录 收束。
"""


def _structure_for(analysis_type: str) -> str:
    if analysis_type == "policy":
        return POLICY_STRUCTURE
    if analysis_type == "org":
        return ORG_STRUCTURE
    if analysis_type == "opinion":
        return OPINION_STRUCTURE
    if analysis_type == "combo":
        return COMBO_STRUCTURE
    return CASE_STRUCTURE


def build_system_prompt(analysis_type: str = "case") -> str:
    base = _read_prompt_template()
    structure = _structure_for(analysis_type)
    theory = _theory_context()
    guard = SENTINEL_SECTIONS.get(analysis_type, [])
    sentinel_block = ""
    if guard:
        lines = "\n".join(f"## {s}" for s in guard)
        sentinel_block = f"""

# 类型一致性强制（必须原样包含以下 ## 二级标题，缺任一即视为生成失败）
{lines}
"""
    elif analysis_type == "combo":
        sentinel_block = """

# 类型一致性强制（组合模式：必须至少包含 2 类以上的哨兵章节，缺则视为生成失败）
例如：## 政策对象图谱、## 组织画像、## 事件与时间线、## 叙事竞争矩阵 等混编。
"""
    return f"""{base}

# 报告结构要求（必须严格遵守）
{structure}

# 理论语境（供概念与节点/边类型选择参考）
{theory}
{sentinel_block}
# 输出约束
- 仅输出 Markdown 正文，不要输出任何解释性文字，不要用代码围栏包裹整篇。
- 必须包含至少一个 ```DIAGRAM 利益关系图（合法 JSON，可被 json.loads 解析）。
- 文末附版权声明行：分析框架：三元结构理论 © 2026, CC BY-NC-SA 4.0，国作登字-2026-A-00048134

# 分析质量增强建议（强烈推荐，提升报告可用性）
在正文合适位置补充以下章节，使报告不止于框架推演：
- **证据与依据**：每条结论尽量附可核验的证据/来源（文件、数据、公开记录），不虚构出处。
- **核心冲突点**：单列各方矛盾焦点（可标注【冲突方】）。
- **置信度**：在框架说明处给出本次判断的置信度（高/中/低）及理由。
- **行动建议**：针对相关主体给出可执行处置建议（标注建议对象与理由）。
若材料不足以支撑，宁可在对应章节注明「依据不足」，也不要编造。
"""
