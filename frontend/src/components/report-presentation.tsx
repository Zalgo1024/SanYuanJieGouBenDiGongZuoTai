"use client";

import Link from "next/link";
import { ArrowRight, FileText, Network, PanelTop, Quote } from "lucide-react";
import React, { useMemo, useState } from "react";
import { MarkdownReport } from "@/lib/markdown";
import { parseReportPresentation, type ReportSection } from "@/lib/report-presentation";

export type ReportPresentationMode = "reader" | "preview" | "editor";

interface ReportPresentationProps {
  markdown: string;
  fallbackTitle: string;
  mode: ReportPresentationMode;
  reportHref?: string;
  relationHref?: string;
}

function SectionBlock({ section, index }: { section: ReportSection; index: number }) {
  return <section id={section.id} className="report-section-block">
    <header>
      <span>{String(index + 1).padStart(2, "0")}</span>
      <h2>{section.heading}</h2>
    </header>
    <MarkdownReport markdown={section.markdown} hideTitle />
  </section>;
}

export function ReportPresentation({ markdown, fallbackTitle, mode, reportHref, relationHref }: ReportPresentationProps) {
  const model = useMemo(() => parseReportPresentation(markdown, fallbackTitle), [fallbackTitle, markdown]);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [bodyOpen, setBodyOpen] = useState(mode !== "preview");
  const visibleSections = mode === "preview" && !bodyOpen ? model.sections.slice(0, 1) : model.sections;
  const hiddenSectionCount = Math.max(model.sections.length - visibleSections.length, 0);

  return <div className={`report-presentation report-presentation--${mode}`}>
    <section className="report-brief" aria-label="报告摘要">
      <div className="report-brief__intro">
        <span className="eyebrow"><PanelTop size={14} />交付摘要</span>
        {mode !== "reader" && <h2>{model.title}</h2>}
      </div>
      <div className="report-brief__judgement">
        <Quote size={18} aria-hidden="true" />
        <div><span>{model.summary.label}</span><p>{model.summary.text}</p>{model.summary.sectionId && <a href={`#${model.summary.sectionId}`}>定位原文 <ArrowRight size={14} /></a>}</div>
      </div>
      <dl className="report-brief__metrics">
        <div><dt>正文</dt><dd>{model.sections.length} 节</dd></div>
        <div><dt>来源</dt><dd>{model.sourceCount || model.sourceBlocks.length} 条</dd></div>
        <div><dt>关系图</dt><dd>{model.hasDiagram ? "已生成" : "未生成"}</dd></div>
      </dl>
    </section>

    <div className="report-presentation__body">
      {visibleSections.length > 0 ? visibleSections.map((section, index) => <SectionBlock section={section} index={index} key={section.id} />) : <div className="report-presentation__empty"><FileText size={20} /><p>报告正文尚未生成。</p></div>}
      {mode === "preview" && hiddenSectionCount > 0 && <button className="report-presentation__toggle" type="button" onClick={() => setBodyOpen(true)} aria-label="展开完整正文">展开完整正文（其余 {hiddenSectionCount} 节）<ArrowRight size={15} /></button>}
    </div>

    {reportHref && mode === "preview" && <Link className="report-presentation__open" href={reportHref}>打开完整报告 <ArrowRight size={15} /></Link>}
    {relationHref && mode === "reader" && model.hasDiagram && <Link className="report-presentation__network" href={relationHref}><Network size={18} /><span>本报告包含关系图与结构图</span><ArrowRight size={15} /></Link>}

    {model.sourceBlocks.length > 0 && <section className="report-sources">
      <button type="button" onClick={() => setSourcesOpen((open) => !open)} aria-expanded={sourcesOpen} aria-label={sourcesOpen ? "收起证据与来源" : "展开证据与来源"}>
        <span><FileText size={16} />证据与来源</span><small>{model.sourceCount || model.sourceBlocks.length} 条</small>
      </button>
      {sourcesOpen && <div className="report-sources__content">{model.sourceBlocks.map((block) => <section key={block.id}><h3>{block.title}</h3><MarkdownReport markdown={block.markdown} hideTitle /></section>)}</div>}
    </section>}
  </div>;
}
