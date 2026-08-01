"use client";

import { AlertTriangle, ExternalLink, FileText, LocateFixed, Network as NetworkIcon, Search, ZoomIn, ZoomOut } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import type { MaterialRecord } from "@/lib/domain";
import { collectReportEvidence, parseReportGraphs, type DiagramDocument } from "@/lib/report-graph";
import { GraphCanvas, type GraphCanvasHandle, type GraphSelection } from "@/components/graph-canvas";

type LoadState = "loading" | "ready" | "missing" | "error";

const vizLabels: Record<DiagramDocument["viz"], string> = {
  network: "关系网络",
  org: "组织架构",
  flow: "流程",
};

const nodeTypeLabels: Record<string, string> = {
  material: "物质利益",
  security: "安全利益",
  political: "权力与政治",
  identity_culture: "身份与文化",
  institutional_future: "制度与未来",
  public: "公共空间",
  legal: "规则与监管",
  event: "事件节点",
  actor: "一般主体",
};

const edgeTypeLabels: Record<string, string> = {
  economic: "经济关系",
  power: "权力关系",
  cultural: "文化关系",
  legal: "法律关系",
  unknown: "未分类关系",
};

export function AnalysisNetwork({ taskId, markdown: currentMarkdown, materials = [] }: { taskId: string; markdown?: string; materials?: MaterialRecord[] }) {
  const [markdown, setMarkdown] = useState<string | null>(currentMarkdown ?? null);
  const [state, setState] = useState<LoadState>(currentMarkdown ? "ready" : "loading");
  const [activeDiagramId, setActiveDiagramId] = useState("");
  const [selection, setSelection] = useState<GraphSelection>(null);
  const [query, setQuery] = useState("");
  const [canvasError, setCanvasError] = useState<Error | null>(null);
  const [canvasAttempt, setCanvasAttempt] = useState(0);
  const canvasRef = useRef<GraphCanvasHandle>(null);

  useEffect(() => {
    if (currentMarkdown) {
      setMarkdown(currentMarkdown);
      setState("ready");
      return;
    }
    let active = true;
    setState("loading");
    apiRequest<{ status: string; data?: { markdown?: string } }>(`/api/analyze/${taskId}`)
      .then((result) => {
        if (!active) return;
        if (result.status === "done" && result.data?.markdown) {
          setMarkdown(result.data.markdown);
          setState("ready");
        } else if (result.status === "error") {
          setState("error");
        } else {
          setState("missing");
        }
      })
      .catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, [currentMarkdown, taskId]);

  const parsed = useMemo(() => parseReportGraphs(markdown ?? ""), [markdown]);
  const evidence = useMemo(() => collectReportEvidence(markdown ?? "", materials), [markdown, materials]);

  useEffect(() => {
    if (!parsed.diagrams.some((diagram) => diagram.id === activeDiagramId)) {
      setActiveDiagramId(parsed.diagrams[0]?.id ?? "");
      setSelection(null);
      setQuery("");
    }
  }, [activeDiagramId, parsed.diagrams]);

  useEffect(() => {
    setSelection(null);
    setQuery("");
    setCanvasError(null);
  }, [markdown]);

  const activeDiagram = parsed.diagrams.find((diagram) => diagram.id === activeDiagramId) ?? parsed.diagrams[0];
  const selectedNode = selection?.kind === "node" ? activeDiagram?.nodes.find((node) => node.id === selection.id) : null;
  const selectedEdge = selection?.kind === "edge" ? activeDiagram?.edges.find((edge) => edge.id === selection.id) : null;
  const citations = evidence.filter((item) => item.kind === "citation");
  const linkedMaterials = evidence.filter((item) => item.kind === "material");
  const searchMatches = query.trim() && activeDiagram
    ? activeDiagram.nodes.filter((node) => node.label.toLocaleLowerCase("zh-CN").includes(query.trim().toLocaleLowerCase("zh-CN"))).slice(0, 8)
    : [];

  const handleSelection = useCallback((next: GraphSelection) => setSelection(next), []);
  const handleCanvasError = useCallback((error: Error) => setCanvasError(error), []);

  function chooseDiagram(id: string) {
    setActiveDiagramId(id);
    setSelection(null);
    setQuery("");
    setCanvasError(null);
  }

  function focusNode(id: string) {
    setSelection({ kind: "node", id });
    canvasRef.current?.focusNode(id);
  }

  if (state === "loading") return <section className="network-loading" aria-busy="true">正在读取关系图数据…</section>;
  if (state === "error") return <div className="workbench-network"><AlertTriangle size={24} /><div><span className="eyebrow">关系图读取失败</span><h2>无法读取后端报告</h2><p>请确认本地后端仍在运行，再重新进入当前任务。</p></div></div>;
  if (state !== "ready" || !markdown) return <div className="workbench-network"><NetworkIcon size={24} /><div><span className="eyebrow">关系图</span><h2>报告尚未生成</h2><p>分析任务完成后，这里会读取报告中的真实 DIAGRAM 数据。</p></div></div>;
  if (!activeDiagram) return <div className="workbench-network"><NetworkIcon size={24} /><div><span className="eyebrow">关系图</span><h2>未发现可用关系图</h2><p>当前报告没有合法的 DIAGRAM 数据。页面不会根据正文自行补造主体或关系。</p>{parsed.warnings.length > 0 && <span className="graph-warning-count"><AlertTriangle size={14} />{parsed.warnings.length} 项图谱数据未能解析</span>}</div></div>;

  const inbound = selectedNode ? activeDiagram.edges.filter((edge) => edge.target === selectedNode.id) : [];
  const outbound = selectedNode ? activeDiagram.edges.filter((edge) => edge.source === selectedNode.id) : [];
  const edgeSource = selectedEdge ? activeDiagram.nodes.find((node) => node.id === selectedEdge.source) : null;
  const edgeTarget = selectedEdge ? activeDiagram.nodes.find((node) => node.id === selectedEdge.target) : null;

  return (
    <section className="analysis-network">
      <header className="graph-header">
        <div>
          <span className="eyebrow">结构图谱</span>
          <h2>{activeDiagram.title}</h2>
          <p>{activeDiagram.nodes.length} 个节点 · {activeDiagram.edges.length} 条关系 · {vizLabels[activeDiagram.viz]}</p>
        </div>
        {parsed.warnings.length > 0 && <span className="graph-warning-count"><AlertTriangle size={14} />{parsed.warnings.length} 项图谱数据已跳过</span>}
      </header>

      {parsed.diagrams.length > 1 && (
        <div className="graph-tabs" role="tablist" aria-label="报告关系图">
          {parsed.diagrams.map((diagram) => <button type="button" role="tab" aria-label={diagram.title} aria-selected={diagram.id === activeDiagram.id} className={diagram.id === activeDiagram.id ? "graph-tab graph-tab--active" : "graph-tab"} onClick={() => chooseDiagram(diagram.id)} key={diagram.id}><span>{vizLabels[diagram.viz]}</span>{diagram.title}</button>)}
        </div>
      )}

      <div className="graph-workspace">
        <section className="graph-stage" aria-label="关系图画布工具">
          <div className="graph-toolbar">
            <label className="graph-search"><Search size={15} /><input type="search" aria-label="搜索图谱节点" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索节点" /></label>
            <div className="graph-toolbar__actions">
              <button type="button" aria-label="适应视口" title="适应视口" onClick={() => canvasRef.current?.fit()}><LocateFixed size={16} /></button>
              <button type="button" aria-label="放大图谱" title="放大" onClick={() => canvasRef.current?.zoomIn()}><ZoomIn size={16} /></button>
              <button type="button" aria-label="缩小图谱" title="缩小" onClick={() => canvasRef.current?.zoomOut()}><ZoomOut size={16} /></button>
            </div>
            {searchMatches.length > 0 && <div className="graph-search-results">{searchMatches.map((node) => <button type="button" aria-label={`定位节点 ${node.label}`} onClick={() => focusNode(node.id)} key={node.id}><span className={`graph-node-dot graph-node-dot--${node.type}`} />{node.label}</button>)}</div>}
          </div>
          {canvasError ? <div className="graph-runtime-error" role="alert"><AlertTriangle size={23} /><div><span className="eyebrow">图谱运行时错误</span><h3>关系图暂时无法绘制</h3><p>报告数据仍然保留，可以重新初始化当前画布。</p><button type="button" className="secondary-button" onClick={() => { setCanvasAttempt((value) => value + 1); setCanvasError(null); }}>重试绘制</button></div></div> : <>
            <GraphCanvas key={`${activeDiagram.id}-${canvasAttempt}`} ref={canvasRef} diagram={activeDiagram} onSelectionChange={handleSelection} onError={handleCanvasError} />
            <div className="graph-legend" aria-label="关系类型图例">
              {Object.entries(edgeTypeLabels).map(([type, label]) => <span key={type}><i className={`graph-edge-key graph-edge-key--${type}`} />{label}</span>)}
            </div>
          </>}
        </section>

        <aside className="graph-inspector">
          {selectedNode ? <>
            <span className="eyebrow">选中主体</span><h3>{selectedNode.label}</h3><p>{nodeTypeLabels[selectedNode.type] ?? selectedNode.type}</p>
            <div className="graph-inspector__stats"><span>流入 <strong>{inbound.length}</strong></span><span>流出 <strong>{outbound.length}</strong></span></div>
            <div className="graph-relation-list">{[...inbound, ...outbound].map((edge) => <button type="button" onClick={() => setSelection({ kind: "edge", id: edge.id })} key={edge.id}><strong>{edge.label}</strong><span>{activeDiagram.nodes.find((node) => node.id === edge.source)?.label} → {activeDiagram.nodes.find((node) => node.id === edge.target)?.label}</span></button>)}</div>
          </> : selectedEdge ? <>
            <span className="eyebrow">选中关系</span><h3>{selectedEdge.label}</h3><p>{edgeTypeLabels[selectedEdge.type] ?? selectedEdge.type}</p>
            <div className="graph-edge-path"><button type="button" onClick={() => focusNode(selectedEdge.source)}>{edgeSource?.label ?? selectedEdge.source}</button><span>→</span><button type="button" onClick={() => focusNode(selectedEdge.target)}>{edgeTarget?.label ?? selectedEdge.target}</button></div>
          </> : <>
            <span className="eyebrow">图谱检查器</span><h3>选择一个主体或关系</h3><p>点击画布节点查看流入与流出关系；点击连线查看关系类型和方向。</p>
            <div className="graph-node-index">{activeDiagram.nodes.slice(0, 12).map((node) => <button type="button" onClick={() => focusNode(node.id)} key={node.id}><span className={`graph-node-dot graph-node-dot--${node.type}`} />{node.label}</button>)}</div>
          </>}
        </aside>
      </div>

      <section className="graph-evidence">
        <header><div><span className="eyebrow">证据基础</span><h3>报告引用与任务材料</h3></div><strong>{citations.length} 条公开引用 · {linkedMaterials.length} 份关联材料</strong></header>
        <p className="graph-evidence__scope">以下内容是整份报告的来源基础，不表示后端已经建立到单个节点或关系的逐句证明映射。</p>
        <div className="graph-evidence__columns">
          <div><h4>报告中的公开引用</h4>{citations.length ? citations.map((item) => <a href={item.url} aria-label={item.label} target="_blank" rel="noreferrer" key={item.id}><ExternalLink size={14} /><span><strong>{item.label}</strong><small>{item.detail}</small></span></a>) : <p>当前报告没有 Markdown 公开链接。</p>}</div>
          <div><h4>任务关联材料</h4>{linkedMaterials.length ? linkedMaterials.map((item) => <div className="graph-material" key={item.id}><FileText size={15} /><span><strong>{item.label}</strong><small>{item.detail}</small></span><em className={item.status === "error" ? "graph-material__status graph-material__status--error" : "graph-material__status"}>{item.status === "error" ? "解析告警" : "已关联"}</em></div>) : <p>当前任务没有关联材料。</p>}</div>
        </div>
      </section>
    </section>
  );
}
