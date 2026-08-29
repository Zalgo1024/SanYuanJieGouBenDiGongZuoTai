import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { ReportPresentation } from "./report-presentation";

const markdown = "# 测试报告\n\n## 核心结论\n\n结论原文。\n\n## 事件事实\n\n正文事实。\n\n[联网抓取素材]\n\nhttps://example.com/source\n\n抓取原文。";

describe("ReportPresentation", () => {
  it("keeps sources folded until the reader explicitly opens them", () => {
    const { container } = render(<ReportPresentation markdown={markdown} fallbackTitle="回退标题" mode="reader" />);

    const brief = container.querySelector(".report-brief");
    expect(Array.from(brief?.children ?? []).map((child) => child.className)).toEqual([
      "report-brief__intro",
      "report-brief__metrics",
      "report-brief__judgement",
    ]);

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

  it("offers shorter reading modes without changing the stored report", () => {
    const longReport = "# 报告\n\n## 事实摘要\n\n事实。\n\n## 分析框架\n\n框架。\n\n## 关键发现\n\n发现。\n\n## 利益结构\n\n结构。\n\n## 行动建议\n\n建议。\n\n## 附加分析\n\n附加。\n\n## 附录\n\n附录。";
    const { rerender } = render(<ReportPresentation markdown={longReport} fallbackTitle="报告" mode="reader" readingMode="quick" />);
    expect(screen.getByText(/当前为快速版阅读/)).toBeInTheDocument();
    expect(screen.getByText("事实摘要")).toBeInTheDocument();
    expect(screen.getByText("关键发现")).toBeInTheDocument();
    expect(screen.getByText("行动建议")).toBeInTheDocument();
    expect(screen.queryByText("附加分析")).not.toBeInTheDocument();

    rerender(<ReportPresentation markdown={longReport} fallbackTitle="报告" mode="reader" readingMode="research" />);
    expect(screen.getByText("附加分析")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "展开证据与来源" }));
    expect(screen.getAllByText("附录").length).toBeGreaterThan(0);
  });
});
