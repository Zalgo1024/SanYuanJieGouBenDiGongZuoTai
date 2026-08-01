import { apiRequest } from "./api";
import type { AnalysisTask, AppState, MaterialRecord, Project, Report, TaskPhase, TaskStatus } from "./domain";

export type WorkspaceRequest = (path: string, options?: RequestInit) => Promise<unknown>;

interface ProjectDto {
  id: string;
  name: string;
  description: string | null;
  status: string;
  progress: string | number;
  is_archived: boolean;
  updated_at: string | null;
}

interface MaterialDto {
  id: string;
  title: string;
  source_type: string;
  source: string | null;
  tags: string | null;
  warnings?: string[];
  created_at: string | null;
}

interface TaskDto {
  task_id: string;
  title: string;
  status: string;
  analysis_type: string;
  project_id: string | null;
  created_at: string | null;
}

interface TaskPollDto {
  status?: string;
  phase?: string;
  progress_pct?: number;
  material_ids?: string[];
  engine_used?: string | null;
}

interface ReportVersionMetaDto {
  id: string;
  version_no: number;
  created_at: string | null;
  is_current: boolean;
}

interface ReportVersionsDto {
  task_id: string;
  title: string;
  current_version_id: string | null;
  versions: ReportVersionMetaDto[];
}

interface ReportVersionDto {
  id: string;
  version_no: number;
  created_at: string | null;
  content_markdown: string;
}

const phases: TaskPhase[] = ["inspect", "search", "decompose", "network", "organize", "output"];
const statuses: TaskStatus[] = ["queued", "generating", "done", "error"];
const phaseAliases: Record<string, TaskPhase> = {
  fetch: "search",
  search_skipped: "search",
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export function normalizeTaskPhase(value: string | undefined, status: TaskStatus): TaskPhase {
  if (value && phases.includes(value as TaskPhase)) return value as TaskPhase;
  if (value && phaseAliases[value]) return phaseAliases[value];
  return status === "done" ? "output" : "inspect";
}

export function normalizeTaskStatus(value: string | undefined): TaskStatus {
  return value && statuses.includes(value as TaskStatus) ? value as TaskStatus : "queued";
}

function mapMaterial(item: MaterialDto): MaterialRecord {
  const kind: MaterialRecord["kind"] = item.source_type === "link"
    ? "link"
    : item.source_type === "note" || item.source_type === "paste"
      ? "note"
      : "file";
  const warnings = item.warnings ?? [];
  return {
    id: item.id,
    name: item.title,
    kind,
    note: warnings.length ? `解析告警：${warnings.join("、")}` : item.source ?? item.tags ?? "",
    updatedAt: item.created_at ?? new Date(0).toISOString(),
    status: warnings.length ? "error" : "ready",
  };
}

async function fetchAllTaskDtos(request: WorkspaceRequest): Promise<TaskDto[]> {
  const groups = await Promise.all(statuses.map((status) => request(`/api/tasks?status=${status}&limit=200`)));
  const byId = new Map<string, TaskDto>();
  for (const item of groups.flatMap((value) => asArray<TaskDto>(value))) byId.set(item.task_id, item);
  return [...byId.values()].sort((left, right) => Date.parse(right.created_at ?? "") - Date.parse(left.created_at ?? ""));
}

function mapTask(item: TaskDto, poll: TaskPollDto): AnalysisTask {
  const status = normalizeTaskStatus(poll.status ?? item.status);
  return {
    id: item.task_id,
    projectId: item.project_id ?? "",
    type: (item.analysis_type || "case") as AnalysisTask["type"],
    title: item.title,
    context: "",
    engine: poll.engine_used === "llm" ? "llm" : "rule",
    materialIds: poll.material_ids ?? [],
    status,
    phase: normalizeTaskPhase(poll.phase, status),
    progress: status === "done" ? 100 : Math.max(0, Math.min(100, poll.progress_pct ?? 0)),
    createdAt: item.created_at ?? new Date(0).toISOString(),
    updatedAt: item.created_at ?? new Date(0).toISOString(),
  };
}

function mapProject(item: ProjectDto, tasks: AnalysisTask[]): Project {
  const task = tasks.find((candidate) => candidate.projectId === item.id);
  const normalizedStatus: Project["status"] = item.is_archived
    ? "archived"
    : item.status.includes("复核") || item.status.toLowerCase() === "review"
      ? "review"
      : "active";
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? "",
    type: task?.type ?? "case",
    status: normalizedStatus,
    progress: Number(item.progress) || 0,
    updatedAt: item.updated_at ?? new Date(0).toISOString(),
  };
}

export async function fetchCurrentReport(
  task: AnalysisTask,
  request: WorkspaceRequest = apiRequest,
): Promise<Report | null> {
  const index = await request(`/api/reports/${task.id}`) as ReportVersionsDto;
  if (!index.current_version_id) return null;
  const current = await request(`/api/reports/${task.id}/versions/${index.current_version_id}`) as ReportVersionDto;
  if (!current.content_markdown) return null;
  return {
    id: task.id,
    taskId: task.id,
    type: task.type,
    title: index.title || task.title,
    markdown: current.content_markdown,
    version: current.version_no || 1,
    updatedAt: current.created_at ?? task.updatedAt,
    nodes: [],
    revisions: [],
  };
}

export async function fetchWorkspaceSnapshot(
  request: WorkspaceRequest = apiRequest,
): Promise<Pick<AppState, "projects" | "tasks" | "reports" | "materials">> {
  const [projectValue, materialValue, taskValue] = await Promise.all([
    request("/api/projects?include_archived=true"),
    request("/api/materials"),
    fetchAllTaskDtos(request),
  ]);
  const taskDtos = asArray<TaskDto>(taskValue);
  const tasks = await Promise.all(taskDtos.map(async (item) => {
    const poll = await request(`/api/analyze/${item.task_id}/poll`) as TaskPollDto;
    return mapTask(item, poll);
  }));
  const reportValues = await Promise.all(tasks.filter((task) => task.status === "done").map((task) => fetchCurrentReport(task, request)));
  return {
    projects: asArray<ProjectDto>(projectValue).map((item) => mapProject(item, tasks)),
    tasks,
    reports: reportValues.filter((report): report is Report => report !== null),
    materials: asArray<MaterialDto>(materialValue).map(mapMaterial),
  };
}

export async function fetchTaskById(
  taskId: string,
  request: WorkspaceRequest = apiRequest,
): Promise<AnalysisTask | null> {
  const tasks = await fetchAllTaskDtos(request);
  const item = tasks.find((candidate) => candidate.task_id === taskId);
  if (!item) return null;
  const poll = await request(`/api/analyze/${taskId}/poll`) as TaskPollDto;
  return mapTask(item, poll);
}
