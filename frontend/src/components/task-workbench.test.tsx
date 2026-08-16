import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { TaskWorkbench } from "./task-workbench";
import type { AnalysisTask } from "@/lib/domain";

const task: AnalysisTask = {
  id: "task-1",
  projectId: "project-1",
  type: "case",
  title: "后端真实任务",
  context: "",
  engine: "rule",
  materialIds: [],
  status: "generating",
  phase: "network",
  progress: 64,
  createdAt: "2026-08-01T10:00:00",
  updatedAt: "2026-08-01T10:02:00",
};
let activeTask = task;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/realtime", () => ({ useTaskProgress: vi.fn() }));

vi.mock("@/lib/store", () => ({
  useAppStore: () => ({
    state: { tasks: [activeTask], reports: [], projects: [], materials: [], settings: { defaultEngine: "rule" } },
    hydrated: true,
    connection: "online",
    loadTask: vi.fn(),
    loadReport: vi.fn(),
  }),
}));

describe("TaskWorkbench backend truth", () => {
  it("shows backend progress without canned diagnosis or evidence claims", () => {
    render(<TaskWorkbench taskId="task-1" />);

    expect(screen.getByText("后端任务状态")).toBeInTheDocument();
    expect(screen.getByText("64%")).toBeInTheDocument();
    expect(screen.queryByText("制度信任是协商成败的关键杠杆")).not.toBeInTheDocument();
    expect(screen.queryByText(/证据完整度/)).not.toBeInTheDocument();
  });

  it("shows the backend error and failing phase instead of a generic dead end", () => {
    activeTask = {
      ...task,
      status: "error",
      phase: "output",
      errorPhase: "output",
      error: "Word 导出包含不可用控制字符",
    };
    render(<TaskWorkbench taskId="task-1" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Word 导出包含不可用控制字符");
    expect(screen.getByText(/后端在生成分析输出失败/)).toBeInTheDocument();
    activeTask = task;
  });

  it("shows quality-gate issues as actionable report feedback", () => {
    activeTask = {
      ...task,
      status: "error",
      phase: "output",
      errorPhase: "quality_gate",
      error: "报告未通过质量闸门",
      quality: {
        valid: false,
        score: 60,
        issues: [{
          code: "source_links",
          severity: "error",
          message: "使用联网来源时，附录必须包含 Markdown 来源链接。",
          section: "附录",
        }],
      },
    };

    render(<TaskWorkbench taskId="task-1" />);

    expect(screen.getByText("报告质量校验")).toBeInTheDocument();
    expect(screen.getByText("质量分 60")).toBeInTheDocument();
    expect(screen.getByText(/附录必须包含 Markdown 来源链接/)).toBeInTheDocument();
    activeTask = task;
  });
});
