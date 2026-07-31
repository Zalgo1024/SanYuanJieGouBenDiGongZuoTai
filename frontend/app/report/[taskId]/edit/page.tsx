"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AppShell from "@/components/layout/AppShell";
import ReportEditor from "@/components/ReportEditor";
import RulesPanel from "@/components/RulesPanel";
import VersionTimeline from "@/components/VersionTimeline";
import { useTasks } from "@/lib/hooks";
import {
  getReportVersions,
  getReportVersion,
  saveReportVersion,
  reviseReport,
  rollbackVersion,
  downloadUrl,
  downloadVersion,
  type ReportVersionMeta,
} from "@/lib/api";

export default function ReportEditPage() {
  const params = useParams();
  const taskId = typeof params.taskId === "string" ? params.taskId : null;
  const router = useRouter();
  const qc = useQueryClient();

  const { data: tasks } = useTasks({ limit: 100 });
  const list = tasks ?? [];

  const [markdown, setMarkdown] = useState("");
  const [loadedVid, setLoadedVid] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [dirty, setDirty] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [pdfNote, setPdfNote] = useState<string | null>(null);
  const [analysisType, setAnalysisType] = useState("case");
  // T13：AI 再改 / 回滚状态
  const [instruction, setInstruction] = useState("");
  const [revising, setRevising] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [reviseError, setReviseError] = useState("");
  const [rollbackError, setRollbackError] = useState("");

  // 版本列表（首次访问后端自动播种 original）
  const versionsQ = useQuery({
    queryKey: ["report-versions", taskId],
    queryFn: () => getReportVersions(taskId as string),
    enabled: !!taskId,
  });

  // 首次进入：自动加载「当前版本」（最新修订或原始）
  useEffect(() => {
    if (versionsQ.data && !loadedVid) {
      setLoadedVid(versionsQ.data.current_version_id);
    }
  }, [versionsQ.data, loadedVid]);

  // 当前任务的 analysis_type（铁律面板用）
  useEffect(() => {
    const t = list.find((x) => x.task_id === taskId);
    if (t?.analysis_type) setAnalysisType(t.analysis_type);
  }, [list, taskId]);

  // 当前选中版本的正文
  const contentQ = useQuery({
    queryKey: ["report-version", taskId, loadedVid],
    queryFn: () => getReportVersion(taskId as string, loadedVid as string),
    enabled: !!taskId && !!loadedVid,
  });

  useEffect(() => {
    if (contentQ.data) {
      setMarkdown(contentQ.data.content_markdown);
      setDirty(false);
    }
  }, [contentQ.data]);

  const saveMut = useMutation({
    mutationFn: () =>
      saveReportVersion(taskId as string, {
        content_markdown: markdown,
        note: note.trim() || undefined,
      }),
    onSuccess: (v: ReportVersionMeta) => {
      qc.invalidateQueries({ queryKey: ["report-versions", taskId] });
      setLoadedVid(v.id);
      setDirty(false);
      setNote("");
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    },
  });

  // T13：AI 再改（基于当前版本全文 + 指令）
  const handleRevise = async () => {
    if (!instruction.trim() || revising) return;
    setRevising(true);
    setReviseError("");
    try {
      const v = await reviseReport(taskId as string, { instruction: instruction.trim() });
      qc.invalidateQueries({ queryKey: ["report-versions", taskId] });
      setLoadedVid(v.id);
      setInstruction("");
      setDirty(false);
    } catch (e) {
      setReviseError(e instanceof Error ? e.message : "AI 再改失败");
    } finally {
      setRevising(false);
    }
  };

  // T13：回滚到指定版本（切换 is_current 并重渲）
  const handleRollback = async (vid: string) => {
    if (rollingBack) return;
    if (!window.confirm("回滚到该版本？历史版本不删除。")) return;
    setRollingBack(true);
    setRollbackError("");
    try {
      await rollbackVersion(vid);
      qc.invalidateQueries({ queryKey: ["report-versions", taskId] });
      setLoadedVid(vid);
      setDirty(false);
    } catch (e) {
      setRollbackError(e instanceof Error ? e.message : "回滚失败");
    } finally {
      setRollingBack(false);
    }
  };

  const versions = versionsQ.data?.versions ?? [];
  const current = list.find((t) => t.task_id === taskId) ?? null;
  const loadedMeta = versions.find((v) => v.id === loadedVid) ?? null;

  const versionLabel = (v: ReportVersionMeta | null) => {
    if (!v) return "—";
    const who = v.edited_by === "ai" ? "AI" : "人";
    return `v${v.version_no ?? 1} · ${who}${v.summary ? ` · ${v.summary}` : ""}`;
  };

  const handlePdf = async () => {
    setPdfNote(null);
    const r = await downloadVersion(taskId ?? "", "pdf", loadedVid ?? undefined);
    if (!r.ok) {
      setPdfNote(
        r.error === "pdf_unavailable"
          ? "PDF 待配置：本机未安装 LibreOffice 等转换引擎，可先下载 Word 版。"
          : "PDF 下载失败，请稍后重试。"
      );
    }
  };

  return (
    <AppShell title="报告编辑器">
      <div className="h-full flex gap-4">
        {/* 左：报告库（导航头 + 计数徽标 + 44px 行 + 选中蓝底） */}
        <div className="w-[240px] shrink-0 card flex flex-col overflow-hidden">
          <div className="h-12 flex items-center gap-2 px-4 bg-inputbg border-b border-cardborder">
            <span className="text-[13px] font-semibold text-ink">报告库</span>
            <span className="text-[11px] px-1.5 py-0.5 rounded-pill bg-[#F0F4FA] text-navy">
              {list.length}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 overflow-y-auto p-2">
            {list.length === 0 && (
              <div className="px-2 py-3 text-[12px] text-muted">暂无报告</div>
            )}
            {list.map((t) => {
              const active = t.task_id === taskId;
              return (
                <button
                  key={t.task_id}
                  onClick={() => router.push(`/report/${t.task_id}/edit`)}
                  className={`h-11 flex items-center gap-2 px-3 rounded-md text-[13px] truncate ${
                    active
                      ? "bg-[#F0F4FA] text-navy font-medium"
                      : "text-sub hover:bg-[#F3F4F6]"
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      background:
                        t.status === "done"
                          ? "#27AE60"
                          : t.status === "error"
                          ? "#E74C3C"
                          : "#F49C12",
                    }}
                  />
                  <span className="truncate">{t.title}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-auto p-2 border-t border-cardborder">
            <Link
              href={taskId ? `/report/${taskId}` : "/report"}
              className="h-9 w-full rounded-md text-[13px] text-navy bg-[#F0F4FA] hover:bg-[#E4ECF6] flex items-center justify-center"
            >
              返回查看
            </Link>
          </div>
        </div>

        {/* 中：编辑器（真实 Markdown 源码 + 预览） */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="h-12 flex items-center justify-between px-1 mb-2">
            <span className="text-[14px] font-semibold text-ink truncate">
              {current?.title ?? "报告编辑"}
            </span>
            <span className="text-[12px] text-muted shrink-0">
              当前：{versionLabel(loadedMeta)}
              {dirty && <span className="text-[#E67E22]"> · 未保存</span>}
            </span>
          </div>
          <ReportEditor
            value={markdown}
            onChange={(md) => {
              setMarkdown(md);
              setDirty(true);
            }}
          />
        </div>

        {/* 右：版本时间线 + AI 再改 + 铁律自检 + 下载（辅助面板风格） */}
        <div className="w-[300px] shrink-0 flex flex-col gap-4 overflow-y-auto">
          <div className="card overflow-hidden">
            <div className="h-12 flex items-center px-4 bg-inputbg border-b border-cardborder">
              <span className="text-[13px] font-semibold text-ink">
                版本时间线（{versions.length}）
              </span>
            </div>
            <div className="p-3">
              <VersionTimeline
                versions={versions}
                currentId={versionsQ.data?.current_version_id ?? null}
                onSelect={(vid) => setLoadedVid(vid)}
                onRollback={handleRollback}
                rollingBack={rollingBack}
              />
            </div>
            {rollbackError && (
              <div className="px-3 pb-3 text-[11px] text-[#C62828]">⚠ {rollbackError}</div>
            )}
          </div>

          {/* T13：手动改保存（edited_by=human） */}
          <div className="card p-4 flex flex-col gap-2">
            <div className="text-[13px] font-semibold text-ink">保存修订</div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="修订说明（可选）"
              className="h-9 rounded-input bg-inputbg border border-cardborder px-3 text-[12px] text-ink outline-none focus:border-navy"
            />
            <button
              onClick={() => saveMut.mutate()}
              disabled={!dirty || saveMut.isPending}
              className="h-9 rounded-md text-[13px] font-medium text-white bg-navy hover:bg-navy/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saveMut.isPending ? "保存中…" : "保存为人工修订版"}
            </button>
            {savedFlash && (
              <div className="text-[12px] text-[#27AE60]">已保存修订版 ✓</div>
            )}
            {!dirty && (
              <div className="text-[12px] text-muted">改动后此处可保存新版本</div>
            )}
          </div>

          {/* T13：AI 再改（与展览页同语义） */}
          <div className="card p-4 flex flex-col gap-2">
            <div className="text-[13px] font-semibold text-ink">AI 再改</div>
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRevise()}
              placeholder="如：把第三章改写得更尖锐"
              className="h-9 rounded-input bg-inputbg border border-cardborder px-3 text-[12px] text-ink outline-none focus:border-navy"
            />
            <button
              onClick={handleRevise}
              disabled={revising || !instruction.trim()}
              className="h-9 rounded-md text-[13px] font-medium text-white bg-[#E74C3C] hover:bg-[#D62C1A] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {revising ? "再改中…" : "确认 AI 再改"}
            </button>
            {reviseError && (
              <div className="text-[11px] text-[#C62828]">⚠ {reviseError}</div>
            )}
          </div>

          {/* T9：铁律自检面板（机检当前编辑器内容） */}
          <RulesPanel markdown={markdown} analysisType={analysisType} />

          <div className="card p-4 flex flex-col gap-2">
            <div className="text-[13px] font-semibold text-ink">下载当前版本</div>
            <a
              href={downloadUrl(taskId ?? "", "word", loadedVid ?? undefined)}
              className="btn-primary h-9 text-[13px] flex items-center justify-center"
            >
              下载 Word
            </a>
            <button
              onClick={handlePdf}
              className="h-9 rounded-md text-[13px] font-medium text-navy bg-[#F0F4FA] hover:bg-[#E4ECF6] border border-cardborder"
            >
              下载 PDF
            </button>
            {pdfNote && (
              <div className="text-[11px] text-muted leading-relaxed">{pdfNote}</div>
            )}
            {!pdfNote && (
              <div className="text-[11px] text-muted leading-relaxed">
                原始生成版与人工修订版均可单独导出。PDF 需本机安装 LibreOffice。
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
