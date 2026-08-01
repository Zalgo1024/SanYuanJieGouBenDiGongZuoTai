"use client";

import { useEffect, useRef } from "react";
import { WS_BASE } from "./api";
import type { AnalysisTask } from "./domain";
import { useAppStore } from "./store";

interface ProgressEvent {
  task_id: string;
  status: AnalysisTask["status"];
  phase: AnalysisTask["phase"];
  progress: number;
}

// 后端通过 WebSocket 推送任务进度：/ws/progress/{task_id}
// 消息形如 { status, data, phase?, progress_pct? }。
export function useTaskProgress(taskId: string) {
  const { updateTaskProgress } = useAppStore();
  const updateRef = useRef(updateTaskProgress);
  updateRef.current = updateTaskProgress;

  useEffect(() => {
    if (typeof window === "undefined") return;
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
        const status = payload.status as AnalysisTask["status"];
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
          phase: (payload.phase as AnalysisTask["phase"]) ?? "output",
          progress,
        });
      } catch {
        // 忽略畸形消息，等待下一次快照恢复 UI。
      }
    };
    return () => { ws.close(); };
  }, [taskId]);
}
