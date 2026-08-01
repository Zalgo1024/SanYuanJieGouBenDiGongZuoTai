import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import type { MaterialRecord } from "@/lib/domain";
import { AnalysisNetwork } from "./analysis-network";

const graphMocks = vi.hoisted(() => ({ fit: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn(), focusNode: vi.fn() }));

vi.mock("./graph-canvas", async () => {
  const ReactModule = await import("react");
  return {
    GraphCanvas: ReactModule.forwardRef(function MockGraphCanvas({ diagram, onError }: { diagram: { title: string }; onError?: (error: Error) => void }, ref) {
      ReactModule.useImperativeHandle(ref, () => graphMocks);
      return <div data-testid="graph-canvas">画布：{diagram.title}<button type="button" onClick={() => onError?.(new Error("runtime failed"))}>模拟画布错误</button></div>;
    }),
  };
});

const materials: MaterialRecord[] = [{
  id: "material-1",
  name: "监管公告.pdf",
  kind: "file",
  note: "证监会公告",
  updatedAt: "2026-08-02T10:00:00.000Z",
  status: "ready",
}];

const markdown = [
  "# 报告",
  "```DIAGRAM",
  JSON.stringify({ title: "利益网络", viz: "network", nodes: [{ id: "a", label: "主体甲", type: "material" }, { id: "b", label: "主体乙", type: "public" }], edges: [{ source: "a", target: "b", label: "资金", type: "economic" }] }),
  "```",
  "```DIAGRAM",
  JSON.stringify({ title: "执行架构", viz: "org", nodes: [{ id: "root", label: "决策层", type: "political" }], edges: [] }),
  "```",
  "## 来源",
  "[公开公告](https://example.com/source)",
].join("\n");

describe("AnalysisNetwork", () => {
  it("switches diagrams, focuses searched nodes and shows real evidence", () => {
    render(<AnalysisNetwork taskId="task-1" markdown={markdown} materials={materials} />);

    expect(screen.getByTestId("graph-canvas")).toHaveTextContent("利益网络");
    fireEvent.click(screen.getByRole("tab", { name: "执行架构" }));
    expect(screen.getByTestId("graph-canvas")).toHaveTextContent("执行架构");

    fireEvent.change(screen.getByRole("searchbox", { name: "搜索图谱节点" }), { target: { value: "决策" } });
    fireEvent.click(screen.getByRole("button", { name: "定位节点 决策层" }));
    expect(graphMocks.focusNode).toHaveBeenCalledWith("root");

    expect(screen.getByRole("link", { name: "公开公告" })).toHaveAttribute("href", "https://example.com/source");
    expect(screen.getByText("监管公告.pdf")).toBeInTheDocument();
    expect(screen.getByText("1 条公开引用 · 1 份关联材料")).toBeInTheDocument();
  });

  it("shows an honest empty state instead of manufacturing a graph", () => {
    render(<AnalysisNetwork taskId="task-1" markdown="# 没有图的报告" materials={[]} />);
    expect(screen.getByRole("heading", { name: "未发现可用关系图" })).toBeInTheDocument();
    expect(screen.queryByTestId("graph-canvas")).not.toBeInTheDocument();
  });

  it("shows a retry action when the graph runtime fails", () => {
    render(<AnalysisNetwork taskId="task-1" markdown={markdown} materials={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "模拟画布错误" }));

    expect(screen.getByRole("heading", { name: "关系图暂时无法绘制" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重试绘制" }));
    expect(screen.getByTestId("graph-canvas")).toBeInTheDocument();
  });

  it("clears the selected node when a new report version reuses the same diagram position", () => {
    const view = render(<AnalysisNetwork taskId="task-1" markdown={markdown} materials={[]} />);
    fireEvent.click(screen.getByRole("tab", { name: "执行架构" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "搜索图谱节点" }), { target: { value: "决策" } });
    fireEvent.click(screen.getByRole("button", { name: "定位节点 决策层" }));
    expect(screen.getByRole("heading", { name: "决策层" })).toBeInTheDocument();

    const nextVersion = markdown.replace("决策层", "执行层");
    view.rerender(<AnalysisNetwork taskId="task-1" markdown={nextVersion} materials={[]} />);

    expect(screen.getByRole("heading", { name: "选择一个主体或关系" })).toBeInTheDocument();
  });
});
