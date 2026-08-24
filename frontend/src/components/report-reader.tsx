"use client";

import Link from "next/link";
import { ArrowRight, Download, FilePlus2, FileText, History, MessageSquarePlus, Network, RotateCcw, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { analysisTypes, type AnalysisTask, type Report, type ResearchBundle, type ResearchChangeSet, type ResearchSnapshotStatus } from "@/lib/domain";
import { parseReportPresentation, selectSectionsForReadingMode, type ReportReadingMode } from "@/lib/report-presentation";
import { downloadReportArtifact, fetchReportVersion, rollbackReportVersion, type ReportArtifactKind } from "@/lib/report-delivery";
import { fetchReportChanges } from "@/lib/research-changes";
import { parseReportGraphs } from "@/lib/report-graph";
import { ReportPresentation } from "./report-presentation";
import { ReportOutline } from "./report-outline";
import { ResearchChangesPanel } from "./research-changes-panel";
import { ResearchLedger } from "./research-ledger";
import { ResearchTimeline } from "./research-timeline";
import { ResearchComparison } from "./research-comparison";
import { QuantitativeEvidence } from "./quantitative-evidence";
import { ResearchBenchmark } from "./research-benchmark";
import { ReportEnrichmentLauncher } from "./report-enrichment-launcher";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function typeLabel(type: string) {
  return analysisTypes.find((item) => item.id === type)?.label ?? "结构分析";
}

function safeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || "分析报告";
}

