"use client";

import { ArrowRight, GitCompareArrows } from "lucide-react";
import React from "react";
import type { ResearchChangeSet } from "@/lib/domain";

function labelOf(value: Record<string, unknown>) {
  return String(value.label ?? value.text ?? value.title ?? value.id ?? "未命名变化");
}

export function ResearchChangesPanel({ changes, fromLabel, toLabel }: { changes?: ResearchChangeSet; fromLabel: string; toLabel: string }) {
  if (!changes || changes.status !== "ready") return null;
  const groups = [
    { title: "新增主体", values: changes.addedNodes },
    { title: "消失主体", values: changes.removedNodes },
    { title: "新增关系", values: changes.addedRelations },
    { title: "被移除关系", values: changes.removedRelations },
    { title: "变化关系", values: changes.changedRelations },
    { title: "新增判断", values: changes.addedClaims },
    { title: "被修正判断", values: changes.changedClaims },
    { title: "新增资料缺口", values: changes.newGaps },
    { title: "已补齐缺口", values: changes.resolvedGaps },
  ].filter((group) => group.values.length > 0);

  return <section className="research-changes-panel">
    <header><GitCompareArrows size={20} /><div><span className="eyebrow">语义版本变化</span><h2>{fromLabel} 到 {toLabel} 发生了什么</h2></div></header>
    {!changes.hasChanges ? <p>两个版本的研究账本没有发现结构性变化。</p> : <>
      {changes.summary.length > 0 && <div className="research-change-summary">{changes.summary.map((item) => <p key={item}>{item}</p>)}</div>}
      {changes.stanceChanges.length > 0 && <section><h3>立场变化</h3>{changes.stanceChanges.map((change) => <p key={`${change.nodeId}-${change.before}-${change.after}`}><strong>{change.label}：</strong>{change.before} <ArrowRight size={13} /> {change.after}</p>)}</section>}
      {changes.riskChange && <section><h3>风险变化</h3><p>{changes.riskChange.before} <ArrowRight size={13} /> {changes.riskChange.after}</p></section>}
      {groups.length > 0 && <div className="research-change-groups">{groups.map((group) => <section key={group.title}><h3>{group.title}</h3><span>{group.values.length} 项</span>{group.values.slice(0, 4).map((value, index) => <p key={`${group.title}-${index}`}>{labelOf(value)}</p>)}</section>)}</div>}
    </>}
  </section>;
}
