import { describe, expect, it, vi } from "vitest";
import type { AnalysisTask } from "./domain";
import { fetchCurrentReport, fetchWorkspaceSnapshot } from "./workspace-api";

const task: AnalysisTask = {
  id: "task-1",
  projectId: "project-1",
  type: "org",
  title: "真实组织分析",
  context: "",
  engine: "llm",
  materialIds: ["material-1"],
  status: "done",
  phase: "output",
  progress: 100,
  createdAt: "2026-08-01T10:00:00",
  updatedAt: "2026-08-01T10:05:00",
};

describe("fetchCurrentReport", () => {
  it("uses the backend current version as the report content", async () => {
    const request = vi.fn(async (path: string) => {
      if (path === "/api/reports/task-1") {
        return {
          task_id: "task-1",
          title: "后端报告标题",
          current_version_id: "version-2",
          versions: [
            { id: "version-1", version_no: 1, created_at: "2026-08-01T10:05:00", is_current: false },
            { id: "version-2", version_no: 2, created_at: "2026-08-01T11:00:00", is_current: true },
          ],
        };
      }
      if (path === "/api/reports/task-1/versions/version-2") {
        return {
          id: "version-2",
          version_no: 2,
          created_at: "2026-08-01T11:00:00",
          content_markdown: "# 后端当前版本\n\n## 结论\n\n真实内容",
        };
      }
      throw new Error(`unexpected path: ${path}`);
    });

    const report = await fetchCurrentReport(task, request);

    expect(report).toMatchObject({
      id: "task-1",
      taskId: "task-1",
      title: "后端报告标题",
      markdown: "# 后端当前版本\n\n## 结论\n\n真实内容",
      version: 2,
      currentVersionId: "version-2",
      versions: [
        { id: "version-1", version: 1, isCurrent: false },
        { id: "version-2", version: 2, isCurrent: true },
      ],
      updatedAt: "2026-08-01T11:00:00",
    });
    expect(request).toHaveBeenCalledWith("/api/reports/task-1/versions/version-2");
  });

  it("does not manufacture a report when the backend has no current version", async () => {
    const request = vi.fn(async () => ({
      task_id: "task-1",
      title: "尚未生成",
      current_version_id: null,
      versions: [],
    }));

    await expect(fetchCurrentReport(task, request)).resolves.toBeNull();
    expect(request).toHaveBeenCalledTimes(1);
  });
});

describe("fetchWorkspaceSnapshot", () => {
  it("maps backend ids, task progress and materials without local placeholders", async () => {
    const request = vi.fn(async (path: string) => {
      if (path === "/api/projects?include_archived=true") return [{ id: "project-1", name: "真实项目", description: "后端项目", status: "进行中", progress: "64", is_archived: false, updated_at: "2026-08-01T10:04:00" }];
      if (path === "/api/materials") return [{ id: "material-1", title: "真实材料.pdf", source_type: "pdf", source: "监管公告", tags: null, warnings: ["pdf_garbled"], created_at: "2026-08-01T10:01:00" }];
      if (path === "/api/tasks?status=generating&limit=200") return [{ task_id: "task-1", title: "真实组织分析", status: "generating", analysis_type: "org", project_id: "project-1", created_at: "2026-08-01T10:00:00" }];
      if (path.startsWith("/api/tasks?status=")) return [];
      if (path === "/api/analyze/task-1/poll") return { status: "generating", phase: "network", progress_pct: 64, material_ids: ["material-1"], engine_used: "llm" };
      throw new Error(`unexpected path: ${path}`);
    });

    const snapshot = await fetchWorkspaceSnapshot(request);

    expect(snapshot.projects[0]).toMatchObject({ id: "project-1", name: "真实项目", type: "org", progress: 64 });
    expect(snapshot.tasks[0]).toMatchObject({ id: "task-1", phase: "network", progress: 64, engine: "llm", materialIds: ["material-1"] });
    expect(snapshot.materials[0]).toMatchObject({ id: "material-1", name: "真实材料.pdf", kind: "file", status: "error" });
    expect(snapshot.materials[0].note).toContain("pdf_garbled");
    expect(snapshot.reports).toEqual([]);
  });

  it("keeps the workspace usable when one completed report cannot be read", async () => {
    const request = vi.fn(async (path: string) => {
      if (path === "/api/projects?include_archived=true" || path === "/api/materials") return [];
      if (path === "/api/tasks?status=done&limit=200") return [{ task_id: "task-1", title: "已完成", status: "done", analysis_type: "case", project_id: null, created_at: "2026-08-01T10:00:00" }];
      if (path.startsWith("/api/tasks?status=")) return [];
      if (path === "/api/analyze/task-1/poll") return { status: "done", phase: "output", progress_pct: 100 };
      if (path === "/api/reports/task-1") throw new Error("报告接口失败");
      throw new Error(`unexpected path: ${path}`);
    });

    await expect(fetchWorkspaceSnapshot(request)).resolves.toMatchObject({
      tasks: [expect.objectContaining({ id: "task-1", status: "done" })],
      reports: [],
    });
  });
});
