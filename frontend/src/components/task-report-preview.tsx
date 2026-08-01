"use client";

import React, { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { MarkdownReport } from "@/lib/markdown";

type LoadState = "loading" | "ready" | "missing" | "error";

export function TaskReportPreview({ taskId }: { taskId: string }) {
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

  if (state === "loading") return <section className="network-loading" aria-busy="true">正在读取结构化报告…</section>;
  if (state === "error") return <div className="workbench-report"><div><span className="eyebrow">分析失败</span><h2>该任务未能生成报告</h2><p>后端返回错误，可返回新建分析重试，或检查输入线索是否充分。</p></div></div>;
  if (state !== "ready" || !markdown) return <div className="workbench-report"><div><span className="eyebrow">结构化输出</span><h2>报告尚未生成</h2><p>分析任务仍在处理中，完成后会在这里显示可追溯的结构化报告。你也可以稍后从「报告」页查看。</p></div></div>;
  return <section className="task-report-preview"><MarkdownReport markdown={markdown} /></section>;
}
