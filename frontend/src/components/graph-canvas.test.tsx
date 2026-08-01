import { render } from "@testing-library/react";
import React, { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import type { DiagramDocument } from "@/lib/report-graph";
import { buildGraphOptions, GraphCanvas } from "./graph-canvas";

const networkMocks = vi.hoisted(() => {
  const handlers = new Map<string, (payload: { nodes?: string[]; edges?: string[] }) => void>();
  const state = { failNext: false };
  const instance = {
    on: vi.fn((event: string, handler: (payload: { nodes?: string[]; edges?: string[] }) => void) => handlers.set(event, handler)),
    destroy: vi.fn(),
    fit: vi.fn(),
    moveTo: vi.fn(),
    selectNodes: vi.fn(),
    getScale: vi.fn(() => 1),
  };
  return { handlers, instance, state, constructor: vi.fn(() => {
    if (state.failNext) {
      state.failNext = false;
      throw new Error("canvas unavailable");
    }
    return instance;
  }) };
});

vi.mock("vis-network/standalone", () => ({
  DataSet: class DataSet<T> { constructor(public items: T[]) {} },
  Network: networkMocks.constructor,
}));

const baseDiagram: DiagramDocument = {
  id: "diagram-1",
  title: "利益网络",
  viz: "network",
  nodes: [{ id: "a", label: "主体甲", type: "material" }, { id: "b", label: "主体乙", type: "public" }],
  edges: [{ id: "edge-1", source: "a", target: "b", label: "资金", type: "economic" }],
};

describe("buildGraphOptions", () => {
  it("uses physics for networks and deterministic directions for org and flow", () => {
    expect(buildGraphOptions(baseDiagram).physics).toMatchObject({ enabled: true });
    expect(buildGraphOptions({ ...baseDiagram, viz: "org" }).layout?.hierarchical).toMatchObject({ enabled: true, direction: "UD" });
    expect(buildGraphOptions({ ...baseDiagram, viz: "flow" }).layout?.hierarchical).toMatchObject({ enabled: true, direction: "LR" });
  });
});

describe("GraphCanvas", () => {
  it("forwards graph selections and destroys the runtime on unmount", () => {
    const onSelectionChange = vi.fn();
    const view = render(<GraphCanvas diagram={baseDiagram} onSelectionChange={onSelectionChange} />);

    networkMocks.handlers.get("selectNode")?.({ nodes: ["a"] });
    expect(onSelectionChange).toHaveBeenCalledWith({ kind: "node", id: "a" });

    networkMocks.handlers.get("selectEdge")?.({ edges: ["edge-1"] });
    expect(onSelectionChange).toHaveBeenCalledWith({ kind: "edge", id: "edge-1" });

    view.unmount();
    expect(networkMocks.instance.destroy).toHaveBeenCalled();
  });

  it("reports runtime initialization failures without throwing through the page", () => {
    networkMocks.state.failNext = true;
    const onError = vi.fn();

    expect(() => render(<GraphCanvas diagram={baseDiagram} onSelectionChange={vi.fn()} onError={onError} />)).not.toThrow();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("zooms from the runtime scale instead of a stale local value", () => {
    const ref = createRef<import("./graph-canvas").GraphCanvasHandle>();
    networkMocks.instance.getScale.mockReturnValueOnce(1.6);
    render(<GraphCanvas ref={ref} diagram={baseDiagram} onSelectionChange={vi.fn()} />);

    ref.current?.zoomIn();

    expect(networkMocks.instance.moveTo).toHaveBeenCalledWith(expect.objectContaining({ scale: 1.92 }));
  });
});
