"use client";

import { Clock3, Milestone } from "lucide-react";
import React from "react";
import type { ResearchBundle } from "@/lib/domain";

function timeLabel(value?: string) {
  if (!value) return "时间待确认";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "numeric" }).format(date);
}

export function ResearchTimeline({ research }: { research?: ResearchBundle }) {
  const events = [...(research?.timeline ?? [])].sort((left, right) => String(left.date ?? "").localeCompare(String(right.date ?? "")));
  const stanceChanges = (research?.nodes ?? []).flatMap((node) => {
    const history = node.stanceHistory ?? [];
    return history.slice(1).map((point, index) => ({ id: `${node.id}-${point.at}-${index}`, label: node.label, at: point.at, before: history[index]?.stance ?? "立场未知", after: point.stance }));
  });
  if (!events.length && !stanceChanges.length) return null;

  return <section className="research-timeline">
    <header><div><span className="eyebrow">时间维度</span><h2>事件与立场变化</h2></div><Clock3 size={20} /></header>
    {events.length > 0 && <div className="research-timeline__events">{events.map((event) => <article className={event.turningPoint ? "research-time-event research-time-event--turning" : "research-time-event"} key={event.id}><time>{timeLabel(event.date)}</time><div>{event.turningPoint && <span className="research-turning-point"><Milestone size={14} />关键转折点</span>}<strong>{event.title}</strong><p>{event.detail}</p><small>{event.eventType} · {event.confidence === "high" ? "高" : event.confidence === "medium" ? "中" : "低"}置信度</small></div></article>)}</div>}
    {stanceChanges.length > 0 && <div className="research-stance-history"><h3>主体立场变化</h3>{stanceChanges.map((change) => <div key={change.id}><time>{timeLabel(change.at)}</time><strong>{change.label}</strong><span>{change.before} → {change.after}</span></div>)}</div>}
  </section>;
}
