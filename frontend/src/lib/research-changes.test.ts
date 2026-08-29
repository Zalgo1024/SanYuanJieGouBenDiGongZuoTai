import { describe, expect, it, vi } from "vitest";
import { fetchReportChanges } from "./research-changes";

describe("fetchReportChanges", () => {
  it("maps version change payload without inventing missing changes", async () => {
    const request = vi.fn(async () => ({
      task_id: "task-1",
      from_version_id: "v1",
      to_version_id: "v2",
      changes: {
        status: "ready",
        has_changes: true,
        summary: ["发现 1 个新主体"],
        added_nodes: [{ id: "n2", label: "新主体" }],
        removed_nodes: [],
        stance_changes: [{ node_id: "n1", label: "主体A", before: "观望", after: "反对" }],
        added_relations: [], removed_relations: [], changed_relations: [],
        added_claims: [], removed_claims: [], changed_claims: [], added_sources: [], new_gaps: [], resolved_gaps: [], risk_change: null,
      },
    }));

    await expect(fetchReportChanges("task-1", "v1", "v2", request)).resolves.toMatchObject({
      taskId: "task-1",
      fromVersionId: "v1",
      toVersionId: "v2",
      changes: { addedNodes: [{ id: "n2", label: "新主体" }], stanceChanges: [{ nodeId: "n1", after: "反对" }] },
    });
    expect(request).toHaveBeenCalledWith("/api/reports/task-1/changes?from_version_id=v1&to_version_id=v2");
  });
});
