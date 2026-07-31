// 三元结构分析平台 — 设计稿共享数据
// 所有配色 / 文案 / 数值均严格取自 Ardot 画布（fileId: 701659968333031）

/** 六类利益 + 主体 配色（与画布图例、tailwind token 一致） */
export const INTEREST = {
  material: "#E74C3C", // 物质利益
  safety: "#F49C12", // 安全利益
  political: "#2E86C1", // 政治利益
  identity: "#8E44AD", // 身份文化利益
  future: "#1ABC9C", // 制度性未来利益
  public: "#27AE60", // 公共利益
  subject: "#343E5E", // 主体
} as const;

export type InterestKey = keyof typeof INTEREST;

/** 网络图图例 — 节点类型（7 项） */
export const NODE_LEGEND: { label: string; color: string }[] = [
  { label: "物质利益", color: INTEREST.material },
  { label: "安全利益", color: INTEREST.safety },
  { label: "政治利益", color: INTEREST.political },
  { label: "身份文化利益", color: INTEREST.identity },
  { label: "制度性未来利益", color: INTEREST.future },
  { label: "公共利益", color: INTEREST.public },
  { label: "主体", color: INTEREST.subject },
];

/** 网络图图例 — 路径类型（4 项） */
export const PATH_LEGEND: { label: string; color: string }[] = [
  { label: "经济路径", color: "#2ECC71" },
  { label: "权力路径", color: "#E74C3C" },
  { label: "文化路径", color: "#9B59B6" },
  { label: "法律路径", color: "#34A1DB" },
];

/** 网络图画布节点（赛格事件） */
export interface NetNode {
  id: string;
  label: string;
  color: string;
  kind: "subject" | "interest";
  // 归一化坐标 0~1（相对画布）
  x: number;
  y: number;
}

export const NETWORK_META = {
  title: "赛格事件 - 利益关系网络图",
  subtitle: "15 个节点 · 28 条关系",
  center: {
    name: "赛格集团",
    info: [
      "类型: 主体 (组织节点)",
      "主利益: 物质利益",
      "影响力: 高 (8/10)",
      "连接数: 7 条辐射关系",
    ],
  },
};

export const NETWORK_NODES: NetNode[] = [
  { id: "n0", label: "赛格集团", color: INTEREST.subject, kind: "subject", x: 0.5, y: 0.5 },
  { id: "n1", label: "事件触发", color: "#C0392B", kind: "interest", x: 0.5, y: 0.12 },
  { id: "n2", label: "公告", color: INTEREST.material, kind: "interest", x: 0.18, y: 0.28 },
  { id: "n3", label: "文化界", color: INTEREST.identity, kind: "interest", x: 0.82, y: 0.28 },
  { id: "n4", label: "供应链", color: INTEREST.material, kind: "interest", x: 0.16, y: 0.62 },
  { id: "n5", label: "员工", color: INTEREST.safety, kind: "interest", x: 0.34, y: 0.84 },
  { id: "n6", label: "政府", color: INTEREST.political, kind: "interest", x: 0.66, y: 0.84 },
  { id: "n7", label: "监管层", color: INTEREST.political, kind: "interest", x: 0.84, y: 0.62 },
  { id: "n8", label: "公众", color: INTEREST.public, kind: "interest", x: 0.5, y: 0.9 },
  { id: "n9", label: "经济利益", color: INTEREST.material, kind: "interest", x: 0.28, y: 0.42 },
  { id: "n10", label: "安全诉求", color: INTEREST.safety, kind: "interest", x: 0.72, y: 0.42 },
];

/** 影响评估 — 四维矩阵 */
export interface MatrixRow {
  name: string;
  scores: [number, number, number, number]; // 生存 / 繁衍 / 逆反 / 利益
}

export const MATRIX = {
  headers: ["利益相关方", "生存", "繁衍", "逆反", "利益"],
  rows: [
    { name: "赛格集团", scores: [3, 4, -2, -3] },
    { name: "供应链合作方", scores: [5, 2, 1, 2] },
    { name: "政府监管机构", scores: [2, 1, 0, 5] },
    { name: "员工群体", scores: [-4, -3, 2, -1] },
  ] as MatrixRow[],
};

