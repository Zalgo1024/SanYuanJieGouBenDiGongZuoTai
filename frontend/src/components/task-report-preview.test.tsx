import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import type { Report } from "@/lib/domain";
import { TaskReportPreview } from "./task-report-preview";

const report: Report = {
  id: "report-1",
  taskId: "task-1",
  type: "case",
  title: "测试报告",
  markdown: "# 测试报告\n\n## 核心结论\n\n结论内容。\n\n[联网抓取素材]\n\nhttps://example.com\n\n抓取内容。",
  version: 1,
  currentVersionId: "version-1",
  updatedAt: "2026-08-08T00:00:00",
  nodes: [],
  versions: [],
};

describe("TaskReportPreview", () => {
  it("shows a delivery summary and keeps scraped material folded", () => {
    render(<TaskReportPreview report={report} />);

    expect(screen.getByText("交付摘要")).toBeInTheDocument();
    expect(screen.queryByText("抓取内容。")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "展开证据与来源" }));
    expect(screen.getByText("抓取内容。")).toBeInTheDocument();
  });
});
