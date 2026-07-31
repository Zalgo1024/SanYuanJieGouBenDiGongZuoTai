"use client";

import { useEffect, useRef, useState } from "react";
import {
  nodeColor,
  edgeColor,
  nodeTypeLabel,
  type DiagramNode,
  type DiagramEdge,
} from "@/lib/network";

export interface NetworkCanvasProps {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  /** 三态布局（T6）：network=力导向 / org=自上而下层级树 / flow=左→右水平流程。默认 network。 */
  viz?: "network" | "org" | "flow";
  /** 标记为「中心」的节点 id（信息卡高亮用）。 */
  centerId?: string;
}

/**
 * 交互式利益关系网络图（vis-network）。
 * 数据来自真实报告的 DIAGRAM JSON（props.nodes / props.edges），
 * 不再使用写死的样例。可拖拽、缩放、点击节点看信息。
 *
 * 三态渲染：
 * - viz=org  → 关闭物理，layout.hierarchical UD（层级树，适合组织架构）
 * - viz=flow → 关闭物理，layout.hierarchical LR（水平流程，适合时间线/动线）
 * - viz=network → 现状力导向（物理开）
 */
export default function NetworkCanvas({ nodes, edges, viz = "network", centerId }: NetworkCanvasProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<DiagramNode | null>(null);
  const [info, setInfo] = useState<{ degree: number; neighbors: string[] }>({
    degree: 0,
    neighbors: [],
  });

  // 邻接表（点击信息卡用）
  const adjacency = (() => {
    const map = new Map<string, string[]>();
    for (const e of edges) {
      if (!map.has(e.source)) map.set(e.source, []);
      if (!map.has(e.target)) map.set(e.target, []);
      map.get(e.source)!.push(e.target);
      map.get(e.target)!.push(e.source);
    }
    return map;
  })();

  const labelOf = (id: string) =>
    nodes.find((n) => n.id === id)?.label ?? id;

  useEffect(() => {
    let network: any = null;
    let cancelled = false;

    (async () => {
      const { Network, DataSet } = await import("vis-network/standalone");
      if (cancelled || !ref.current) return;

      const visNodes = new DataSet<any>(
        nodes.map((n) => {
          const isCenter = n.id === centerId;
          const bg = nodeColor(n.type);
          return {
            id: n.id,
            label: n.label,
            color: {
              background: bg,
              border: isCenter ? "#1B3A5C" : bg,
            },
            shape: n.type === "actor" ? "hexagon" : "dot",
            size: n.type === "actor" ? 26 : 13,
            borderWidth: isCenter ? 4 : 2,
            font: { color: "#1A1A2E", size: 13, face: "Noto Sans SC" },
          };
        })
      );

      const visEdges = new DataSet<any>(
        edges.map((e, i) => ({
          id: i,
          from: e.source,
          to: e.target,
          label: e.label || "",
          color: { color: edgeColor(e.type), opacity: 0.7 },
          width: 1.5,
          dashes: e.style === "dashed",
          font: {
            color: "#6B7280",
            size: 11,
            strokeWidth: 0,
            background: "#FFFFFF",
          },
        }))
      );

      // 三态布局（T6）：org/flow 关物理用层级树；network 保持力导向
      const hierarchical = viz === "org" || viz === "flow";
      const options: any = {
        physics: {
          enabled: !hierarchical,
          stabilization: { iterations: 200 },
          barnesHut: {
            gravitationalConstant: -8000,
            springLength: 120,
            springConstant: 0.04,
          },
        },
        interaction: {
          dragNodes: true,
          dragView: true,
          zoomView: true,
          hover: true,
          tooltipDelay: 120,
        },
        nodes: { borderWidth: 2 },
        edges: { smooth: { enabled: true, type: "dynamic", roundness: 0.5 } },
      };
      if (hierarchical) {
        options.layout = {
          hierarchical: {
            enabled: true,
            direction: viz === "flow" ? "LR" : "UD", // flow 左→右 / org 上→下
            sortMethod: "directed",
            shakeTowards: "leaves",
            nodeSpacing: 140,
            levelSeparation: 110,
          },
        };
        // 层级布局下关闭边平滑，避免弯曲
        options.edges = { smooth: { enabled: false } };
        options.interaction.dragView = true;
        options.physics = { enabled: false };
      }

      network = new Network(
        ref.current,
        { nodes: visNodes, edges: visEdges },
        options
      );

      network.on("click", (params: { nodes: string[] }) => {
        if (params.nodes.length) {
          const id = params.nodes[0];
          const node = nodes.find((n) => n.id === id) || null;
          setSelected(node);
          const nb = (adjacency.get(id) || []).map(labelOf);
          setInfo({ degree: nb.length, neighbors: nb });
        } else {
          setSelected(null);
        }
      });
    })();

    return () => {
      cancelled = true;
      network?.destroy();
    };
  }, [nodes, edges, centerId, viz]); // 数据或布局变化时重建画布

  if (!nodes.length) {
    return (
      <div className="w-full h-full flex items-center justify-center text-[13px] text-muted">
        暂无关系图数据
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <div ref={ref} className="w-full h-full" />
      {selected && (
        <div className="absolute right-4 bottom-4 w-[260px] bg-white border border-cardborder rounded-card shadow-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ background: nodeColor(selected.type) }}
            />
            <span className="text-[14px] font-semibold text-ink">
              {selected.label}
            </span>
          </div>
          <div className="text-[12px] text-sub leading-relaxed">
            类型：{nodeTypeLabel(selected.type)}
            <br />
            连接数：{info.degree}
            {info.neighbors.length > 0 && (
              <>
                <br />
                关联：{info.neighbors.slice(0, 4).join("、")}
                {info.neighbors.length > 4 ? "…" : ""}
              </>
            )}
          </div>
          <button
            className="text-[12px] text-navy mt-2 hover:underline"
            onClick={() => setSelected(null)}
          >
            关闭
          </button>
        </div>
      )}
      {!selected && (
        <div className="absolute right-4 bottom-4 text-[12px] text-muted bg-white/80 border border-cardborder rounded-card px-3 py-2">
          提示：可拖拽节点、滚轮缩放；点击节点查看信息
        </div>
      )}
    </div>
  );
}
