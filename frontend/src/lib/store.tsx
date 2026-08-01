"use client";

import React, { createContext, useContext, useEffect, useMemo, useReducer, useState } from "react";
import {
  defaultSettings,
  type AnalysisTask,
  type AppState,
  type MaterialRecord,
  type NewAnalysisInput,
  type Project,
  type Report,
  type WorkspaceSettings,
} from "./domain";
import { createReportDraft, seedState } from "./seed-data";
import { apiRequest } from "./api";

export const STORAGE_KEY = "triad-analysis-workbench.v1";

type AppAction =
  | { type: "HYDRATE"; state: AppState }
  | { type: "CREATE_TASK"; project?: Project; task: AnalysisTask }
  | { type: "ADD_TASK"; task: AnalysisTask }
  | { type: "UPDATE_TASK_PROGRESS"; taskId: string; status: AnalysisTask["status"]; phase: AnalysisTask["phase"]; progress: number; updatedAt: string }
  | { type: "ADD_MATERIALS"; materials: MaterialRecord[] }
  | { type: "CREATE_REPORT"; report: Report }
  | { type: "DELETE_REPORTS"; reportIds: string[] }
  | { type: "UPDATE_REPORT"; reportId: string; markdown: string; updatedAt: string }
  | { type: "UPDATE_SETTINGS"; settings: Partial<WorkspaceSettings> };

interface AppStoreValue {
  state: AppState;
  hydrated: boolean;
  createTask: (input: NewAnalysisInput) => string;
  loadTask: (taskId: string) => Promise<void>;
  createReport: (taskId: string) => string | null;
  deleteReports: (reportIds: string[]) => void;
  updateReport: (reportId: string, markdown: string) => void;
  updateTaskProgress: (taskId: string, update: Pick<AnalysisTask, "status" | "phase" | "progress">) => void;
  addMaterials: (names: string[]) => void;
  updateSettings: (settings: Partial<WorkspaceSettings>) => void;
}

