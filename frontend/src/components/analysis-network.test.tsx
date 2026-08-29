import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import type { MaterialRecord, ResearchBundle } from "@/lib/domain";
import { AnalysisNetwork } from "./analysis-network";

const graphMocks = vi.hoisted(() => ({ fit: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn(), focusNode: vi.fn() }));

vi.mock("./graph-canvas", async () => {
  const ReactModule = await import("react");
  return {
    GraphCanvas: ReactModule.forwardRef(function MockGraphCanvas({ diagram, onError, onSelectionChange }: { diagram: { title: string; nodes: Array<{ id: string }>; edges: Array<{ id: string }> }; onError?: (error: Error) => void; onSelectionChange: (selection: { kind: "edge" | "node"; id: string }) => void }, ref) {
      ReactModule.useImperativeHandle(ref, () => graphMocks);
      return <div data-testid="graph-canvas">画布：{diagram.title}<button type="button" onClick={() => onError?.(new Error("runtime failed"))}>模拟画布错误</button>{diagram.nodes[0] && <button type="button" onClick={() => onSelectionChange({ kind: "node", id: diagram.nodes[0].id })}>选择第一个主体</button>}{diagram.edges[0] && <button type="button" onClick={() => onSelectionChange({ kind: "edge", id: diagram.edges[0].id })}>选择第一条关系</button>}</div>;
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
  JSON.stringify({ title: "利益网络", viz: "network", nodes: [{ id: "a", label: "主体甲", type: "material" }, { id: "b", label: "主体乙", type: "public" }], edges: [{ source: "a", target: "b", label: "资金", type: "economic", relation_id: "r1" }] }),
  "```",
  "```DIAGRAM",
  JSON.stringify({ title: "执行架构", viz: "org", nodes: [{ id: "root", label: "决策层", type: "political" }], edges: [] }),
  "```",
  "## 来源",
  "[公开公告](https://example.com/source)",
].join("\n");

const research: ResearchBundle = {
  schemaVersion: "1.0", status: "verified",
  sources: [{ id: "s1", title: "关系证据公告", url: "https://example.com/relation", excerpt: "公告披露了双方的资金安排。", sourceType: "official", sourceLevel: "primary", independenceGroup: "r" }],
  claims: [{ id: "c1", text: "主体甲向主体乙提供资金", claimType: "fact", significance: "key", confidence: "high", confidenceReasons: [], evidenceIds: ["s1"], counterEvidenceIds: [], section: "关系网络", unsupported: false }],
  relations: [{ id: "r1", sourceNode: "a", targetNode: "b", label: "资金", relationType: "economic", direction: "directed", polarity: "neutral", confidence: "high", evidenceIds: ["s1"], claimId: "c1", status: "confirmed" }],
  gaps: [], metrics: { sourceCount: 1, independentSourceGroupCount: 1, keyClaimCount: 1, keyClaimEvidenceCoverage: 1, directFactCitationRate: 1, unsupportedInferenceCount: 0, conflictCount: 0, gapCount: 0 }, warnings: [],
};

describe("AnalysisNetwork", () => {
  it("switches diagrams, focuses searched nodes and shows real evidence", () => {
    render(<AnalysisNetwork taskId="task-1" markdown={markdown} materials={materials} research={research} researchStatus="verified" />);

    expect(screen.getByTestId("graph-canvas")).toHaveTextContent("利益网络");
    fireEvent.click(screen.getByRole("tab", { name: "执行架构" }));
    expect(screen.getByTestId("graph-canvas")).toHaveTextContent("执行架构");

    fireEvent.change(screen.getByRole("searchbox", { name: "搜索图谱节点" }), { target: { value: "决策" } });
    fireEvent.click(screen.getByRole("button", { name: "定位节点 决策层" }));
    expect(graphMocks.focusNode).toHaveBeenCalledWith("root");

    expect(screen.getByRole("link", { name: "公开公告" })).toHaveAttribute("href", "https://example.com/source");
    expect(screen.getByText("监管公告.pdf")).toBeInTheDocument();
    expect(screen.getByText("1 条公开引用 · 1 份关联材料")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "利益网络" }));
    fireEvent.click(screen.getByRole("button", { name: "选择第一条关系" }));
    expect(screen.getByText("已确认 · 高置信度")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /关系证据公告/ })).toHaveAttribute("href", "https://example.com/relation");
  });

  it("shows node dossiers and a complete explanation for selected relationships", () => {
    const analyticalResearch = {
      ...research,
      schemaVersion: "1.1",
      nodes: [{ id: "a", label: "主体甲", role: "资金提供方", interests: ["市场扩张", "控制权"], stance: "继续投入", weight: 0.86, confidence: "high", evidenceIds: ["s1"], firstSeen: "2026-07-01", lastSeen: "2026-08-10", stanceHistory: [{ at: "2026-08-10", stance: "继续投入", evidenceIds: ["s1"] }] }],
      relations: [{ ...research.relations[0], strength: 4, interestTypes: ["economic", "power"], evidenceCount: 1, polarity: "positive", validFrom: "2026-08-01" }],
    } as ResearchBundle;
    render(<AnalysisNetwork taskId="task-1" markdown={markdown} research={analyticalResearch} researchStatus="verified" />);

    fireEvent.click(screen.getByRole("button", { name: "选择第一个主体" }));
    expect(screen.getByText("资金提供方")).toBeInTheDocument();
    expect(screen.getByText("权重 86%")).toBeInTheDocument();
    expect(screen.getByText("市场扩张、控制权")).toBeInTheDocument();
    expect(screen.getByText("继续投入")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "选择第一条关系" }));
    expect(screen.getByText("为什么系统认为双方存在这条关系？")).toBeInTheDocument();
    expect(screen.getByText("关系强度 4/5")).toBeInTheDocument();
    expect(screen.getByText(/经济利益.*权力利益/)).toBeInTheDocument();
    expect(screen.getByText(/2026-08-01/)).toBeInTheDocument();
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
