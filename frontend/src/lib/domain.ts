export type AnalysisType = "case" | "policy" | "org" | "opinion" | "combo";
export type EngineMode = "rule" | "llm";
export type TaskStatus = "queued" | "generating" | "done" | "error";
export type TaskPhase = "inspect" | "search" | "decompose" | "network" | "organize" | "output";
export type ProjectStatus = "active" | "review" | "archived";
export type MaterialKind = "file" | "link" | "note";
export type MaterialStatus = "pending" | "ready" | "error";
export type ThemeMode = "light" | "dark";
export type ExportFormat = "markdown" | "html";

export interface NewAnalysisInput {
  type: AnalysisType;
  title: string;
  context: string;
  engine: EngineMode;
  materialIds: string[];
  projectId?: string;
  /** 是否开启联网检索撰写（映射到后端 /api/analyze 的 web 字段） */
  web?: boolean;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  type: AnalysisType;
  status: TaskStatus;
  progress: number;
  updatedAt: string;
  taskCount: number;
  reportCount: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  type: AnalysisType;
  status: ProjectStatus;
  progress: number;
  updatedAt: string;
}

export interface AnalysisTask {
  id: string;
  projectId: string;
  type: AnalysisType;
  title: string;
  context: string;
  engine: EngineMode;
  materialIds: string[];
  status: TaskStatus;
  phase: TaskPhase;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export interface InterestNode {
  id: string;
  label: string;
  role: string;
  interest: string;
  confidence: number;
  x: number;
  y: number;
}

export interface Report {
  id: string;
  taskId: string;
  type: AnalysisType;
  title: string;
  markdown: string;
  version: number;
  currentVersionId: string;
  updatedAt: string;
  nodes: InterestNode[];
  versions: ReportVersionSummary[];
}

export interface ReportVersionSummary {
  id: string;
  version: number;
  kind: "original" | "revised" | string;
  editedBy: "ai" | "human" | string;
  summary: string;
  note: string;
  editor: string;
  createdAt: string;
  isCurrent: boolean;
}

export interface MaterialRecord {
  id: string;
  name: string;
  kind: MaterialKind;
  note: string;
  updatedAt: string;
  status: MaterialStatus;
}

export interface WorkspaceSettings {
  defaultEngine: EngineMode;
  theme: ThemeMode;
  defaultExport: ExportFormat;
}

export interface AppState {
  version: 2;
  projects: Project[];
  tasks: AnalysisTask[];
  reports: Report[];
  materials: MaterialRecord[];
  settings: WorkspaceSettings;
}

export const defaultSettings: WorkspaceSettings = {
  defaultEngine: "rule",
  theme: "light",
  defaultExport: "markdown",
};

export const analysisTypes: Array<{ id: AnalysisType; label: string; description: string }> = [
  { id: "case", label: "事件分析", description: "拆解事件中的主体、利益与关系变化" },
  { id: "policy", label: "政策分析", description: "理解政策目标、约束与执行结构" },
  { id: "opinion", label: "舆情分析", description: "辨识叙事、信任与传播的作用方式" },
  { id: "org", label: "组织分析", description: "审视组织角色、资源与协同边界" },
  { id: "combo", label: "组合分析", description: "事件/政策/组织/舆情交叉的复合结构" }
];

export const phaseLabels: Array<{ id: TaskPhase; label: string; note: string }> = [
  { id: "inspect", label: "检查分析目标", note: "识别输入边界与对象" },
  { id: "search", label: "补充外部线索", note: "可选的来源检索与核对" },
  { id: "decompose", label: "拆解分析结构", note: "建立主体、利益与约束" },
  { id: "network", label: "构建关系网络", note: "识别关系强度和冲突点" },
  { id: "organize", label: "整理诊断结果", note: "归纳可审阅的判断链" },
  { id: "output", label: "生成分析输出", note: "形成报告、图谱和引用" }
];
