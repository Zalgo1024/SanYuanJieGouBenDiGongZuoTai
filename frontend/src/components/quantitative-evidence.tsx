"use client";

import { Calculator, Database } from "lucide-react";
import React from "react";
import type { QuantitativeObservation, ResearchBundle } from "@/lib/domain";

const riskStatusLabel: Partial<Record<QuantitativeObservation["status"], string>> = { conflicted: "来源冲突", unknown: "未知" };

export function QuantitativeEvidence({ research }: { research?: ResearchBundle }) {
  const observations = research?.quantitativeObservations ?? [];
  if (!research || !observations.length) return null;
  const sourceMap = new Map(research.sources.map((source) => [source.id, source]));
  return <section className="quantitative-evidence">
    <header><div><span className="eyebrow">定量信息</span><h2>数字、口径与来源</h2><p>仅展示有明确口径的数据；缺失或冲突会单独标记。</p></div><Calculator size={21} /></header>
    <div className="quantitative-table" role="table" aria-label="定量证据">
      <div className="quantitative-row quantitative-row--head" role="row"><span>指标</span><span>数值</span><span>口径与依据</span></div>
      {observations.map((item) => {
        const sources = item.evidenceIds.map((id) => sourceMap.get(id)).filter(Boolean);
        const riskLabel = riskStatusLabel[item.status];
        return <div className={`quantitative-row quantitative-row--${item.status}`} role="row" key={item.id}>
          <div>{riskLabel && <span className="quantitative-status">{riskLabel}</span>}<strong>{item.metricName}</strong><small>{item.scope || "范围未说明"}</small></div>
          <div className="quantitative-value"><strong>{item.value === null ? "未知" : `${item.value}${item.unit ? ` ${item.unit}` : ""}`}</strong><small>{item.observedAt || [item.periodStart, item.periodEnd].filter(Boolean).join(" 至 ") || "时间未知"}</small></div>
          <div><p>{item.methodology || "口径未说明"}</p>{item.formula && <code>{item.formula}</code>}{item.caveats.map((caveat) => <small key={caveat}>{caveat}</small>)}<div className="quantitative-sources"><Database size={13} />{sources.length ? sources.map((source) => source && <a href={source.url || undefined} target="_blank" rel="noreferrer" key={source.id}>{source.title}</a>) : <span>{item.id.startsWith("system_") ? "研究账本自动计算" : "无可核验来源"}</span>}</div></div>
        </div>;
      })}
    </div>
  </section>;
}
