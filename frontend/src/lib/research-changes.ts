import { apiRequest } from "./api";
import type { ResearchChangeSet } from "./domain";
import type { ReportRequest } from "./report-delivery";

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function records(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.map(record).filter((item) => Object.keys(item).length > 0) : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function normalizeResearchChanges(value: unknown): ResearchChangeSet {
  const root = record(value);
  return {
    status: root.status === "ready" ? "ready" : "unavailable",
    hasChanges: Boolean(root.has_changes),
    summary: strings(root.summary),
    addedNodes: records(root.added_nodes), removedNodes: records(root.removed_nodes),
    stanceChanges: records(root.stance_changes).map((item) => ({ nodeId: String(item.node_id ?? ""), label: String(item.label ?? ""), before: String(item.before ?? ""), after: String(item.after ?? "") })),
    addedRelations: records(root.added_relations), removedRelations: records(root.removed_relations), changedRelations: records(root.changed_relations),
    addedClaims: records(root.added_claims), removedClaims: records(root.removed_claims), changedClaims: records(root.changed_claims),
    addedSources: records(root.added_sources), newGaps: records(root.new_gaps), resolvedGaps: records(root.resolved_gaps),
    riskChange: Object.keys(record(root.risk_change)).length ? { before: String(record(root.risk_change).before ?? ""), after: String(record(root.risk_change).after ?? "") } : undefined,
  };
}

export async function fetchReportChanges(taskId: string, fromVersionId: string, toVersionId: string, request: ReportRequest = apiRequest) {
  const query = new URLSearchParams();
  if (fromVersionId) query.set("from_version_id", fromVersionId);
  if (toVersionId) query.set("to_version_id", toVersionId);
  const value = await request(`/api/reports/${taskId}/changes?${query.toString()}`) as Record<string, unknown>;
  return {
    taskId: String(value.task_id ?? taskId), fromVersionId: String(value.from_version_id ?? ""), toVersionId: String(value.to_version_id ?? ""),
    changes: normalizeResearchChanges(value.changes),
  };
}
