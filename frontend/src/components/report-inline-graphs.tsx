"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, LocateFixed, Network, ZoomIn, ZoomOut } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ResearchBundle } from "@/lib/domain";
import { enrichDiagramWithResearch, parseReportGraphs, type DiagramDocument } from "@/lib/report-graph";
import { GraphCanvas, type GraphCanvasHandle } from "./graph-canvas";

const vizLabels: Record<DiagramDocument["viz"], string> = {
  network: "关系网络",
  org: "组织架构",
  flow: "流程图",
};

export function ReportInlineGraphs({ markdown, research, relationHref }: { markdown: string; research?: ResearchBundle; relationHref?: string }) {
  const parsed = useMemo(() => parseReportGraphs(markdown), [markdown]);
  const diagrams = useMemo(() => parsed.diagrams.map((diagram) => enrichDiagramWithResearch(diagram, research)), [parsed.diagrams, research]);
  const [activeId, setActiveId] = useState(diagrams[0]?.id ?? "");
  const [canvasError, setCanvasError] = useState("");
  const [canvasAttempt, setCanvasAttempt] = useState(0);
  const canvasRef = useRef<GraphCanvasHandle>(null);
  const ignoreSelection = useCallback(() => undefined, []);
  const handleCanvasError = useCallback((error: Error) => setCanvasError(error.message || "关系图暂时无法绘制。"), []);

  useEffect(() => {
    if (!diagrams.some((diagram) => diagram.id === activeId)) setActiveId(diagrams[0]?.id ?? "");
  }, [activeId, diagrams]);

  if (!diagrams.length) return null;
  const activeDiagram = diagrams.find((diagram) => diagram.id === activeId) ?? diagrams[0];

  function chooseDiagram(id: string) {
    setActiveId(id);
    setCanvasError("");
  }

  return <div id="report-inline-graphs" className="report-inline-graphs" role="region" aria-label="报告关系图谱">
    <header>
      <div><span className="eyebrow"><Network size={14} />结构图谱</span><h2>报告关系网络</h2><p>报告包含 {diagrams.length} 张图，可在这里切换查看。</p></div>
      {relationHref && <Link href={relationHref} aria-label="打开完整关系图谱">完整图谱与证据链 <ArrowRight size={15} /></Link>}
    </header>

    {diagrams.length > 1 && <div className="report-inline-graphs__tabs" role="tablist" aria-label="报告图谱列表">
      {diagrams.map((diagram) => <button type="button" role="tab" aria-label={`${vizLabels[diagram.viz]}：${diagram.title}`} aria-selected={diagram.id === activeDiagram.id} onClick={() => chooseDiagram(diagram.id)} key={diagram.id}><span>{vizLabels[diagram.viz]}</span>{diagram.title}</button>)}
    </div>}

    <div className="report-inline-graphs__stage">
      <div className="report-inline-graphs__heading"><div><span>{vizLabels[activeDiagram.viz]}</span><h3>{activeDiagram.title}</h3><p>{activeDiagram.nodes.length} 个主体 · {activeDiagram.edges.length} 条关系</p></div><div className="report-inline-graphs__tools"><button type="button" aria-label="适应图谱视口" title="适应视口" onClick={() => canvasRef.current?.fit()}><LocateFixed size={16} /></button><button type="button" aria-label="放大报告图谱" title="放大" onClick={() => canvasRef.current?.zoomIn()}><ZoomIn size={16} /></button><button type="button" aria-label="缩小报告图谱" title="缩小" onClick={() => canvasRef.current?.zoomOut()}><ZoomOut size={16} /></button></div></div>
      {canvasError ? <div className="report-inline-graphs__error" role="alert"><AlertTriangle size={20} /><div><strong>当前图谱绘制失败</strong><p>{canvasError}</p><button type="button" onClick={() => { setCanvasAttempt((value) => value + 1); setCanvasError(""); }}>重新绘制</button></div></div> : <GraphCanvas key={`${activeDiagram.id}-${canvasAttempt}`} ref={canvasRef} diagram={activeDiagram} onSelectionChange={ignoreSelection} onError={handleCanvasError} />}
    </div>

    {parsed.warnings.length > 0 && <p className="report-inline-graphs__warning"><AlertTriangle size={14} />另有 {parsed.warnings.length} 项无效图谱数据已跳过，页面未补造节点。</p>}
  </div>;
}
