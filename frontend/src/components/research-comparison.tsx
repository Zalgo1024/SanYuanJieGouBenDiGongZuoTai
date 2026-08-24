"use client";

import { ArrowRight, GitCompareArrows, Scale } from "lucide-react";
import React, { useState } from "react";
import type { ResearchBundle, ResearchConfidence } from "@/lib/domain";

const confidenceLabel: Record<ResearchConfidence, string> = { high: "高", medium: "中", low: "低", unknown: "未知" };

function EvidenceLinks({ ids, research }: { ids: string[]; research: ResearchBundle }) {
  const sources = ids.map((id) => research.sources.find((source) => source.id === id)).filter(Boolean);
  if (!sources.length) return <small>没有可核验来源</small>;
  return <div className="research-evidence-links">{sources.map((source) => source && <a href={source.url || undefined} target="_blank" rel="noreferrer" key={source.id}>{source.title}</a>)}</div>;
}

export function ResearchComparison({ research }: { research?: ResearchBundle }) {
  const analogues = research?.analogues ?? [];
  const counterfactuals = research?.counterfactuals ?? [];
  const [mode, setMode] = useState<"analogue" | "counterfactual">(analogues.length ? "analogue" : "counterfactual");
  if (!research || (!analogues.length && !counterfactuals.length)) return null;

  return <section className="research-comparison">
    <header><div><span className="eyebrow">解释增量</span><h2>对照与反事实</h2><p>相似不等于相同；反事实只作为带条件的可证伪假设。</p></div><GitCompareArrows size={21} /></header>
    <div className="research-segmented" role="group" aria-label="对照分析类型">
      <button type="button" aria-pressed={mode === "analogue"} onClick={() => setMode("analogue")}>对照案例 <span>{analogues.length}</span></button>
      <button type="button" aria-pressed={mode === "counterfactual"} onClick={() => setMode("counterfactual")}>反事实 <span>{counterfactuals.length}</span></button>
    </div>
    {mode === "analogue" && <div className="research-comparison__list">{analogues.length ? analogues.map((item) => <article key={item.id}>
      <div className="research-comparison__title"><div><small>{[item.period, item.jurisdiction, item.domain].filter(Boolean).join(" · ") || "背景信息待补"}</small><h3>{item.title}</h3></div><span>{confidenceLabel[item.comparability]}可比性</span></div>
      {item.summary && <p>{item.summary}</p>}
      <dl><div><dt>相似之处</dt><dd>{item.similarities.join("；") || "尚未确认"}</dd></div><div><dt>当前差异</dt><dd>{item.differences.join("；") || "尚未确认"}</dd></div><div><dt>如何处理</dt><dd>{item.response || "未知"}</dd></div><div><dt>最终结果</dt><dd>{item.outcome || "未知"}</dd></div></dl>
      <footer><span>{confidenceLabel[item.confidence]}置信度 · {item.evidenceIds.length} 条来源</span><EvidenceLinks ids={item.evidenceIds} research={research} /></footer>
    </article>) : <p className="research-comparison__empty">当前材料没有支持可靠的历史对照案例。</p>}</div>}
    {mode === "counterfactual" && <div className="research-comparison__list">{counterfactuals.length ? counterfactuals.map((item) => <article key={item.id}>
      <div className="research-comparison__title"><div><small>{item.status === "evidence_based" ? "有证据支撑" : item.status === "modelled" ? "条件推演" : "证据不足"}</small><h3>{item.premise}</h3></div><span>{confidenceLabel[item.confidence]}置信度</span></div>
      <div className="counterfactual-path"><span>{item.baselineOutcome || "当前基线未知"}</span><ArrowRight size={17} /><strong>{item.changedCondition}</strong><ArrowRight size={17} /><span>{item.alternativeOutcome || "替代结果未知"}</span></div>
      {item.causalChain.length > 0 && <ol>{item.causalChain.map((step) => <li key={step}>{step}</li>)}</ol>}
      <dl><div><dt>成立假设</dt><dd>{item.assumptions.join("；") || "未列明"}</dd></div><div><dt>失效信号</dt><dd>{item.invalidationSignals.join("；") || "未列明"}</dd></div></dl>
      <footer><Scale size={15} /><EvidenceLinks ids={item.evidenceIds} research={research} /></footer>
    </article>) : <p className="research-comparison__empty">当前没有满足最低条件的反事实推演。</p>}</div>}
  </section>;
}
