"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  defaultSettings,
  type AnalysisTask,
  type AppState,
  type Report,
  type WorkspaceSettings,
} from "./domain";
import { seedState } from "./seed-data";
import { fetchCurrentReport, fetchTaskById, fetchWorkspaceSnapshot } from "./workspace-api";

export const STORAGE_KEY = "triad-analysis-workbench.v1";
export type ConnectionState = "checking" | "online" | "offline" | "demo";

type AppAction =
  | { type: "HYDRATE_DATA"; data: Pick<AppState, "projects" | "tasks" | "reports" | "materials">; requestedAt: string }
  | { type: "UPSERT_TASK"; task: AnalysisTask }
  | { type: "UPSERT_REPORT"; report: Report }
  | { type: "REMOVE_REPORTS"; reportIds: string[] }
  | { type: "REMOVE_TASKS"; taskIds: string[] }
  | { type: "UPDATE_TASK_PROGRESS"; taskId: string; status: AnalysisTask["status"]; phase: AnalysisTask["phase"]; progress: number; updatedAt: string }
  | { type: "UPDATE_SETTINGS"; settings: Partial<WorkspaceSettings> };

export interface AppStoreValue {
  state: AppState;
  hydrated: boolean;
  connection: ConnectionState;
  connectionError: string;
  refreshWorkspace: () => Promise<void>;
  loadTask: (taskId: string) => Promise<AnalysisTask | null>;
  loadReport: (taskId: string) => Promise<Report | null>;
  deleteReports: (reportIds: string[]) => void;
  updateTaskProgress: (taskId: string, update: Pick<AnalysisTask, "status" | "phase" | "progress">) => void;
  updateSettings: (settings: Partial<WorkspaceSettings>) => void;
}

interface StoredPreferences {
  settings?: Partial<WorkspaceSettings>;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function createEmptyState(settings: WorkspaceSettings = defaultSettings): AppState {
  return { version: 2, projects: [], tasks: [], reports: [], materials: [], settings };
}

export function createInitialState(demoMode: boolean): AppState {
  return demoMode ? seedState : createEmptyState();
}

export function parseStoredSettings(raw: string | null): WorkspaceSettings {
  if (!raw) return defaultSettings;
  try {
    const parsed = JSON.parse(raw) as StoredPreferences;
    const settings = parsed.settings ?? {};
    return {
      defaultEngine: settings.defaultEngine === "llm"
        ? "llm"
        : settings.defaultEngine === "rule"
          ? "rule"
          : "auto",
      theme: settings.theme === "dark" ? "dark" : "light",
      defaultExport: settings.defaultExport === "html" ? "html" : "markdown",
    };
  } catch {
    return defaultSettings;
  }
}

function mergeSnapshotItems<T extends { id: string; updatedAt: string }>(current: T[], incoming: T[], requestedAt: string): T[] {
  const requestTime = Date.parse(requestedAt);
  const currentById = new Map(current.map((item) => [item.id, item]));
  const incomingIds = new Set(incoming.map((item) => item.id));
  const merged = incoming.map((item) => {
    const local = currentById.get(item.id);
    return local && Date.parse(local.updatedAt) > requestTime ? local : item;
  });
  return [
    ...merged,
    ...current.filter((item) => !incomingIds.has(item.id) && Date.parse(item.updatedAt) > requestTime),
  ];
}

export function appReducer(state: AppState, action: AppAction): AppState {
  if (action.type === "HYDRATE_DATA") return {
    ...state,
    projects: mergeSnapshotItems(state.projects, action.data.projects, action.requestedAt),
    tasks: mergeSnapshotItems(state.tasks, action.data.tasks, action.requestedAt),
    reports: mergeSnapshotItems(state.reports, action.data.reports, action.requestedAt),
    materials: mergeSnapshotItems(state.materials, action.data.materials, action.requestedAt),
  };
  if (action.type === "UPSERT_TASK") {
    const exists = state.tasks.some((task) => task.id === action.task.id);
    return {
      ...state,
      tasks: exists
        ? state.tasks.map((task) => task.id === action.task.id ? action.task : task)
        : [action.task, ...state.tasks],
    };
  }
  if (action.type === "UPSERT_REPORT") {
    const exists = state.reports.some((report) => report.id === action.report.id);
    return {
      ...state,
      reports: exists
        ? state.reports.map((report) => report.id === action.report.id ? action.report : report)
        : [action.report, ...state.reports],
    };
  }
  if (action.type === "REMOVE_REPORTS") {
    const ids = new Set(action.reportIds);
    return { ...state, reports: state.reports.filter((report) => !ids.has(report.id)) };
  }
  if (action.type === "REMOVE_TASKS") {
    // 删除报告时后端已级联删除对应 Task，前端同步移除，避免残留幽灵任务
    const ids = new Set(action.taskIds);
    return { ...state, tasks: state.tasks.filter((task) => !ids.has(task.id)) };
  }
  if (action.type === "UPDATE_TASK_PROGRESS") {
    return {
      ...state,
      tasks: state.tasks.map((task) => task.id === action.taskId
        ? { ...task, status: action.status, phase: action.phase, progress: action.progress, updatedAt: action.updatedAt }
        : task),
      projects: state.projects.map((project) => state.tasks.some((task) => task.id === action.taskId && task.projectId === project.id)
        ? { ...project, progress: action.progress, updatedAt: action.updatedAt }
        : project),
    };
  }
  if (action.type === "UPDATE_SETTINGS") {
    return { ...state, settings: { ...state.settings, ...action.settings } };
  }
  return state;
}

function errorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "无法连接本地分析后端";
}