/** 矩阵单元格配色（严格还原画布：绿/琥珀/红 三档） */
export function matrixCellStyle(v: number): { bg: string; fg: string } {
  if (v >= 2) return { bg: "#E8F5E9", fg: "#2E7D32" }; // 正向
  if (v <= -2) return { bg: "#FFEBEE", fg: "#C62828" }; // 负向
  return { bg: "#FFF2E0", fg: "#E65100" }; // 中性 / 临界
}

/** 影响评估 — 四维雷达（与矩阵一致，仅展示 3 个主体序列） */
export const RADAR = {
  title: "四维雷达图",
  desc: "各利益相关方在四维度上的影响评分分布（-5 到 +5）",
  axes: ["生存", "繁衍", "逆反", "利益"],
  series: [
    { name: "赛格集团", color: INTEREST.material, values: [3, 4, -2, -3] },
    { name: "供应链", color: INTEREST.safety, values: [5, 2, 1, 2] },
    { name: "监管层", color: INTEREST.political, values: [2, 1, 0, 5] },
  ],
};

/** 自动生成向导 — 6 步骤 */
export const WIZARD_STEPS = [
  "选择分析类型",
  "设定分析目标",
  "配置数据源",
  "选择分析维度",
  "生成与校验",
  "导出报告",
];

/** 分析类型 5 Tab（T5：事件/政策/组织/舆情/组合）——顺序与 ANALYSIS_TYPE 一一对应。 */
export const ANALYSIS_TABS = [
  "事件分析",
  "政策分析",
  "组织分析",
  "舆情分析",
  "组合分析",
];

/** 5 类型真映射（T5）：Tab 下标 -> analysis_type（与后端 prompt_builder/contract/KERNEL 哨兵一一对应）。 */
export const ANALYSIS_TYPE = ["case", "policy", "org", "opinion", "combo"] as const;
export type AnalysisType = (typeof ANALYSIS_TYPE)[number];

/** 各类型「预计章节数」（双轨护栏显性化：所选类型 → 预计生成骨架段落数）。 */
export const EXPECTED_CHAPTERS: Record<AnalysisType, number> = {
  case: 8,
  policy: 8,
  org: 9,
  opinion: 7,
  combo: 0, // 组合按作者源序，不固定
};

/** 各类型中文名（徽标/提示用）。 */
export const ANALYSIS_TYPE_LABEL: Record<AnalysisType, string> = {
  case: "事件",
  policy: "政策",
  org: "组织",
  opinion: "舆情",
  combo: "组合",
};

/** 分析进度链 — 6 步完整分析流程 */
export interface AnalysisPhase {
  key: string;
  label: string;
  desc: string;
  pct: number; // 该阶段完成时的进度百分比
}

export const ANALYSIS_PHASES: AnalysisPhase[] = [
  { key: "inspect", label: "检查分析目标", desc: "解析关键词、链接、描述", pct: 10 },
  { key: "search", label: "全网搜索相关信息", desc: "在线可检索时执行搜索", pct: 20 },
  { key: "decompose", label: "对目标进行拆解分析", desc: "拆解核心要素与结构", pct: 40 },
  { key: "network", label: "利益关系网络拆解", desc: "生成利益关系网络图", pct: 60 },
  { key: "organize", label: "整理分析结果", desc: "汇总校验报告结构", pct: 80 },
  { key: "output", label: "输出分析结果", desc: "导出报告并推送", pct: 100 },
];

/** 把后端下发的错误阶段（error_phase）映射为「第 X 步（名称）」展示信息。
 *
 * 用于进度链失败时的精确定位提示（阶段七）。error_phase 与 ANALYSIS_PHASES.key 一致；
 * 未知/空值返回 { stepNo: null, label: null }，由调用方回退为笼统的「分析失败」。
 */
export function describeErrorPhase(
  errorPhase: string | null | undefined,
): { stepNo: number | null; label: string | null } {
  const step = errorPhase
    ? ANALYSIS_PHASES.find((p) => p.key === errorPhase)
    : undefined;
  return step
    ? { stepNo: ANALYSIS_PHASES.indexOf(step) + 1, label: step.label }
    : { stepNo: null, label: null };
}
