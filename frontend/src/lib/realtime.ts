"use client";

import { useEffect, useRef } from "react";
import { WS_BASE } from "./api";
import { useAppStore } from "./store";
import { normalizeTaskPhase, normalizeTaskStatus } from "./workspace-api";

// 后端通过 WebSocket 推送任务进度：/ws/progress/{task_id}
// 消息形如 { status, data, phase?, progress_pct? }。
//
// 可靠性策略：WS 是主通道（实时性好），但单靠 WS 不可靠——LLM 调用可能耗时 1~2 分钟，
// 期间 WS 可能因网络抖动/代理 idle 超时断开，4 次重连也可能错过 done 推送。
// 因此在 WS 重连耗尽后启动兜底轮询（每 5 秒拉一次 /poll），直到任务 done/error 才停。
// 这样无论 WS 是否可靠，前端都能拿到最终状态，不会"卡住必须刷新"。
export function useTaskProgress(taskId: string, enabled = true) {
  const { updateTaskProgress, loadReport, loadTask } = useAppStore();
  const updateRef = useRef(updateTaskProgress);
  const loadReportRef = useRef(loadReport);
  const loadTaskRef = useRef(loadTask);
  updateRef.current = updateTaskProgress;
  loadReportRef.current = loadReport;
  loadTaskRef.current = loadTask;

  useEffect(() => {
    if (typeof window === "undefined" || !enabled) return;

    let ws: WebSocket | null = null;
    let closedByUs = false;
    let retryCount = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let stopped = false;
    // 指数退避重连：1s → 2s → 4s → 8s，最多 4 次；之后转兜底轮询
    const RETRY_DELAYS = [1000, 2000, 4000, 8000];
    const POLL_INTERVAL = 5000; // 兜底轮询间隔：5 秒

    function finish(taskStatus: "done" | "error") {
      if (stopped) return;
      stopped = true;
      closedByUs = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (pollTimer) clearInterval(pollTimer);
      try { ws?.close(); } catch { /* noop */ }
      if (taskStatus === "done") {
        void loadReportRef.current(taskId);
      } else {
        // error 时拉完整任务数据（含 error 文案、errorPhase、quality 详情），
        // 否则 UI 只能显示 WS 推送的 phase/progress，看不到真实失败原因
        void loadTaskRef.current(taskId);
      }
    }

    // 兜底轮询：WS 重连耗尽后，每 5 秒拉一次 /poll，直到 done/error
    function startPolling() {
      if (stopped || pollTimer) return;
      console.warn(`任务 ${taskId} 转入轮询兜底（每 ${POLL_INTERVAL / 1000}s 一次）`);
      const tick = async () => {
        if (stopped) return;
        try {
          const task = await loadTaskRef.current(taskId);
          if (!task) return;
          if (task.status === "done" || task.status === "error") {
            updateRef.current(taskId, {
              status: task.status,
              phase: task.phase,
              progress: task.progress,
            });
            finish(task.status);
          }
        } catch {
          // 轮询失败不放弃，下次再试
        }
      };
      void tick(); // 立即跑一次，不等首个间隔
      pollTimer = setInterval(tick, POLL_INTERVAL);
    }

    function connect() {
      if (closedByUs || stopped) return;
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
          // error 消息的 data 形如 { message, type, phase }，phase 是 error_phase
          // （如 "quality_gate" / "decompose"），用于推断失败发生在哪一步
          const errorPhase =
            status === "error" && payload.data && typeof payload.data === "object"
              ? (payload.data as { phase?: string }).phase
              : undefined;
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
            phase: normalizeTaskPhase(payload.phase, status, errorPhase),
            progress,
          });
          if (status === "done" || status === "error") {
            finish(status);
          }
        } catch {
          // 忽略畸形消息，等待下一次快照恢复 UI。
        }
      };
      ws.onerror = () => {
        // 连接失败：交由 onclose 统一处理重连/降级
        console.warn(`任务 ${taskId} 进度连接异常，将重试或转轮询兜底`);
      };
      ws.onclose = () => {
        if (closedByUs || stopped) return;
        if (retryCount < RETRY_DELAYS.length) {
          const delay = RETRY_DELAYS[retryCount];
          retryCount += 1;
          console.warn(`任务 ${taskId} 进度连接断开，${delay / 1000}s 后重连（第 ${retryCount} 次）`);
          retryTimer = setTimeout(connect, delay);
        } else {
          // WS 重连耗尽：转兜底轮询，保证最终能拿到 done/error
          startPolling();
        }
      };
    }

    connect();
    return () => {
      stopped = true;
      closedByUs = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (pollTimer) clearInterval(pollTimer);
      try { ws?.close(); } catch { /* noop */ }
    };
  }, [enabled, taskId]);
}