export function AppStoreProvider({
  children,
  initialState,
  demoMode,
}: {
  children: React.ReactNode;
  initialState?: AppState;
  demoMode?: boolean;
}) {
  const demo = demoMode ?? process.env.NEXT_PUBLIC_DEMO_MODE === "1";
  const [state, dispatch] = useReducer(appReducer, initialState ?? createInitialState(demo));
  const stateRef = useRef(state);
  stateRef.current = state;
  const [hydrated, setHydrated] = useState(Boolean(initialState) || demo);
  const [connection, setConnection] = useState<ConnectionState>(demo ? "demo" : initialState ? "online" : "checking");
  const [connectionError, setConnectionError] = useState("");
  const [notice, setNotice] = useState("");

  const refreshWorkspace = useCallback(async () => {
    if (demo) return;
    setConnection("checking");
    setConnectionError("");
    const requestedAt = new Date().toISOString();
    try {
      const snapshot = await fetchWorkspaceSnapshot();
      dispatch({ type: "HYDRATE_DATA", data: snapshot, requestedAt });
      setConnection("online");
    } catch (reason) {
      setConnection("offline");
      setConnectionError(errorMessage(reason));
    } finally {
      setHydrated(true);
    }
  }, [demo]);

  const loadTask = useCallback(async (taskId: string) => {
    if (demo) return stateRef.current.tasks.find((task) => task.id === taskId) ?? null;
    try {
      const task = await fetchTaskById(taskId);
      if (task) dispatch({ type: "UPSERT_TASK", task });
      setConnection("online");
      setConnectionError("");
      return task;
    } catch (reason) {
      setConnection("offline");
      setConnectionError(errorMessage(reason));
      return null;
    }
  }, [demo]);

  const loadReport = useCallback(async (taskId: string) => {
    if (demo) return stateRef.current.reports.find((report) => report.taskId === taskId) ?? null;
    try {
      let task = stateRef.current.tasks.find((candidate) => candidate.id === taskId) ?? null;
      if (!task) {
        task = await fetchTaskById(taskId);
        if (task) dispatch({ type: "UPSERT_TASK", task });
      }
      if (!task) return null;
      const report = await fetchCurrentReport(task);
      if (report) dispatch({ type: "UPSERT_REPORT", report });
      setConnection("online");
      setConnectionError("");
      return report;
    } catch (reason) {
      setConnection("offline");
      setConnectionError(errorMessage(reason));
      return null;
    }
  }, [demo]);

  useEffect(() => {
    if (initialState || demo) return;
    dispatch({ type: "UPDATE_SETTINGS", settings: parseStoredSettings(window.localStorage.getItem(STORAGE_KEY)) });
    void refreshWorkspace();
  }, [demo, initialState, refreshWorkspace]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, settings: state.settings }));
  }, [hydrated, state.settings]);

  useEffect(() => {
    document.documentElement.dataset.theme = state.settings.theme;
  }, [state.settings.theme]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const value = useMemo<AppStoreValue>(() => ({
    state,
    hydrated,
    connection,
    connectionError,
    refreshWorkspace,
    loadTask,
    loadReport,
    deleteReports(reportIds) {
      if (!reportIds.length) return;
      dispatch({ type: "REMOVE_REPORTS", reportIds });
      // 后端 DELETE /api/reports/{id} 会级联删除对应 Task，前端同步移除
      dispatch({ type: "REMOVE_TASKS", taskIds: reportIds });
      setNotice(`已删除 ${reportIds.length} 份报告`);
    },
    updateTaskProgress(taskId, update) {
      dispatch({ type: "UPDATE_TASK_PROGRESS", taskId, ...update, updatedAt: new Date().toISOString() });
    },
    updateSettings(settings) {
      dispatch({ type: "UPDATE_SETTINGS", settings });
      setNotice("工作空间设置已更新");
    },
  }), [connection, connectionError, hydrated, loadReport, loadTask, refreshWorkspace, state]);

  return (
    <AppStoreContext.Provider value={value}>
      {children}
      {notice && <div className="app-toast" role="status">{notice}</div>}
    </AppStoreContext.Provider>
  );
}

export function useAppStore() {
  const value = useContext(AppStoreContext);
  if (!value) throw new Error("useAppStore must be used within AppStoreProvider");
  return value;
}
