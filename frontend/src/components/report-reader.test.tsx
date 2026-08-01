import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisTask, Report } from "@/lib/domain";
import { downloadReportArtifact, fetchReportVersion, rollbackReportVersion } from "@/lib/report-delivery";
import { ReportReader } from "./report-reader";

vi.mock("@/lib/report-delivery", () => ({
  downloadReportArtifact: vi.fn(),
  fetchReportVersion: vi.fn(),
  rollbackReportVersion: vi.fn(),
}));

const report: Report = {
  id: "task-1",
  taskId: "task-1",
  type: "org",
  title: "组织结构评估",
  markdown: "# 组织结构评估\n\n## 一、当前结论\n\n第二版正文",
  version: 2,
  currentVersionId: "version-2",
  updatedAt: "2026-08-02T10:00:00",
  nodes: [],
  versions: [
    { id: "version-1", version: 1, kind: "original", editedBy: "ai", summary: "初始生成", note: "", editor: "", createdAt: "2026-08-01T10:00:00", isCurrent: false },
    { id: "version-2", version: 2, kind: "revised", editedBy: "human", summary: "补充边界", note: "补充边界", editor: "林知远", createdAt: "2026-08-02T10:00:00", isCurrent: true },
  ],
};

const task: AnalysisTask = {
  id: "task-1",
  projectId: "project-1",
  type: "org",
  title: "组织结构评估",
  context: "",
  engine: "llm",
  materialIds: [],
  status: "done",
  phase: "output",
  progress: 100,
  createdAt: "2026-08-01T10:00:00",
  updatedAt: "2026-08-02T10:00:00",
};

describe("ReportReader", () => {
  beforeEach(() => vi.clearAllMocks());

  it("previews a historical version without replacing the current report", async () => {
    vi.mocked(fetchReportVersion).mockResolvedValue({
      ...report.versions[0],
      markdown: "# 组织结构评估\n\n## 一、原始结论\n\n第一版正文",
      html: "",
    });

    render(<ReportReader report={report} task={task} onReload={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "预览 v1" }));

    expect(await screen.findByText("第一版正文")).toBeInTheDocument();
    expect(screen.getByText("正在查看历史版本 v1")).toBeInTheDocument();
    expect(fetchReportVersion).toHaveBeenCalledWith("task-1", "version-1");

    fireEvent.click(screen.getByRole("button", { name: "返回当前版本" }));
    expect(screen.getByText("第二版正文")).toBeInTheDocument();
  });

  it("cancels the historical loading state when returning to the current version", async () => {
    let resolveVersion!: (value: Awaited<ReturnType<typeof fetchReportVersion>>) => void;
    vi.mocked(fetchReportVersion).mockReturnValue(new Promise((resolve) => {
      resolveVersion = resolve;
    }));

    render(<ReportReader report={report} task={task} onReload={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "预览 v1" }));
    expect(screen.getByText("正在读取历史版本...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下载 Markdown" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "预览 v2（当前版本）" }));
    expect(screen.queryByText("正在读取历史版本...")).not.toBeInTheDocument();
    expect(screen.getByText("第二版正文")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下载 Markdown" })).toBeEnabled();

    resolveVersion({
      ...report.versions[0],
      markdown: "# 组织结构评估\n\n## 一、原始结论\n\n第一版正文",
      html: "",
    });
    await waitFor(() => expect(screen.queryByText("第一版正文")).not.toBeInTheDocument());
  });

  it("requires inline confirmation before rollback and reloads backend state", async () => {
    vi.mocked(fetchReportVersion).mockResolvedValue({ ...report.versions[0], markdown: "# 标题\n\n## 一、原始结论\n\n第一版正文", html: "" });
    vi.mocked(rollbackReportVersion).mockResolvedValue({ currentVersionId: "version-1", version: 1, wordAvailable: true, pdfAvailable: false, warning: "" });
    const onReload = vi.fn(async () => ({ ...report, currentVersionId: "version-1", version: 1 }));

    render(<ReportReader report={report} task={task} onReload={onReload} />);
    fireEvent.click(screen.getByRole("button", { name: "预览 v1" }));
    await screen.findByText("第一版正文");
    fireEvent.click(screen.getByRole("button", { name: "回滚到此版本" }));
    expect(screen.getByText("回滚会把 v1 设为新的当前版本")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认回滚到 v1" }));

    await waitFor(() => expect(rollbackReportVersion).toHaveBeenCalledWith("version-1"));
    expect(onReload).toHaveBeenCalledOnce();
  });

  it("downloads the selected version and reports PDF failures locally", async () => {
    vi.mocked(downloadReportArtifact)
      .mockResolvedValueOnce("组织结构评估.docx")
      .mockRejectedValueOnce(new Error("PDF 暂不可用。可下载 Word 版本。"));

    render(<ReportReader report={report} task={task} onReload={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "下载 Word" }));
    await waitFor(() => expect(downloadReportArtifact).toHaveBeenCalledWith("task-1", "word", "version-2"));

    fireEvent.click(screen.getByRole("button", { name: "下载 PDF" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("PDF 暂不可用");
  });
});
