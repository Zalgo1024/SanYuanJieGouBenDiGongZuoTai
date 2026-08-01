import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Report } from "@/lib/domain";
import { apiRequest } from "@/lib/api";
import { ReportEditor } from "./report-editor";

const mocks = vi.hoisted(() => ({
  loadReport: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }));

const report: Report = {
  id: "task-1",
  taskId: "task-1",
  type: "policy",
  title: "政策评估",
  markdown: "# 政策评估\n\n## 一、事实摘要\n\n| 主体 | 影响 |\n| --- | --- |\n| 企业 | 成本 |",
  version: 2,
  currentVersionId: "version-2",
  updatedAt: "2026-08-02T10:00:00",
  nodes: [],
  versions: [],
};

vi.mock("@/lib/store", () => ({
  useAppStore: () => ({
    state: { reports: [report] },
    hydrated: true,
    loadReport: mocks.loadReport,
  }),
}));

describe("ReportEditor", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the shared Markdown preview and saves a distinct version note", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ id: "version-3" });
    mocks.loadReport.mockResolvedValue({ ...report, version: 3 });

    render(<ReportEditor reportId="task-1" />);
    expect(screen.getByRole("table")).toHaveTextContent("企业");
    expect(screen.getByText(/所有更改已保存/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("报告 Markdown 源码"), { target: { value: `${report.markdown}\n\n补充内容` } });
    fireEvent.change(screen.getByLabelText("版本备注"), { target: { value: "补充企业成本影响" } });
    expect(screen.getByText(/有未保存更改/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "保存为新版本" }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/api/reports/task-1/versions", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("补充企业成本影响"),
    })));
    expect(mocks.loadReport).toHaveBeenCalledWith("task-1");
  });

  it("confirms before an internal navigation discards unsaved work", () => {
    render(<ReportEditor reportId="task-1" />);
    fireEvent.change(screen.getByLabelText("报告 Markdown 源码"), { target: { value: `${report.markdown}\n\n尚未保存` } });

    fireEvent.click(screen.getByRole("link", { name: "返回阅读器" }));
    expect(screen.getByRole("dialog", { name: "确定离开编辑器吗？" })).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "继续编辑" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "返回阅读器" }));
    fireEvent.click(screen.getByRole("button", { name: "放弃更改并离开" }));
    expect(mocks.push).toHaveBeenCalledWith("/reports/task-1");
  });
});