type StoredReport = Omit<Report, "revisions"> & { revisions?: Report["revisions"] };
type StoredMaterial = Omit<MaterialRecord, "status"> & { status?: MaterialRecord["status"] };
interface StoredState {
  version?: number;
  projects?: AppState["projects"];
  tasks?: AppState["tasks"];
  reports?: StoredReport[];
  materials?: StoredMaterial[];
  settings?: Partial<WorkspaceSettings>;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function createEmptyState(): AppState {
  return { version: 2, projects: [], tasks: [], reports: [], materials: [], settings: defaultSettings };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  if (action.type === "HYDRATE") return action.state;
  if (action.type === "CREATE_TASK") {
    return {
      ...state,
      projects: action.project ? [action.project, ...state.projects] : state.projects,
      tasks: [action.task, ...state.tasks],
    };
  }
  if (action.type === "ADD_TASK") {
    if (state.tasks.some((task) => task.id === action.task.id)) return state;
    return { ...state, tasks: [action.task, ...state.tasks] };
  }
  if (action.type === "UPDATE_TASK_PROGRESS") {
    return {
      ...state,
      tasks: state.tasks.map((task) => task.id === action.taskId ? { ...task, status: action.status, phase: action.phase, progress: action.progress, updatedAt: action.updatedAt } : task),
      projects: state.projects.map((project) => state.tasks.some((task) => task.id === action.taskId && task.projectId === project.id) ? { ...project, progress: action.progress, updatedAt: action.updatedAt } : project),
    };
  }
  if (action.type === "CREATE_REPORT") {
    if (state.reports.some((report) => report.taskId === action.report.taskId)) return state;
    return { ...state, reports: [action.report, ...state.reports] };
  }
  if (action.type === "DELETE_REPORTS") {
    const reportIds = new Set(action.reportIds);
    return { ...state, reports: state.reports.filter((report) => !reportIds.has(report.id)) };
  }
  if (action.type === "ADD_MATERIALS") {
    return { ...state, materials: [...action.materials, ...state.materials] };
  }
  if (action.type === "UPDATE_REPORT") {
    return {
      ...state,
      reports: state.reports.map((report) =>
        report.id === action.reportId
          ? {
              ...report,
              markdown: action.markdown,
              updatedAt: action.updatedAt,
              version: report.version + 1,
              revisions: [
                ...(report.revisions ?? []),
                { version: report.version, markdown: report.markdown, updatedAt: report.updatedAt },
              ],
            }
          : report,
      ),
    };
  }
  if (action.type === "UPDATE_SETTINGS") {
    return { ...state, settings: { ...state.settings, ...action.settings } };
  }
  return state;
}

export function parseStoredState(raw: string | null): AppState {
  if (!raw) return seedState;
  try {
    const parsed = JSON.parse(raw) as StoredState;
    if (
      (parsed.version !== 1 && parsed.version !== 2) ||
      !Array.isArray(parsed.projects) ||
      !Array.isArray(parsed.tasks) ||
      !Array.isArray(parsed.reports) ||
      !Array.isArray(parsed.materials)
    ) {
      return seedState;
    }
    return {
      version: 2,
      projects: parsed.projects,
      tasks: parsed.tasks,
      reports: parsed.reports.map((report) => ({ ...report, revisions: report.revisions ?? [] })),
      materials: parsed.materials.map((material) => ({ ...material, status: material.status ?? "ready" })),
      settings: { ...defaultSettings, ...(parsed.settings ?? {}) },
    };
  } catch {
    return seedState;
  }
}

function makeId(prefix: string) {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}

function mapTask(item: {
  task_id: string;
  title: string;
  status: string;
  analysis_type: string;
  project_id: string | null;
  created_at: string | null;
}): AnalysisTask {
  return {
    id: item.task_id,
    projectId: item.project_id ?? "",
    type: (item.analysis_type as AnalysisTask["type"]) ?? "case",
    title: item.title,
    context: "",
    engine: "rule" as AnalysisTask["engine"],
    materialIds: [],
    status: (item.status as AnalysisTask["status"]) ?? "queued",
    phase: "output" as AnalysisTask["phase"],
    progress: item.status === "done" ? 100 : 0,
    createdAt: item.created_at ?? new Date().toISOString(),
    updatedAt: item.created_at ?? new Date().toISOString(),
  };
}

export function AppStoreProvider({
  children,
  initialState,
  persist = true,
}: {
  children: React.ReactNode;
  initialState?: AppState;
  persist?: boolean;
}) {
  const [state, dispatch] = useReducer(appReducer, initialState ?? seedState);
  const [hydrated, setHydrated] = useState(Boolean(initialState) || !persist);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!persist || initialState) return;
    dispatch({ type: "HYDRATE", state: parseStoredState(window.localStorage.getItem(STORAGE_KEY)) });
    setHydrated(true);
  }, [initialState, persist]);

  useEffect(() => {
    if (persist && hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, persist, state]);

  useEffect(() => {
    // 分析skill 后端无鉴权，本地单用户直接拉取。
    let cancelled = false;
    async function hydrateFromApi() {
      try {
        const [projectsResponse, materialsResponse, tasksResponse] = await Promise.all([
          apiRequest<Array<{ id: string; name: string; description: string | null; status: string; progress: string | number; is_archived: boolean; updated_at: string | null }>>("/api/projects"),
          apiRequest<Array<{ id: string; title: string; source_type: string; source: string | null; tags: string | null; created_at: string | null }>>("/api/materials"),
          apiRequest<Array<{ task_id: string; title: string; status: string; analysis_type: string; project_id: string | null; created_at: string | null }>>("/api/tasks"),
        ]);
        if (cancelled) return;
        const tasks: AnalysisTask[] = tasksResponse.map(mapTask);
        // 已完成任务：拉取报告正文构建 Report 列表
        const reports: Report[] = [];
        await Promise.all(
          tasks
            .filter((task) => task.status === "done")
            .map(async (task) => {
              try {
                const r = await apiRequest<{ status: string; data?: { markdown?: string } }>(`/api/analyze/${task.id}`);
                if (r.status === "done" && r.data?.markdown) {
                  reports.push({ id: task.id, taskId: task.id, type: task.type, title: task.title, markdown: r.data.markdown, version: 1, updatedAt: task.updatedAt, nodes: [], revisions: [] });
                }
              } catch { /* 单个失败不影响其余 */ }
            })
        );
        if (cancelled) return;
        dispatch({
          type: "HYDRATE",
          state: {
            ...state,
            projects: projectsResponse.map((item) => ({
              id: item.id,
              name: item.name,
              description: item.description ?? "",
              type: "case" as Project["type"],
              status: item.is_archived ? "archived" : "active",
              progress: Number(item.progress) || 0,
              updatedAt: item.updated_at ?? new Date().toISOString(),
            })),
            materials: materialsResponse.map((item) => ({
              id: item.id,
              name: item.title,
              kind: (["file", "link", "note"].includes(item.source_type) ? item.source_type : "file") as MaterialRecord["kind"],
              note: item.source ?? item.tags ?? "",
              updatedAt: item.created_at ?? new Date().toISOString(),
              status: "ready" as MaterialRecord["status"],
            })),
            tasks,
            reports,
          },
        });
      } catch {
        // 后端暂不可用时保留本地草稿状态
      }
    }
    void hydrateFromApi();
    return () => { cancelled = true; };
  }, []);

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
    createTask(input) {
      const now = new Date().toISOString();
      const projectId = input.projectId ?? makeId("project");
      const project = input.projectId ? undefined : {
        id: projectId,
        name: input.title,
        description: input.context || "尚未补充项目背景。",
        type: input.type,
        status: "active" as const,
        progress: 8,
        updatedAt: now,
      };
      const task: AnalysisTask = {
        id: makeId("analysis"),
        projectId,
        type: input.type,
        title: input.title,
        context: input.context,
        engine: input.engine,
        materialIds: input.materialIds,
        status: "generating",
        phase: "inspect",
        progress: 8,
        createdAt: now,
        updatedAt: now,
      };
      dispatch({ type: "CREATE_TASK", project, task });
      setNotice(input.projectId ? "分析任务已加入项目" : "项目与分析任务已创建");
      return task.id;
    },
    async loadTask(taskId) {
      try {
        const list = await apiRequest<Array<{ task_id: string; title: string; status: string; analysis_type: string; project_id: string | null; created_at: string | null }>>("/api/tasks");
        const item = list.find((t) => t.task_id === taskId);
        if (!item) return;
        dispatch({ type: "ADD_TASK", task: mapTask(item) });
      } catch { /* 忽略：后端暂不可用 */ }
    },
    createReport(taskId) {
      const existing = state.reports.find((report) => report.taskId === taskId);
      if (existing) return existing.id;
      const task = state.tasks.find((item) => item.id === taskId);
      if (!task) return null;
      const report = createReportDraft(task, makeId("report"), new Date().toISOString());
      dispatch({ type: "CREATE_REPORT", report });
      setNotice("报告初稿已生成");
      return report.id;
    },
    deleteReports(reportIds) {
      if (!reportIds.length) return;
      dispatch({ type: "DELETE_REPORTS", reportIds });
      setNotice(`已删除 ${reportIds.length} 份报告`);
    },
    updateReport(reportId, markdown) {
      dispatch({ type: "UPDATE_REPORT", reportId, markdown, updatedAt: new Date().toISOString() });
      setNotice("新报告版本已保存");
    },
    updateTaskProgress(taskId, update) {
      dispatch({ type: "UPDATE_TASK_PROGRESS", taskId, ...update, updatedAt: new Date().toISOString() });
    },
    addMaterials(names) {
      const now = new Date().toISOString();
      dispatch({
        type: "ADD_MATERIALS",
        materials: names.map((name) => ({
          id: makeId("material"),
          name,
          kind: "file",
          note: "待关联到分析任务",
          updatedAt: now,
          status: "pending",
        })),
      });
      setNotice(`已导入 ${names.length} 份材料，等待解析`);
    },
    updateSettings(settings) {
      dispatch({ type: "UPDATE_SETTINGS", settings });
      setNotice("工作空间设置已更新");
    },
  }), [hydrated, state]);

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
