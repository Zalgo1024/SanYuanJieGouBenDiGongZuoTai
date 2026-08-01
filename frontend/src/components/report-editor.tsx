"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, Save } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { apiRequest } from "@/lib/api";
import { MarkdownReport } from "@/lib/markdown";

export function ReportEditor({ reportId }: { reportId: string }) {
  const router = useRouter();
  const { state, hydrated, loadReport } = useAppStore();
  const report = state.reports.find((item) => item.id === reportId);
  const [markdown, setMarkdown] = useState(report?.markdown ?? "");
  const [note, setNote] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingHref, setPendingHref] = useState("");

  useEffect(() => {
    if (report) {
      setMarkdown(report.markdown);
      setNote("");
    }
  }, [report]);

  const dirty = Boolean(report && (markdown !== report.markdown || note.trim()));

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const protectInternalNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      event.preventDefault();
      setPendingHref(`${url.pathname}${url.search}${url.hash}`);
    };
    document.addEventListener("click", protectInternalNavigation, true);
    return () => document.removeEventListener("click", protectInternalNavigation, true);
  }, [dirty]);

  if (!report) {
    return hydrated ? <section className="empty-state"><span className="eyebrow">未找到报告</span><h1>无法编辑这个报告</h1><p>报告可能尚未生成，或者已从当前项目中移除。</p><Link className="primary-button" href="/reports">返回报告列表</Link></section> : <section className="editor-page" aria-busy="true" />;
  }

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
          note: note.trim() || "手动修订",
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
    <header className="editor-page__top"><div><Link href={`/reports/${reportId}`} className="text-action"><ArrowLeft size={15} />返回阅读器</Link><span className="eyebrow">报告修订 / Markdown</span><h1>编辑分析版本</h1></div><div><span className={dirty ? "editor-version editor-version--dirty" : "editor-version"}>{dirty ? "有未保存更改" : "所有更改已保存"} · 基于 v{report.version}</span><button className="primary-button" type="button" onClick={save} disabled={saving || !dirty}><Save size={16} />{saving ? "保存中" : "保存为新版本"}</button></div></header>
    <div className="editor-split"><section className="editor-source"><div className="editor-source__label"><label htmlFor="report-markdown">报告 Markdown 源码</label><span>{markdown.length.toLocaleString("zh-CN")} 字符</span></div><label className="editor-note" htmlFor="report-version-note"><span>版本备注</span><input id="report-version-note" aria-label="版本备注" value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：补充证据边界与来源" maxLength={120} /></label><textarea id="report-markdown" aria-label="报告 Markdown 源码" value={markdown} onChange={(event) => setMarkdown(event.target.value)} spellCheck={false} /></section><section className="editor-preview"><span className="eyebrow"><Eye size={14} />实时预览</span><MarkdownReport markdown={markdown} /></section></div>
    {pendingHref && <div className="report-conversation-backdrop" role="presentation"><section className="report-conversation-dialog" role="dialog" aria-modal="true" aria-labelledby="editor-leave-title"><header><div><span className="eyebrow">未保存更改</span><h2 id="editor-leave-title">确定离开编辑器吗？</h2></div></header><p>当前 Markdown 或版本备注尚未保存，离开后这些更改会丢失。</p><footer><button className="secondary-button" type="button" onClick={() => setPendingHref("")}>继续编辑</button><button className="danger-button" type="button" onClick={() => router.push(pendingHref)}>放弃更改并离开</button></footer></section></div>}
  </section>;
}
