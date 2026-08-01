"use client";

import { Network } from "lucide-react";
import React, { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { MarkdownReport } from "@/lib/markdown";

type LoadState = "loading" | "ready" | "missing" | "error";

export function AnalysisNetwork({ taskId }: { taskId: string }) {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    let active = true;
    setState("loading");
    apiRequest<{ status: string; data?: { markdown?: string } }>(`/api/analyze/${taskId}`)
      .then((result) => {
        if (!active) return;
        if (result.status === "done" && result.data?.markdown) {
          setMarkdown(result.data.markdown);
          setState("ready");
        } else if (result.status === "error") {
          setState("error");
        } else {
          setState("missing");
        }
      })
      .catch(() => { if (active) setState("missing"); });
    return () => { active = false; };
  }, [taskId]);

  if (state === "loading") return <section className="network-loading" aria-busy="true">正在读取结构拆解…</section>;
  if (state === "error") return <div className="workbench-network"><Network size={24} /><div><span className="eyebrow">结构拆解</span><h2>该任务未能生成报告</h2><p>后端返回错误，请重试或检查输入线索。</p></div></div>;
  if (state !== "ready" || !markdown) return <div className="workbench-network"><Network size={24} /><div><span className="eyebrow">结构拆解</span><h2>报告尚未生成</h2><p>分析任务完成后，这里会展示完整的结构化报告与关系拆解。</p></div></div>;
  return <section className="analysis-network"><span className="eyebrow">结构拆解 · 关系与利益网络</span><MarkdownReport markdown={markdown} /></section>;
}
