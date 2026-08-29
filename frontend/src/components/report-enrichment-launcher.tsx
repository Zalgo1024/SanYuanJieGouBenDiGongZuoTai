"use client";

import Link from "next/link";
import { Check, FilePlus2, Globe2, LoaderCircle, Upload, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { createReportEnrichment } from "@/lib/workspace-api";

interface PollResult {
  status: string;
  progress_pct?: number;
  data?: { outcome?: string; message?: string; is_current?: boolean };
}

export function ReportEnrichmentLauncher({
  reportId,
  reportTitle,
  onComplete,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: {
  reportId: string;
  reportTitle: string;
  onComplete: () => Promise<unknown>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
}) {
  const { state, refreshWorkspace } = useAppStore();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [instruction, setInstruction] = useState("核验关键判断，补齐来源、时间线和关系证据");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [web, setWeb] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState("");
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!jobId) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const snapshot = await apiRequest<PollResult>(`/api/analyze/${jobId}/poll`);
        if (disposed) return;
        setProgress(snapshot.progress_pct ?? 0);
        if (snapshot.status === "done") {
          setNotice(snapshot.data?.message || "证据补充任务已完成。");
          setSubmitting(false);
          if (snapshot.data?.outcome === "created" && snapshot.data.is_current) await onComplete();
          await refreshWorkspace();
          return;
        }
        if (snapshot.status === "error") {
          setError(snapshot.data?.message || "证据补充失败，请检查材料或 AI 连接。");
          setSubmitting(false);
          return;
        }
        timer = setTimeout(poll, 1600);
      } catch (reason) {
        if (disposed) return;
        setError(reason instanceof Error ? reason.message : "无法读取补充任务进度。");
        setSubmitting(false);
      }
    };
    void poll();
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, onComplete, refreshWorkspace]);

  function toggleMaterial(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      const ids: string[] = [];
      for (const file of Array.from(files)) {
        const body = new FormData();
        body.append("file", file);
        const uploaded = await apiRequest<{ id: string }>("/api/materials/upload", { method: "POST", body });
        ids.push(uploaded.id);
      }
      setSelected((current) => new Set([...current, ...ids]));
      await refreshWorkspace();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "材料上传失败。");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function submit() {
    if (!web && selected.size === 0) {
      setError("请至少选择一份材料，或开启联网检索。");
      return;
    }
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const job = await createReportEnrichment(reportId, {
        instruction: instruction.trim() || "核验并补充当前报告的证据缺口",
        materialIds: [...selected],
        web,
      });
      setJobId(job.jobTaskId);
      setProgress(1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法创建证据补充任务。");
      setSubmitting(false);
    }
  }

  function close() {
    setOpen(false);
    if (!submitting) {
      setJobId("");
      setProgress(0);
      setNotice("");
      setError("");
    }
  }

  return <>
    {showTrigger && <button className="secondary-button" type="button" onClick={() => setOpen(true)}><FilePlus2 size={16} />补充信息与证据</button>}
    {open && <div className="report-conversation-backdrop" role="presentation" onMouseDown={close}>
      <section className="report-conversation-dialog report-enrichment-dialog" role="dialog" aria-modal="true" aria-labelledby="report-enrichment-title" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><span className="eyebrow">报告后续研究</span><h2 id="report-enrichment-title">补充信息与证据</h2></div><button className="table-icon" type="button" onClick={close} aria-label="关闭补充信息与证据"><X size={18} /></button></header>
        <p>直接更新《{reportTitle}》的证据链并生成新版本。原版本保留；运行期间若报告被编辑，新结果只保存为候选稿。</p>
        {!jobId && <>
          <label className="report-enrichment-instruction"><span>本轮重点</span><textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} rows={3} placeholder="例如：补齐官方公告、关键时间点和主体之间的直接关系证据" /></label>
          <div className="report-enrichment-options">
            <label className="report-enrichment-source"><input type="checkbox" checked={web} onChange={(event) => setWeb(event.target.checked)} /><Globe2 size={18} /><span><strong>再次联网检索</strong><small>搜索新增公开来源、历史对照和后续进展</small></span></label>
            <div className="report-enrichment-materials">
              <div><span><strong>读取本机材料</strong><small>选择已有材料，也可以临时上传</small></span><div><button type="button" className="text-action" onClick={() => setSelected(new Set(state.materials.map((item) => item.id)))}>全选</button><button type="button" className="secondary-button" onClick={() => fileInput.current?.click()} disabled={uploading}><Upload size={15} />{uploading ? "上传中" : "上传材料"}</button></div></div>
              <input ref={fileInput} type="file" multiple hidden accept=".txt,.md,.docx,.pdf" onChange={(event) => void uploadFiles(event.target.files)} />
              <div className="report-enrichment-material-list">{state.materials.length ? state.materials.map((material) => <label key={material.id} className={selected.has(material.id) ? "report-enrichment-material report-enrichment-material--selected" : "report-enrichment-material"}><input type="checkbox" checked={selected.has(material.id)} onChange={() => toggleMaterial(material.id)} /><span><strong>{material.name}</strong><small>{material.note || (material.kind === "file" ? "本机文件" : "文本材料")}</small></span>{selected.has(material.id) && <Check size={16} />}</label>) : <p>当前没有本机材料，可以直接上传，或只使用联网检索。</p>}</div>
            </div>
          </div>
        </>}
        {jobId && !notice && !error && <div className="report-enrichment-progress" aria-live="polite"><LoaderCircle size={22} /><div><strong>正在补充证据并重建版本</strong><span>当前进度 {progress}%；可以关闭窗口，任务会在后台继续。</span></div></div>}
        {notice && <p className="delivery-notice" role="status">{notice}</p>}
        {error && <p className="delivery-error" role="alert">{error}</p>}
        <footer><Link className="secondary-button" href={`/reports/${reportId}/edit`}>人工编辑版本</Link><button className="secondary-button" type="button" onClick={close}>{notice ? "完成" : "取消"}</button>{!jobId && <button className="primary-button" type="button" onClick={() => void submit()} disabled={submitting || uploading}>{submitting ? "正在创建" : "开始补充"}</button>}</footer>
      </section>
    </div>}
  </>;
}
