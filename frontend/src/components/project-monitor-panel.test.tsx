import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchProjectMonitor, runProjectMonitor, updateProjectMonitor } from "@/lib/workspace-api";
import { ProjectMonitorPanel } from "./project-monitor-panel";

vi.mock("@/lib/workspace-api", () => ({ fetchProjectMonitor: vi.fn(), runProjectMonitor: vi.fn(), updateProjectMonitor: vi.fn() }));

describe("ProjectMonitorPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchProjectMonitor).mockResolvedValue({ projectId: "p1", configured: true, enabled: false, intervalHours: 24, latestChange: { status: "ready", hasChanges: true, summary: ["出现新主体：机构B"], addedNodes: [], removedNodes: [], stanceChanges: [], addedRelations: [], removedRelations: [], changedRelations: [], addedClaims: [], removedClaims: [], changedClaims: [], addedSources: [], newGaps: [], resolvedGaps: [] } });
    vi.mocked(updateProjectMonitor).mockResolvedValue({ projectId: "p1", configured: true, enabled: true, intervalHours: 12 });
    vi.mocked(runProjectMonitor).mockResolvedValue({ taskId: "task-new" });
  });

  it("configures and manually runs local project tracking", async () => {
    render(<ProjectMonitorPanel projectId="p1" seedTaskId="task-1" />);
    expect(await screen.findByRole("heading", { name: "持续追踪与复盘" })).toBeInTheDocument();
    expect(screen.getByText("出现新主体：机构B")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "启用持续追踪" }));
    fireEvent.change(screen.getByRole("combobox", { name: "检查频率" }), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "保存追踪设置" }));
    await waitFor(() => expect(updateProjectMonitor).toHaveBeenCalledWith("p1", { enabled: true, intervalHours: 12, seedTaskId: "task-1" }));
    fireEvent.click(screen.getByRole("button", { name: "立即检查新信息" }));
    await waitFor(() => expect(runProjectMonitor).toHaveBeenCalledWith("p1"));
    expect(await screen.findByText("已创建复盘任务 task-new")).toBeInTheDocument();
  });
});
