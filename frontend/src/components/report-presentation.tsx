"use client";

import Link from "next/link";
import { ArrowRight, FileText, PanelTop, Quote } from "lucide-react";
import React, { useMemo, useState } from "react";
import type { ResearchBundle } from "@/lib/domain";
import { MarkdownReport } from "@/lib/markdown";
import { parseReportGraphs } from "@/lib/report-graph";
import { parseReportPresentation, selectSectionsForReadingMode, type ReportReadingMode, type ReportSection } from "@/lib/report-presentation";
import { ReportInlineGraphs } from "./report-inline-graphs";

export type ReportPresentationMode = "reader" | "preview" | "editor";

interface ReportPresentationProps {
  markdown: string;
  fallbackTitle: string;
  mode: ReportPresentationMode;
  reportHref?: string;
  relationHref?: string;
  research?: ResearchBundle;
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

const READING_OPTIONS: { id: ReportReadingMode; label: string }[] = [
  { id: "quick", label: "快速版" },
  { id: "standard", label: "标准版" },
  { id: "research", label: "完整研究版" },
];

export function ReportPresentation({ markdown, fallbackTitle, mode, reportHref, relationHref, research }: ReportPresentationProps) {
  const model = useMemo(() => parseReportPresentation(markdown, fallbackTitle), [fallbackTitle, markdown]);
  const diagramCount = useMemo(() => parseReportGraphs(markdown).diagrams.length, [markdown]);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [bodyOpen, setBodyOpen] = useState(mode !== "preview");
  const [readingMode, setReadingMode] = useState<ReportReadingMode>("standard");
  const readerSections = mode === "reader" ? selectSectionsForReadingMode(model.sections, readingMode) : model.sections;
  const visibleSections = mode === "preview" && !bodyOpen ? model.sections.slice(0, 1) : readerSections;
  const hiddenSectionCount = Math.max((mode === "preview" ? model.sections : readerSections).length - visibleSections.length, 0);

  return <div className={`report-presentation report-presentation--${mode}`}>
    <section className="report-brief" aria-label="报告摘要">
      <div className="report-brief__intro">
        <span className="eyebrow"><PanelTop size={14} />交付摘要</span>
        {mode !== "reader" && <h2>{model.title}</h2>}
      </div>
      <dl className="report-brief__metrics">
        <div><dt>正文</dt><dd>{model.sections.length} 节</dd></div>
        <div><dt>来源</dt><dd>{model.sourceCount || model.sourceBlocks.length} 条</dd></div>
        <div><dt>关系图</dt><dd>{diagramCount ? `${diagramCount} 张` : "未生成"}</dd></div>
      </dl>
      <div className="report-brief__judgement">
        <Quote size={18} aria-hidden="true" />
        <div><span>{model.summary.label}</span><p>{model.summary.text}</p>{model.summary.sectionId && <a href={`#${model.summary.sectionId}`}>定位原文 <ArrowRight size={14} /></a>}</div>
      </div>
    </section>

    {mode === "reader" && (
      <div className="report-reading-tabs" role="group" aria-label="阅读密度">
        <span>阅读密度</span>
        {READING_OPTIONS.map((item) => (
          <button key={item.id} type="button" aria-pressed={readingMode === item.id} onClick={() => setReadingMode(item.id)}>
            {item.label}
          </button>
        ))}
        <small>只改变本页展示密度；下载与下载报告保留全部正文。</small>
      </div>
    )}

    <div className="report-presentation__body">
      {visibleSections.length > 0 ? visibleSections.map((section, index) => <SectionBlock section={section} index={index} key={section.id} />) : <div className="report-presentation__empty"><FileText size={20} /><p>报告正文尚未生成。</p></div>}
      {mode === "preview" && hiddenSectionCount > 0 && <button className="report-presentation__toggle" type="button" onClick={() => setBodyOpen(true)} aria-label="展开完整正文">展开完整正文（其余 {hiddenSectionCount} 节）<ArrowRight size={15} /></button>}
    </div>

    {reportHref && mode === "preview" && <Link className="report-presentation__open" href={reportHref}>打开完整报告 <ArrowRight size={15} /></Link>}
    {mode === "reader" && <ReportInlineGraphs markdown={markdown} research={research} relationHref={relationHref} />}

    {model.sourceBlocks.length > 0 && <section className="report-sources">
      <button type="button" onClick={() => setSourcesOpen((open) => !open)} aria-expanded={sourcesOpen} aria-label={sourcesOpen ? "收起证据与来源" : "展开证据与来源"}>
        <span><FileText size={16} />证据与来源</span><small>{model.sourceCount || model.sourceBlocks.length} 条</small>
      </button>
      {sourcesOpen && <div className="report-sources__content">{model.sourceBlocks.map((block) => <section key={block.id}><h3>{block.title}</h3><MarkdownReport markdown={block.markdown} hideTitle /></section>)}</div>}
    </section>}
  </div>;
}