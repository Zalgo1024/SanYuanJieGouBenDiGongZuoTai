import { apiRequest } from "./api";
import type { AnalysisTask, AppState, MaterialRecord, NewAnalysisInput, Project, Report, ReportQualityResult, TaskErrorPhase, TaskPhase, TaskStatus } from "./domain";
import { fetchReportVersion, fetchReportVersions } from "./report-delivery";

export type WorkspaceRequest = (path: string, options?: RequestInit) => Promise<unknown>;

export async function createAnalysisTask(
  input: NewAnalysisInput,
  request: WorkspaceRequest = apiRequest,
): Promise<{ task_id: string }> {
  return await request("/api/analyze", {
    method: "POST",
    body: JSON.stringify({
      title: input.title,
      input_text: input.context,
      analysis_type: input.type,
      input_mode: input.inputMode,
      requested_engine: input.engine,
      project_id: input.projectId ?? null,
      material_ids: input.materialIds,
      web: Boolean(input.web),
      render_only: Boolean(input.renderOnly),
    }),
  }) as { task_id: string };
}

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
  // 新后端直接携带进度字段（消除逐任务 poll 的 N+1）；旧后端/测试可能缺失
  phase?: string | null;
  progress_pct?: number | null;
  engine_used?: string | null;
  material_ids?: string[] | null;
  error?: string | null;
  error_phase?: string | null;
  quality?: ReportQualityResult | null;
}

interface TaskPollDto {
  status?: string;
  phase?: string;
  progress_pct?: number;
  material_ids?: string[];
  engine_used?: string | null;
  error?: string | null;
  error_phase?: string | null;
  quality?: ReportQualityResult | null;
  // 轮询端点 /poll 在 error 时把详情放在 data.message
  data?: { message?: string; type?: string; phase?: string } | null;
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

function normalizeErrorPhase(value: string | null | undefined): TaskErrorPhase | undefined {
  if (value === "input_validation" || value === "quality_gate" || value === "evidence") return value;
  return value && phases.includes(value as TaskPhase) ? value as TaskPhase : undefined;
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
    engine: poll.engine_used === "llm" ? "llm" : poll.engine_used === "render" ? "render" : "rule",
    materialIds: poll.material_ids ?? [],
    status,
    phase: normalizeTaskPhase(poll.phase, status),
    progress: status === "done" ? 100 : Math.max(0, Math.min(100, poll.progress_pct ?? 0)),
    error: poll.error ?? poll.data?.message ?? item.error ?? undefined,
    errorPhase: normalizeErrorPhase(poll.error_phase ?? item.error_phase),
    quality: poll.quality ?? item.quality ?? undefined,
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
  const index = await fetchReportVersions(task.id, request);
  if (!index.currentVersionId) return null;
  const current = await fetchReportVersion(task.id, index.currentVersionId, request);
  if (!current.markdown) return null;
  return {
    id: task.id,
    taskId: task.id,
    type: task.type,
    title: index.title || task.title,
    markdown: current.markdown,
    version: current.version,
    currentVersionId: index.currentVersionId,
    updatedAt: current.createdAt || task.updatedAt,
    nodes: [],
    versions: index.versions,
  };
}

async function taskProgress(item: TaskDto, request: WorkspaceRequest): Promise<TaskPollDto> {
  // 优先用 DTO 内联字段；仅当缺失（旧后端/兼容场景）时才逐任务 poll
  if (item.phase != null || item.status === "done") {
    return {
      status: item.status,
      phase: item.phase ?? undefined,
      progress_pct: item.progress_pct ?? 0,
      engine_used: item.engine_used ?? undefined,
      material_ids: item.material_ids ?? [],
      error: item.error ?? undefined,
      error_phase: item.error_phase ?? undefined,
      quality: item.quality ?? undefined,
    };
  }
  return await request(`/api/analyze/${item.task_id}/poll`) as TaskPollDto;
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
    const poll = await taskProgress(item, request);
    return mapTask(item, poll);
  }));
  const reportResults = await Promise.allSettled(
    tasks.filter((task) => task.status === "done").map((task) => fetchCurrentReport(task, request)),
  );
  const reportValues = reportResults
    .filter((result): result is PromiseFulfilledResult<Report | null> => result.status === "fulfilled")
    .map((result) => result.value);
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
  const poll = await taskProgress(item, request);
  return mapTask(item, poll);
}
