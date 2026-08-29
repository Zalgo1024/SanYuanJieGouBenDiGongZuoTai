import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { ReportInlineGraphs } from "./report-inline-graphs";

vi.mock("./graph-canvas", () => ({
  GraphCanvas: ({ diagram }: { diagram: { title: string } }) => <div data-testid="inline-graph-canvas">{diagram.title}</div>,
}));

const diagram = (title: string, viz: string, node: string) => [
  "```DIAGRAM",
  JSON.stringify({ title, viz, nodes: [{ id: node, label: node }], edges: [] }),
  "```",
].join("\n");

describe("ReportInlineGraphs", () => {
  it("renders every valid report diagram through a compact switcher", () => {
    const markdown = [diagram("利益关系网络", "network", "主体A"), diagram("组织架构", "org", "决策层"), diagram("资金流程", "flow", "资金")].join("\n\n");
    render(<ReportInlineGraphs markdown={markdown} relationHref="/interest-analysis/report-1" />);

    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByTestId("inline-graph-canvas")).toHaveTextContent("利益关系网络");
    fireEvent.click(screen.getByRole("tab", { name: /组织架构/ }));
    expect(screen.getByTestId("inline-graph-canvas")).toHaveTextContent("组织架构");
    expect(screen.getByRole("link", { name: "打开完整关系图谱" })).toHaveAttribute("href", "/interest-analysis/report-1");
  });

  it("does not manufacture a graph section when the report has no valid diagram", () => {
    const { container } = render(<ReportInlineGraphs markdown="# 无图报告\n\n正文" />);
    expect(container).toBeEmptyDOMElement();
  });
});