function downloadMarkdown(title: string, markdown: string, version: number) {
  const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeFilename(title)}-v${version}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ReportConversationLauncher({ report }: { report: Report }) {
  const [open, setOpen] = useState(false);
  const [purpose, setPurpose] = useState("continue");
  const purposes = [
    { id: "continue", label: "继续分析", detail: "围绕报告中的关键矛盾继续推进研判。" },
    { id: "evidence", label: "补充证据", detail: "为现有结论补充可复核的材料与出处。" },
    { id: "review", label: "审阅结论", detail: "检查推断边界、反例与仍待验证的问题。" },
    { id: "rewrite", label: "重组表达", detail: "在保留证据边界的前提下重写报告表达。" },
  ];
  const selected = purposes.find((item) => item.id === purpose) ?? purposes[0];
  return <><button className="secondary-button report-new-conversation" type="button" onClick={() => setOpen(true)}><MessageSquarePlus size={16} />新建对话</button>{open && <div className="report-conversation-backdrop" role="presentation" onMouseDown={() => setOpen(false)}><section className="report-conversation-dialog" role="dialog" aria-modal="true" aria-labelledby="report-conversation-title" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="eyebrow">关联报告</span><h2 id="report-conversation-title">从报告继续一段新对话</h2></div><button className="table-icon" type="button" onClick={() => setOpen(false)} aria-label="关闭新建对话"><X size={18} /></button></header><p>新对话会预先带入当前报告的上下文，不会改写现有版本。</p><label><span>对话用途</span><select aria-label="对话用途" value={purpose} onChange={(event) => setPurpose(event.target.value)}>{purposes.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label><div className="report-conversation-choice"><strong>{selected.label}</strong><span>{selected.detail}</span></div><footer><button className="secondary-button" type="button" onClick={() => setOpen(false)}>取消</button><Link className="primary-button" href={`/analysis?reportId=${report.id}&purpose=${purpose}`} onClick={() => setOpen(false)}>进入新对话 <ArrowRight size={16} /></Link></footer></section></div>}</>;
}

export function ReportReader({ report, task, onReload }: { report: Report; task?: AnalysisTask; onReload: () => Promise<Report | null> }) {
  const versions = report.versions?.length ? report.versions : [{
    id: report.currentVersionId || "current",
    version: report.version,
    kind: "original",
    editedBy: "ai",
    summary: "当前版本",
    note: "",
    editor: "",
    createdAt: report.updatedAt,
    isCurrent: true,
  }];
  const currentVersionId = report.currentVersionId || versions.find((item) => item.isCurrent)?.id || versions.at(-1)?.id || "";
  const [selectedVersionId, setSelectedVersionId] = useState(currentVersionId);
  const [historicalMarkdown, setHistoricalMarkdown] = useState("");
  const [historicalResearch, setHistoricalResearch] = useState<ResearchBundle | undefined>();
  const [historicalResearchStatus, setHistoricalResearchStatus] = useState<ResearchSnapshotStatus>("unavailable");
  const [loadingVersion, setLoadingVersion] = useState(false);
  const [versionError, setVersionError] = useState("");
  const [confirmRollback, setConfirmRollback] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [rollbackNotice, setRollbackNotice] = useState("");
  const [downloading, setDownloading] = useState<ReportArtifactKind | "">("");
  const [downloadError, setDownloadError] = useState("");
  const [readingMode, setReadingMode] = useState<ReportReadingMode>("standard");
  const [researchChanges, setResearchChanges] = useState<ResearchChangeSet | undefined>();
  const [changesError, setChangesError] = useState("");
  const [enrichmentOpen, setEnrichmentOpen] = useState(false);
  const requestSequence = useRef(0);

  useEffect(() => {
    setSelectedVersionId(currentVersionId);
    setHistoricalMarkdown("");
    setHistoricalResearch(undefined);
    setHistoricalResearchStatus("unavailable");
    setConfirmRollback(false);
    setResearchChanges(undefined);
    setChangesError("");
  }, [currentVersionId, report.markdown]);

  const selectedVersion = versions.find((item) => item.id === selectedVersionId) ?? versions.find((item) => item.id === currentVersionId) ?? versions[versions.length - 1];
  const isCurrent = selectedVersionId === currentVersionId;
  const markdown = isCurrent ? report.markdown : historicalMarkdown;
  const renderedMarkdown = markdown || report.markdown;
  const renderedResearch = isCurrent ? report.research : historicalResearch;
  const renderedResearchStatus = isCurrent ? (report.researchStatus ?? "unavailable") : historicalResearchStatus;
  const presentation = parseReportPresentation(renderedMarkdown, report.title);
  const outline = selectSectionsForReadingMode(presentation.sections, readingMode).map((section) => ({ id: section.id, label: section.heading }));
  if (parseReportGraphs(renderedMarkdown).diagrams.length) outline.push({ id: "report-inline-graphs", label: "关系图谱" });

  async function selectVersion(versionId: string) {
    const sequence = ++requestSequence.current;
    setVersionError("");
    setRollbackNotice("");
    setConfirmRollback(false);
    setSelectedVersionId(versionId);
    setHistoricalMarkdown("");
    setHistoricalResearch(undefined);
    setHistoricalResearchStatus("unavailable");
    setResearchChanges(undefined);
    setChangesError("");
    if (versionId === currentVersionId) {
      setHistoricalMarkdown("");
      setLoadingVersion(false);
      return;
    }
    setLoadingVersion(true);
    try {
      const version = await fetchReportVersion(report.taskId, versionId);
      if (sequence === requestSequence.current) {
        setHistoricalMarkdown(version.markdown);
        setHistoricalResearch(version.research);
        setHistoricalResearchStatus(version.researchStatus);
      }
      try {
        const comparison = await fetchReportChanges(report.taskId, versionId, currentVersionId);
        if (sequence === requestSequence.current) setResearchChanges(comparison.changes);
      } catch (reason) {
        if (sequence === requestSequence.current) setChangesError(reason instanceof Error ? reason.message : "版本变化暂时无法读取。");
      }
    } catch (reason) {
      if (sequence === requestSequence.current) {
        setSelectedVersionId(currentVersionId);
        setVersionError(reason instanceof Error ? reason.message : "历史版本读取失败。");
      }
    } finally {
      if (sequence === requestSequence.current) setLoadingVersion(false);
    }
  }

  async function rollback() {
    if (isCurrent) return;
    setRollingBack(true);
    setVersionError("");
    try {
      const result = await rollbackReportVersion(selectedVersionId);
      const synced = await onReload();
      if (!synced) throw new Error("回滚已提交，但无法读取新的当前版本。请重新连接后刷新页面。");
      setSelectedVersionId(synced.currentVersionId || result.currentVersionId);
      setHistoricalMarkdown("");
      setConfirmRollback(false);
      setRollbackNotice(result.warning ? `版本已回滚；${result.warning}` : `已将 v${result.version} 设为当前版本。`);
    } catch (reason) {
      setVersionError(reason instanceof Error ? reason.message : "版本回滚失败。");
    } finally {
      setRollingBack(false);
    }
  }

  async function download(kind: ReportArtifactKind) {
    setDownloading(kind);
    setDownloadError("");
    try {
      await downloadReportArtifact(report.taskId, kind, selectedVersionId);
    } catch (reason) {
      setDownloadError(reason instanceof Error ? reason.message : "报告下载失败。");
    } finally {
      setDownloading("");
    }
  }

  return <section className="report-reader">
    <header className="report-reader__top"><div><span className="eyebrow">报告 / {typeLabel(report.type)} / v{selectedVersion?.version ?? report.version}</span><h1>{report.title}</h1><p>{task ? `来自“${task.title}”，关联 ${task.materialIds.length} 份材料，可继续审阅和修订。` : "后端结构化报告版本。"}</p></div><div><button className="secondary-button" type="button" onClick={() => setEnrichmentOpen(true)}><FilePlus2 size={16} />补充信息与证据</button><ReportConversationLauncher report={report} /><Link href={`/reports/${report.id}/edit`} className="secondary-button">编辑版本</Link><Link href={`/interest-analysis/${report.id}`} className="primary-button"><Network size={16} />关系图谱</Link></div></header>
    {enrichmentOpen && <ReportEnrichmentLauncher reportId={report.taskId} reportTitle={report.title} onComplete={onReload} open={enrichmentOpen} onOpenChange={setEnrichmentOpen} showTrigger={false} />}
    {!isCurrent && !loadingVersion && historicalMarkdown && <div className="historical-version-banner"><History size={17} /><div><strong>正在查看历史版本 v{selectedVersion?.version}</strong><span>这是只读预览，不会改变当前报告。</span></div><button type="button" onClick={() => void selectVersion(currentVersionId)}>返回当前版本</button></div>}
    {rollbackNotice && <p className="delivery-notice" role="status">{rollbackNotice}</p>}
    <div className="report-reader__toolbar">
      <div className="report-reading-modes" role="group" aria-label="报告阅读模式"><span>阅读密度</span>{(["quick", "standard", "research"] as const).map((item) => <button type="button" key={item} aria-label={item === "quick" ? "快速版" : item === "standard" ? "标准版" : "完整研究版"} aria-pressed={readingMode === item} onClick={() => setReadingMode(item)}>{item === "quick" ? "快速版" : item === "standard" ? "标准版" : "完整研究版"}</button>)}</div>
      <section className="report-download-toolbar" aria-label="报告下载">
        <span>下载当前正在查看的 v{selectedVersion?.version ?? report.version}。</span>
        <div className="download-actions"><button type="button" onClick={() => void download("word")} disabled={Boolean(downloading)} aria-label="下载 Word"><Download size={15} />{downloading === "word" ? "Word 生成中" : "Word"}</button><button type="button" onClick={() => void download("pdf")} disabled={Boolean(downloading)} aria-label="下载 PDF"><Download size={15} />{downloading === "pdf" ? "PDF 生成中" : "PDF"}</button><button type="button" onClick={() => downloadMarkdown(report.title, markdown, selectedVersion?.version ?? report.version)} disabled={loadingVersion || (!isCurrent && !historicalMarkdown)} aria-label="下载 Markdown"><FileText size={15} />Markdown</button></div>
      </section>
    </div>
    {downloadError && <p className="delivery-error report-download-error" role="alert">{downloadError}</p>}
    {!loadingVersion && <ResearchLedger research={renderedResearch} status={renderedResearchStatus} onEnrich={() => setEnrichmentOpen(true)} />}
    {!loadingVersion && <ResearchTimeline research={renderedResearch} />}
    {!loadingVersion && <ResearchComparison research={renderedResearch} />}
    {!loadingVersion && <QuantitativeEvidence research={renderedResearch} />}
    {!loadingVersion && <ResearchBenchmark taskId={report.taskId} versionId={selectedVersionId} />}
    {!isCurrent && !loadingVersion && <ResearchChangesPanel changes={researchChanges} fromLabel={`v${selectedVersion?.version ?? "?"}`} toLabel={`v${versions.find((item) => item.id === currentVersionId)?.version ?? report.version}`} />}
    {changesError && <p className="delivery-error" role="status">版本正文可阅读，但语义变化对比失败：{changesError}</p>}
    <div className="report-reader__layout">
      <ReportOutline sections={outline} />
      <div className="report-document">{loadingVersion ? <div className="report-version-loading" aria-busy="true">正在读取历史版本...</div> : <ReportPresentation markdown={renderedMarkdown} fallbackTitle={report.title} mode="reader" readingMode={readingMode} relationHref={`/interest-analysis/${report.id}`} research={renderedResearch} />}</div>
      <aside className="report-delivery-panel">
        <section><span className="eyebrow">版本记录</span><div className="version-list">{[...versions].sort((left, right) => right.version - left.version).map((version) => <button type="button" className={version.id === selectedVersionId ? "version-item version-item--active" : "version-item"} key={version.id} onClick={() => void selectVersion(version.id)} aria-label={`预览 v${version.version}${version.isCurrent ? "（当前版本）" : ""}`} aria-pressed={version.id === selectedVersionId}><span><strong>v{version.version}</strong>{version.isCurrent && <i>当前</i>}</span><small>{version.summary || (version.kind === "original" ? "初始生成" : version.kind === "revised" ? "人工修订" : version.kind === "enriched" ? "证据补充" : "类型未知")}</small><time>{formatDate(version.createdAt)}</time></button>)}</div></section>
        {!isCurrent && historicalMarkdown && <section className="rollback-panel"><span className="eyebrow">版本操作</span>{confirmRollback ? <div className="rollback-confirm"><strong>回滚会把 v{selectedVersion?.version} 设为新的当前版本</strong><p>现有版本不会删除，关系图与下载将随当前版本刷新。</p><div><button className="secondary-button" type="button" onClick={() => setConfirmRollback(false)} disabled={rollingBack}>取消</button><button className="danger-button" type="button" onClick={() => void rollback()} disabled={rollingBack} aria-label={`确认回滚到 v${selectedVersion?.version}`}>{rollingBack ? "回滚中" : "确认回滚"}</button></div></div> : <button className="secondary-button rollback-trigger" type="button" onClick={() => setConfirmRollback(true)}><RotateCcw size={15} />回滚到此版本</button>}</section>}
        {versionError && <p className="delivery-error" role="alert">{versionError}</p>}
        {task && <Link href={`/analysis/${task.id}`} className="text-action">返回分析任务 <ArrowRight size={15} /></Link>}
      </aside>
    </div>
  </section>;
}
