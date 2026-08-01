"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, Save } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { apiRequest } from "@/lib/api";
import { reportTitleFromMarkdown } from "@/lib/server-report";

export function ReportEditor({ reportId }: { reportId: string }) {
  const router = useRouter();
  const { state, hydrated, loadReport } = useAppStore();
  const report = state.reports.find((item) => item.id === reportId);
  const [markdown, setMarkdown] = useState(report?.markdown ?? "");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (report) setMarkdown(report.markdown);
  }, [report]);

  if (!report) {
    return hydrated ? <section className="empty-state"><span className="eyebrow">未找到报告</span><h1>无法编辑这个报告</h1><p>报告可能尚未生成，或者已从当前项目中移除。</p><Link className="primary-button" href="/reports">返回报告列表</Link></section> : <section className="editor-page" aria-busy="true" />;
  }

  const previewTitle = markdown.split("\n").find((line) => line.startsWith("# "))?.replace("# ", "") || "未命名报告";
  async function save() {
    if (!report) return;
    setSaveError("");
    setSaving(true);
    try {
      // 分析skill 后端：保存一次人工修订版（kind=revised），无需 codex 的 PATCH /v1/reports。
      await apiRequest(`/api/reports/${reportId}/versions`, {
        method: "POST",
        body: JSON.stringify({
          content_markdown: markdown,
          note: reportTitleFromMarkdown(markdown, report.title),
        }),
      });
      const synced = await loadReport(reportId);
      if (!synced) throw new Error("新版本已保存，但未能从后端读取当前版本。请保持本页并重新连接后再试。");
      router.push(`/reports/${reportId}`);
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : "报告保存失败，请稍后重试。");
    } finally {
      setSaving(false);
    }
  }

  return <section className="editor-page">
    {saveError && <p className="form-error" role="alert">{saveError}</p>}
    <header className="editor-page__top"><div><Link href={`/reports/${reportId}`} className="text-action"><ArrowLeft size={15} />返回阅读器</Link><span className="eyebrow">报告修订 / Markdown</span><h1>编辑分析版本</h1></div><div><span className="editor-version">基于 v{report.version}</span><button className="primary-button" type="button" onClick={save} disabled={saving}><Save size={16} />{saving ? "保存中" : "保存为新版本"}</button></div></header>
    <div className="editor-split"><section className="editor-source"><label htmlFor="report-markdown">报告 Markdown 源码</label><textarea id="report-markdown" aria-label="报告 Markdown 源码" value={markdown} onChange={(event) => setMarkdown(event.target.value)} spellCheck={false} /></section><article className="editor-preview"><span className="eyebrow"><Eye size={14} />预览</span><h2>{previewTitle}</h2>{markdown.split("\n").filter((line) => !line.startsWith("#")).filter(Boolean).map((line, index) => <p key={`${index}-${line}`}>{line.replace(/^[-*] /, "").replace(/\*\*/g, "")}</p>)}</article></div>
  </section>;
}
