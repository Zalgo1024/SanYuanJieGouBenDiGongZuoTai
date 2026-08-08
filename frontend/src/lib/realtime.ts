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

    let ws: WebSocket | null = null;
    let closedByUs = false;
    let retryCount = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    // 指数退避重连：1s → 2s → 4s → 8s，最多 4 次；之后依赖轮询恢复
    const RETRY_DELAYS = [1000, 2000, 4000, 8000];

    function connect() {
      if (closedByUs) return;
      ws = new WebSocket(`${WS_BASE}/ws/progress/${taskId}`);
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
          if (status === "done" || status === "error") {
            closedByUs = true;
            ws?.close();
            if (status === "done") void loadReportRef.current(taskId);
          }
        } catch {
          // 忽略畸形消息，等待下一次快照恢复 UI。
        }
      };
      ws.onerror = () => {
        // 连接失败：交由 onclose 统一处理重连/降级
        console.warn(`任务 ${taskId} 进度连接异常，将重试或依赖轮询恢复`);
      };
      ws.onclose = () => {
        if (closedByUs) return;
        if (retryCount < RETRY_DELAYS.length) {
          const delay = RETRY_DELAYS[retryCount];
          retryCount += 1;
          console.warn(`任务 ${taskId} 进度连接断开，${delay / 1000}s 后重连（第 ${retryCount} 次）`);
          retryTimer = setTimeout(connect, delay);
        } else {
          console.warn(`任务 ${taskId} 进度连接已断开，后续进度依赖轮询恢复`);
        }
      };
    }

    connect();
    return () => {
      closedByUs = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    };
  }, [enabled, taskId]);
}
