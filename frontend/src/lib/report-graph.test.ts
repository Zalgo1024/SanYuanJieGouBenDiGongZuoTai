import { describe, expect, it } from "vitest";
import type { MaterialRecord } from "./domain";
import { collectReportEvidence, parseReportGraphs } from "./report-graph";

const materials: MaterialRecord[] = [
  {
    id: "material-1",
    name: "监管公告.pdf",
    kind: "file",
    note: "证监会公告",
    updatedAt: "2026-08-02T10:00:00.000Z",
    status: "ready",
  },
];

describe("parseReportGraphs", () => {
  it("extracts every valid diagram and normalizes supported layouts", () => {
    const markdown = [
      "# 报告",
      "```DIAGRAM",
      JSON.stringify({ title: "利益网络", viz: "network", nodes: [{ id: "a", label: "主体甲", type: "material" }, { id: "b", label: "主体乙", type: "public" }], edges: [{ source: "a", target: "b", label: "资金", type: "economic" }] }),
      "```",
      "```DIAGRAM",
      JSON.stringify({ title: "执行架构", viz: "org", nodes: [{ id: "root", label: "决策层" }], edges: [] }),
      "```",
      "```DIAGRAM",
      JSON.stringify({ title: "未知布局", viz: "radial", nodes: [{ id: "x", label: "节点" }], edges: [] }),
      "```",
    ].join("\n");

    const result = parseReportGraphs(markdown);

    expect(result.diagrams).toHaveLength(3);
    expect(result.diagrams.map((item) => item.viz)).toEqual(["network", "org", "network"]);
    expect(result.diagrams[0].edges[0]).toMatchObject({ id: "diagram-1-edge-1", source: "a", target: "b", type: "economic" });
    expect(result.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ code: "unsupported_viz", diagramIndex: 2 })]));
  });

  it("skips malformed diagrams and dangling edges without manufacturing nodes", () => {
    const markdown = [
      "```DIAGRAM",
      "{not-json}",
      "```",
      "```DIAGRAM",
      JSON.stringify({ title: "空图", nodes: [], edges: [] }),
      "```",
      "```DIAGRAM",
      JSON.stringify({ title: "有效图", nodes: [{ id: "a", label: "甲" }], edges: [{ source: "a", target: "missing", label: "不存在" }] }),
      "```",
    ].join("\n");

    const result = parseReportGraphs(markdown);

    expect(result.diagrams).toHaveLength(1);
    expect(result.diagrams[0].nodes).toHaveLength(1);
    expect(result.diagrams[0].edges).toEqual([]);
    expect(result.warnings.map((item) => item.code)).toEqual(["invalid_json", "empty_nodes", "dangling_edge"]);
  });

  it("rejects valid JSON with invalid shapes and keeps unknown edge types neutral", () => {
    const markdown = [
      "```DIAGRAM",
      "null",
      "```",
      "```DIAGRAM",
      JSON.stringify({ title: "异常成员", nodes: [null, { id: "a", label: "主体" }], edges: [null, { source: "a", target: "a", label: "未分类关系", type: "institutional_future" }] }),
      "```",
    ].join("\n");

    const result = parseReportGraphs(markdown);

    expect(result.diagrams).toHaveLength(1);
    expect(result.diagrams[0].nodes).toEqual([{ id: "a", label: "主体", type: "actor" }]);
    expect(result.diagrams[0].edges[0].type).toBe("unknown");
    expect(result.warnings.map((item) => item.code)).toEqual(expect.arrayContaining(["invalid_shape", "unsupported_edge_type"]));
  });
});

describe("collectReportEvidence", () => {
  it("deduplicates real report links and includes task-linked materials", () => {
    const markdown = [
      "## 附录",
      "1. [证监会公告](https://example.com/source)",
      "2. [重复链接](https://example.com/source)",
      "3. [交易所说明](https://example.com/exchange)",
    ].join("\n");

    const evidence = collectReportEvidence(markdown, materials);

    expect(evidence.filter((item) => item.kind === "citation")).toHaveLength(2);
    expect(evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "citation", url: "https://example.com/source", label: "证监会公告" }),
      expect.objectContaining({ kind: "material", materialId: "material-1", label: "监管公告.pdf" }),
    ]));
  });
});
