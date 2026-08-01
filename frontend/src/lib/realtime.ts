"use client";

import { useEffect, useRef } from "react";
import { WS_BASE } from "./api";
import { useAppStore } from "./store";
import { normalizeTaskPhase, normalizeTaskStatus } from "./workspace-api";

// 后端通过 WebSocket 推送任务进度：/ws/progress/{task_id}
// 消息形如 { status, data, phase?, progress_pct? }。
export function useTaskProgress(taskId: string, enabled = true) {
  const { updateTaskProgress, loadReport } = useAppStore();
  const updateRef = useRef(updateTaskProgress);
  const loadReportRef = useRef(loadReport);
  updateRef.current = updateTaskProgress;
  loadReportRef.current = loadReport;

  useEffect(() => {
    if (typeof window === "undefined" || !enabled) return;
    const ws = new WebSocket(`${WS_BASE}/ws/progress/${taskId}`);
    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as {
          status?: string;
          phase?: string;
          progress_pct?: number;
          progress?: number;
          data?: unknown;
        };
        if (!payload.status) return;
        const status = normalizeTaskStatus(payload.status);
        const progress =
          status === "done"
            ? 100
            : typeof payload.progress_pct === "number"
              ? payload.progress_pct
              : typeof payload.progress === "number"
                ? payload.progress
                : 0;
        updateRef.current(taskId, {
          status,
          phase: normalizeTaskPhase(payload.phase, status),
          progress,
        });
        if (status === "done") void loadReportRef.current(taskId);
      } catch {
        // 忽略畸形消息，等待下一次快照恢复 UI。
      }
    };
    return () => { ws.close(); };
  }, [enabled, taskId]);
}
