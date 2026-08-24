import { apiRequest } from "./api";

export type BenchmarkCandidateName = "system" | "general" | "human";
export interface BenchmarkCandidateResult {
  status: "ready" | "missing";
  actorCount: number | null;
  evidenceBackedRelationCount: number | null;
  factErrorCount: number | null;
  investigationDirectionCount: number | null;
  durationSeconds: number | null;
}
export interface BenchmarkRun {
  id: string;
  taskId: string;
  versionId?: string;
  preference: BenchmarkCandidateName | "tie" | "unset";
  notes: string;
  createdAt?: string;
  candidates: Record<BenchmarkCandidateName, BenchmarkCandidateResult>;
  methodology: string[];
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function numberOrNull(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function candidate(value: unknown): BenchmarkCandidateResult {
  const item = record(value);
  return {
    status: item.status === "ready" ? "ready" : "missing",
    actorCount: numberOrNull(item.actor_count), evidenceBackedRelationCount: numberOrNull(item.evidence_backed_relation_count),
    factErrorCount: numberOrNull(item.fact_error_count), investigationDirectionCount: numberOrNull(item.investigation_direction_count),
    durationSeconds: numberOrNull(item.duration_seconds),
  };
}
function normalizeRun(value: unknown): BenchmarkRun {
  const root = record(value);
  const result = record(root.result);
  const candidates = record(result.candidates);
  return {
    id: String(root.id ?? ""), taskId: String(root.task_id ?? ""), versionId: typeof root.version_id === "string" ? root.version_id : undefined,
    preference: result.preference === "system" || result.preference === "general" || result.preference === "human" || result.preference === "tie" ? result.preference : "unset",
    notes: String(root.notes ?? ""), createdAt: typeof root.created_at === "string" ? root.created_at : undefined,
    candidates: { system: candidate(candidates.system), general: candidate(candidates.general), human: candidate(candidates.human) },
    methodology: Array.isArray(result.methodology) ? result.methodology.filter((item): item is string => typeof item === "string") : [],
  };
}

export async function fetchBenchmarks(taskId: string): Promise<BenchmarkRun[]> {
  const value = record(await apiRequest(`/api/reports/${taskId}/benchmarks`));
  return (Array.isArray(value.items) ? value.items : []).map(normalizeRun).filter((item) => item.id);
}

export async function createBenchmark(taskId: string, payload: Record<string, unknown>): Promise<BenchmarkRun> {
  return normalizeRun(await apiRequest(`/api/reports/${taskId}/benchmarks`, { method: "POST", body: JSON.stringify(payload) }));
}

export async function generateGeneralBaseline(taskId: string, versionId?: string): Promise<{ snapshot: Record<string, unknown>; durationSeconds: number; model: string }> {
  const value = record(await apiRequest(`/api/reports/${taskId}/benchmarks/general-baseline`, { method: "POST", body: JSON.stringify({ version_id: versionId }) }));
  return {
    snapshot: record(value.snapshot), durationSeconds: numberOrNull(value.duration_seconds) ?? 0, model: String(value.model ?? "未命名模型"),
  };
}
