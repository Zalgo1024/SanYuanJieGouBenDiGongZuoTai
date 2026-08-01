import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { extractReportOutline, MarkdownReport, stripDiagramBlocks } from "./markdown";

const markdown = `# 报告标题

## 一、事实摘要

这是包含**重点**和[公开来源](https://example.com/source)的正文。

1. 第一项
2. 第二项

> 证据强度仍有限。

| 主体 | 诉求 |
| --- | --- |
| 平台 | 稳定治理 |

\`\`\`DIAGRAM
{"title":"不应显示的关系图","nodes":[{"id":"a","label":"甲"}]}
\`\`\`

## 二、核心判断

结论正文。`;

describe("MarkdownReport", () => {
  it("renders GFM content, safe external links and stable heading anchors", () => {
    render(<MarkdownReport markdown={markdown} hideTitle />);

    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "一、事实摘要" })).toHaveAttribute("id", "report-section-1");
    expect(screen.getByRole("table")).toHaveTextContent("平台");
    expect(screen.getByRole("link", { name: "公开来源" })).toHaveAttribute("target", "_blank");
    expect(screen.getByText("第一项")).toBeInTheDocument();
    expect(screen.getByText("证据强度仍有限。")).toBeInTheDocument();
    expect(screen.queryByText(/不应显示的关系图/)).not.toBeInTheDocument();
  });

  it("extracts the same outline ids used by rendered level-two headings", () => {
    expect(extractReportOutline(markdown)).toEqual([
      { id: "report-section-1", label: "一、事实摘要" },
      { id: "report-section-2", label: "二、核心判断" },
    ]);
  });

  it("removes DIAGRAM blocks while preserving surrounding report text", () => {
    const cleaned = stripDiagramBlocks(markdown);
    expect(cleaned).toContain("事实摘要");
    expect(cleaned).toContain("核心判断");
    expect(cleaned).not.toContain("不应显示的关系图");
  });

  it("removes DIAGRAM blocks written with alternate Markdown fences", () => {
    const alternate = "## 正文\n\n~~~diagram\n{\"title\":\"波浪围栏\"}\n~~~\n\n````DIAGRAM\n{\"title\":\"四反引号\"}\n````\n\n结论";
    render(<MarkdownReport markdown={alternate} />);

    expect(screen.getByText("结论")).toBeInTheDocument();
    expect(screen.queryByText(/波浪围栏|四反引号/)).not.toBeInTheDocument();
    expect(stripDiagramBlocks(alternate)).not.toMatch(/波浪围栏|四反引号/);
  });
});
