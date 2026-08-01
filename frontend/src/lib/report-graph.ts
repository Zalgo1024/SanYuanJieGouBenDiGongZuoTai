import type { MaterialRecord } from "./domain";

export type DiagramViz = "network" | "org" | "flow";

export interface DiagramNode {
  id: string;
  label: string;
  type: string;
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: string;
}

export interface DiagramDocument {
  id: string;
  title: string;
  viz: DiagramViz;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export type GraphWarningCode = "invalid_json" | "invalid_shape" | "empty_nodes" | "dangling_edge" | "unsupported_viz" | "unsupported_edge_type";

export interface GraphParseWarning {
  code: GraphWarningCode;
  diagramIndex: number;
  message: string;
}

export interface GraphParseResult {
  diagrams: DiagramDocument[];
  warnings: GraphParseWarning[];
}

export interface EvidenceItem {
  id: string;
  kind: "citation" | "material";
  label: string;
  detail: string;
  url?: string;
  materialId?: string;
  status?: MaterialRecord["status"];
}

interface RawDiagram {
  title?: unknown;
  viz?: unknown;
  nodes?: unknown;
  edges?: unknown;
}

interface RawNode {
  id?: unknown;
  label?: unknown;
  type?: unknown;
}

interface RawEdge {
  source?: unknown;
  target?: unknown;
  from?: unknown;
  to?: unknown;
  label?: unknown;
  type?: unknown;
}

const diagramPattern = /```DIAGRAM\s*\r?\n([\s\S]*?)\r?\n```/gi;
const supportedViz = new Set<DiagramViz>(["network", "org", "flow"]);
const supportedEdgeTypes = new Set(["economic", "power", "cultural", "legal"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function diagramBlocks(markdown: string): string[] {
  return [...markdown.matchAll(diagramPattern)].map((match) => match[1].trim());
}

function normalizeDiagram(rawText: string, index: number, warnings: GraphParseWarning[]): DiagramDocument | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    warnings.push({ code: "invalid_json", diagramIndex: index, message: `第 ${index + 1} 张图不是合法 JSON，已跳过。` });
    return null;
  }
  if (!isRecord(parsed)) {
    warnings.push({ code: "invalid_shape", diagramIndex: index, message: `第 ${index + 1} 张图不是 JSON 对象，已跳过。` });
    return null;
  }
  const raw = parsed as RawDiagram;

  const rawViz = stringValue(raw.viz, "network");
  const viz = supportedViz.has(rawViz as DiagramViz) ? rawViz as DiagramViz : "network";
  if (rawViz !== viz) warnings.push({ code: "unsupported_viz", diagramIndex: index, message: `第 ${index + 1} 张图的布局“${rawViz}”不受支持，已按关系网络显示。` });

  const nodes: DiagramNode[] = [];
  const nodeIds = new Set<string>();
  for (const item of Array.isArray(raw.nodes) ? raw.nodes as RawNode[] : []) {
    if (!isRecord(item)) continue;
    const id = stringValue(item.id);
    if (!id || nodeIds.has(id)) continue;
    nodeIds.add(id);
    nodes.push({ id, label: stringValue(item.label, id), type: stringValue(item.type, "actor") });
  }
  if (!nodes.length) {
    warnings.push({ code: "empty_nodes", diagramIndex: index, message: `第 ${index + 1} 张图没有有效节点，已跳过。` });
    return null;
  }

  const diagramId = `diagram-${index + 1}`;
  const edges: DiagramEdge[] = [];
  for (const [edgeIndex, item] of (Array.isArray(raw.edges) ? raw.edges as RawEdge[] : []).entries()) {
    if (!isRecord(item)) continue;
    const source = stringValue(item.source ?? item.from);
    const target = stringValue(item.target ?? item.to);
    if (!nodeIds.has(source) || !nodeIds.has(target)) {
      warnings.push({ code: "dangling_edge", diagramIndex: index, message: `第 ${index + 1} 张图有一条关系指向不存在的节点，已跳过。` });
      continue;
    }
    const rawType = stringValue(item.type, "unknown");
    const type = supportedEdgeTypes.has(rawType) ? rawType : "unknown";
    if (type === "unknown") {
      warnings.push({ code: "unsupported_edge_type", diagramIndex: index, message: `第 ${index + 1} 张图有一条关系类型未受支持，已按未分类关系显示。` });
    }
    edges.push({
      id: `${diagramId}-edge-${edgeIndex + 1}`,
      source,
      target,
      label: stringValue(item.label, "关系"),
      type,
    });
  }

  return {
    id: diagramId,
    title: stringValue(raw.title, `关系图 ${index + 1}`),
    viz,
    nodes,
    edges,
  };
}

export function parseReportGraphs(markdown: string): GraphParseResult {
  const warnings: GraphParseWarning[] = [];
  const diagrams = diagramBlocks(markdown)
    .map((raw, index) => normalizeDiagram(raw, index, warnings))
    .filter((diagram): diagram is DiagramDocument => diagram !== null);
  return { diagrams, warnings };
}

export function collectReportEvidence(markdown: string, materials: MaterialRecord[]): EvidenceItem[] {
  const evidence: EvidenceItem[] = [];
  const seenUrls = new Set<string>();
  const linkPattern = /(?<!!)\[([^\]]+)]\((https?:\/\/[^)\s]+)\)/g;
  for (const match of markdown.matchAll(linkPattern)) {
    const [, label, url] = match;
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    evidence.push({ id: `citation-${evidence.length + 1}`, kind: "citation", label: label.trim(), detail: url, url });
  }

  const seenMaterials = new Set<string>();
  for (const material of materials) {
    if (seenMaterials.has(material.id)) continue;
    seenMaterials.add(material.id);
    evidence.push({
      id: `material-${material.id}`,
      kind: "material",
      label: material.name,
      detail: material.note || (material.kind === "file" ? "任务关联文件" : "任务关联材料"),
      materialId: material.id,
      status: material.status,
    });
  }
  return evidence;
}
