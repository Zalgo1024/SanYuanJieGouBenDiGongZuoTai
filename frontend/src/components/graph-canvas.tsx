"use client";

import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { DataSet, Network, type Edge, type Node, type Options } from "vis-network/standalone";
import type { DiagramDocument } from "@/lib/report-graph";

export type GraphSelection =
  | { kind: "node"; id: string }
  | { kind: "edge"; id: string }
  | null;

export interface GraphCanvasHandle {
  fit: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  focusNode: (id: string) => void;
}

interface GraphCanvasProps {
  diagram: DiagramDocument;
  onSelectionChange: (selection: GraphSelection) => void;
  onError?: (error: Error) => void;
}

const nodeColors: Record<string, { background: string; border: string }> = {
  material: { background: "#e8f0ff", border: "#3769ad" },
  security: { background: "#e7f7f0", border: "#258764" },
  political: { background: "#eeeafe", border: "#6852aa" },
  identity_culture: { background: "#fff2dd", border: "#a66a1f" },
  institutional_future: { background: "#e8f4f7", border: "#2f7c8c" },
  public: { background: "#f5edf7", border: "#8a598f" },
  legal: { background: "#f1f3f6", border: "#596879" },
  event: { background: "#fff0ee", border: "#b34f43" },
  actor: { background: "#f1f4f8", border: "#65758a" },
};

const nodeShapes: Record<string, Node["shape"]> = {
  material: "box",
  security: "ellipse",
  political: "diamond",
  identity_culture: "ellipse",
  institutional_future: "database",
  public: "box",
  legal: "database",
  event: "diamond",
  actor: "box",
};

const edgeColors: Record<string, string> = {
  economic: "#3470b8",
  power: "#7358a6",
  cultural: "#a06d24",
  legal: "#637181",
  unknown: "#7b8490",
};

const edgeDashes: Record<string, false | number[]> = {
  economic: false,
  power: [11, 4],
  cultural: [3, 4],
  legal: [7, 5],
  unknown: [2, 6],
};

export function buildGraphOptions(diagram: DiagramDocument): Options {
  const hierarchical = diagram.viz === "org"
    ? { enabled: true, direction: "UD" as const, sortMethod: "directed" as const, levelSeparation: 120, nodeSpacing: 145, treeSpacing: 190 }
    : diagram.viz === "flow"
      ? { enabled: true, direction: "LR" as const, sortMethod: "directed" as const, levelSeparation: 165, nodeSpacing: 120, treeSpacing: 170 }
      : false;

  return {
    autoResize: true,
    interaction: { hover: true, navigationButtons: false, keyboard: { enabled: true }, multiselect: false },
    layout: hierarchical ? { hierarchical } : { improvedLayout: true },
    physics: diagram.viz === "network"
      ? { enabled: true, stabilization: { enabled: true, iterations: 280, updateInterval: 30 }, barnesHut: { gravitationalConstant: -5200, springLength: 155, springConstant: 0.035 } }
      : { enabled: false },
    nodes: {
      shape: "box",
      margin: { top: 11, right: 14, bottom: 11, left: 14 },
      widthConstraint: { minimum: 90, maximum: 205 },
      borderWidth: 1,
      borderWidthSelected: 2,
      font: { face: "Inter, PingFang SC, Microsoft YaHei, sans-serif", size: 13, color: "#1d2b3c", multi: false },
      shadow: { enabled: true, color: "rgba(30, 50, 74, 0.10)", size: 12, x: 0, y: 4 },
      shapeProperties: { borderRadius: 5 },
    },
    edges: {
      arrows: { to: { enabled: true, scaleFactor: 0.58 } },
      width: 1.3,
      smooth: diagram.viz === "network" ? { enabled: true, type: "dynamic", roundness: 0.25 } : { enabled: true, type: "cubicBezier", roundness: 0.35 },
      font: { face: "Inter, PingFang SC, Microsoft YaHei, sans-serif", size: 10, color: "#526276", align: "middle", background: "rgba(251,252,254,0.88)", strokeWidth: 0 },
      color: { color: "#6a7889", highlight: "#245f9e", hover: "#245f9e", opacity: 0.86 },
      selectionWidth: 2.2,
    },
  };
}

function escapeTooltipText(value: unknown): string {
  // vis-network 的 tooltip (title) 以 innerHTML 渲染，必须转义，防注入
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function graphData(diagram: DiagramDocument) {
  const nodes = new DataSet<Node>(diagram.nodes.map((node) => {
    const color = nodeColors[node.type] ?? nodeColors.actor;
    return { id: node.id, label: node.label, title: `${escapeTooltipText(node.label)}\n类型：${escapeTooltipText(node.type)}`, shape: nodeShapes[node.type] ?? "box", color: { ...color, highlight: { background: "#ffffff", border: color.border }, hover: { background: "#ffffff", border: color.border } } };
  }));
  const edges = new DataSet<Edge>(diagram.edges.map((edge) => ({
    id: edge.id,
    from: edge.source,
    to: edge.target,
    label: edge.label,
    title: `${escapeTooltipText(edge.label)}\n类型：${escapeTooltipText(edge.type)}`,
    color: { color: edgeColors[edge.type] ?? edgeColors.unknown, highlight: edgeColors[edge.type] ?? edgeColors.unknown, hover: edgeColors[edge.type] ?? edgeColors.unknown },
    dashes: edgeDashes[edge.type] ?? edgeDashes.unknown,
  })));
  return { nodes, edges };
}

export const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(function GraphCanvas({ diagram, onSelectionChange, onError }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);

  useImperativeHandle(ref, () => ({
    fit() {
      networkRef.current?.fit({ animation: { duration: 220, easingFunction: "easeOutCubic" } });
    },
    zoomIn() {
      const network = networkRef.current;
      if (!network) return;
      network.moveTo({ scale: Math.min(2.4, network.getScale() * 1.2), animation: { duration: 180, easingFunction: "easeOutCubic" } });
    },
    zoomOut() {
      const network = networkRef.current;
      if (!network) return;
      network.moveTo({ scale: Math.max(0.28, network.getScale() / 1.2), animation: { duration: 180, easingFunction: "easeOutCubic" } });
    },
    focusNode(id: string) {
      networkRef.current?.selectNodes([id]);
      networkRef.current?.focus(id, { scale: 1.2, animation: { duration: 240, easingFunction: "easeOutCubic" } });
    },
  }), []);

  useEffect(() => {
    if (!containerRef.current) return;
    let network: Network;
    try {
      network = new Network(containerRef.current, graphData(diagram), buildGraphOptions(diagram));
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error("关系图运行时初始化失败"));
      return;
    }
    networkRef.current = network;
    network.on("selectNode", (event) => onSelectionChange(event.nodes?.[0] ? { kind: "node", id: String(event.nodes[0]) } : null));
    network.on("selectEdge", (event) => {
      if (!event.nodes?.length && event.edges?.[0]) onSelectionChange({ kind: "edge", id: String(event.edges[0]) });
    });
    network.on("deselectNode", () => onSelectionChange(null));
    network.on("deselectEdge", () => onSelectionChange(null));
    return () => {
      network.destroy();
      networkRef.current = null;
    };
  }, [diagram, onError, onSelectionChange]);

  return <div ref={containerRef} className="graph-canvas" role="img" aria-label={diagram.title} tabIndex={0} />;
});
