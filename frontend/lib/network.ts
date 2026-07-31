// 真实报告利益关系图解析 —— 阶段三「织网」核心。
// 每份生成的报告正文里都内嵌一个或多个 ```DIAGRAM ... ``` 的合法 JSON 利益关系图，
// 这里负责把它们从 Markdown 中全部提取出来（T6：/g 全量），并给出「类型 -> 颜色/标签」映射，
// 供网络图 / 多主体工作台 / 影响评估三页统一消费真实数据。
import { INTEREST } from "@/lib/constants";

export interface DiagramNode {
  id: string;
  label: string;
  type: string; // actor | material | security | political | identity_culture | institutional_future | public | event
}

export interface DiagramEdge {
  source: string;
  target: string;
  label?: string;
  type?: string; // power | economic | cultural | legal
  style?: string; // 可选 "dashed"
}

export interface Diagram {
  viz: string; // "network" | "org" | "flow"
  title: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

const DIAGRAM_BLOCK_RE = /```DIAGRAM\s*\n([\s\S]*?)\n```/g;

function _tryParse(raw: string): Diagram | null {
  try {
    const obj = JSON.parse(raw);
    if (obj && Array.isArray(obj.nodes) && Array.isArray(obj.edges)) {
      return obj as Diagram;
    }
  } catch {
    // 解析失败（LLM 偶发输出非法 JSON）→ 当作无图
  }
  return null;
}

/** 从报告 Markdown 中提取**全部** DIAGRAM JSON（T6：多图全量）。坏块跳过。 */
export function parseDiagrams(md?: string | null): Diagram[] {
  if (!md) return [];
  const out: Diagram[] = [];
  DIAGRAM_BLOCK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = DIAGRAM_BLOCK_RE.exec(md)) !== null) {
    const d = _tryParse(m[1].trim());
    if (d) out.push(d);
  }
  return out;
}

/** 从报告 Markdown 中提取第一张 DIAGRAM JSON（单数兼容，找不到返回 null）。 */
export function parseDiagram(md?: string | null): Diagram | null {
  return parseDiagrams(md)[0] ?? null;
}

/** 节点类型 -> 配色（T6：与 KERNEL theory_config.json.visualization.node_types 8 类一致）。
 * 删掉错误 key safety/identity；补 identity_culture/event。 */
export const INTEREST_TYPE_COLOR: Record<string, string> = {
  actor: "#34495E",
  material: "#E74C3C",
  security: "#F39C12",
  political: "#2E86C1",
  identity_culture: "#8E44AD",
  institutional_future: "#1ABC9C",
  public: "#27AE60",
  event: "#E67E22",
};

/** 节点类型 -> 中文标签（信息卡用）。 */
export const INTEREST_TYPE_LABEL: Record<string, string> = {
  actor: "主体（组织节点）",
  material: "物质利益",
  security: "安全利益",
  political: "政治利益",
  identity_culture: "身份文化利益",
  institutional_future: "制度性未来利益",
  public: "公共利益",
  event: "事件触发",
};

/** 边类型 -> 路径配色（与画布 PATH_LEGEND 一致）。 */
export const EDGE_TYPE_COLOR: Record<string, string> = {
  power: "#E74C3C", // 权力路径
  economic: "#2ECC71", // 经济路径
  cultural: "#9B59B6", // 文化路径
  legal: "#34A1DB", // 法律路径
};

export function nodeColor(type: string): string {
  return INTEREST_TYPE_COLOR[type] ?? "#9CA3AF";
}

export function edgeColor(type?: string): string {
  return EDGE_TYPE_COLOR[type ?? ""] ?? "#D7DCE3";
}

export function nodeTypeLabel(type: string): string {
  return INTEREST_TYPE_LABEL[type] ?? type;
}

/**
 * 六类利益维度（影响评估矩阵 / 雷达用，顺序固定）。
 * key 对应 DIAGRAM 节点 type；label 为中文；color 取六类利益配色。
 */
export const INTEREST_DIMENSIONS: {
  key: string;
  label: string;
  color: string;
}[] = [
  { key: "material", label: "物质利益", color: INTEREST.material },
  { key: "safety", label: "安全利益", color: INTEREST.safety },
  { key: "political", label: "政治利益", color: INTEREST.political },
  { key: "identity", label: "身份文化利益", color: INTEREST.identity },
  { key: "institutional_future", label: "制度性未来利益", color: INTEREST.future },
  { key: "public", label: "公共利益", color: INTEREST.public },
];
