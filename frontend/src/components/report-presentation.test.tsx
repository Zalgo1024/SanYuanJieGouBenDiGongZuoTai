import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { ReportPresentation } from "./report-presentation";

const markdown = "# 测试报告\n\n## 核心结论\n\n结论原文。\n\n## 事件事实\n\n正文事实。\n\n[联网抓取素材]\n\nhttps://example.com/source\n\n抓取原文。";

describe("ReportPresentation", () => {
  it("keeps sources folded until the reader explicitly opens them", () => {
    render(<ReportPresentation markdown={markdown} fallbackTitle="回退标题" mode="reader" />);

    expect(screen.getByText("核心判断")).toBeInTheDocument();
    expect(screen.getAllByText("结论原文。")).toHaveLength(2);
    expect(screen.queryByText("抓取原文。")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "展开证据与来源" }));
    expect(screen.getByText("抓取原文。")).toBeInTheDocument();
  });

  it("keeps later sections collapsed in task-preview mode", () => {
    render(<ReportPresentation markdown={markdown} fallbackTitle="回退标题" mode="preview" />);

    expect(screen.getByText("核心结论")).toBeInTheDocument();
    expect(screen.queryByText("事件事实")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "展开完整正文" }));
    expect(screen.getByText("事件事实")).toBeInTheDocument();
  });
});
