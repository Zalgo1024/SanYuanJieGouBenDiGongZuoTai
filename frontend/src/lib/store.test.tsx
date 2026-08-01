import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWorkspaceSnapshot } from "./workspace-api";
import { AppStoreProvider, appReducer, createEmptyState, createInitialState, parseStoredSettings, useAppStore } from "./store";

vi.mock("./workspace-api", () => ({
  fetchWorkspaceSnapshot: vi.fn(),
  fetchTaskById: vi.fn(),
  fetchCurrentReport: vi.fn(),
}));

function Probe() {
  const { state, hydrated, connection, connectionError } = useAppStore();
  return <div>
    <span data-testid="hydrated">{String(hydrated)}</span>
    <span data-testid="connection">{connection}</span>
    <span data-testid="projects">{state.projects.length}</span>
    <span data-testid="theme">{state.settings.theme}</span>
    <span data-testid="error">{connectionError}</span>
  </div>;
}

const storage = new Map<string, string>();
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: {
    clear: () => storage.clear(),
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
});

describe("local frontend state", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(fetchWorkspaceSnapshot).mockReset();
  });

  it("starts with an empty workspace unless demo mode is explicit", () => {
    const normal = createInitialState(false);
    const demo = createInitialState(true);

    expect(normal.projects).toEqual([]);
    expect(normal.tasks).toEqual([]);
    expect(normal.reports).toEqual([]);
    expect(normal.materials).toEqual([]);
    expect(demo.projects.length).toBeGreaterThan(0);
  });

  it("restores settings but ignores cached projects, tasks and reports", () => {
    const settings = parseStoredSettings(JSON.stringify({
      version: 2,
      projects: [{ id: "stale-project" }],
      tasks: [{ id: "stale-task" }],
      reports: [{ id: "stale-report" }],
      settings: { theme: "dark", defaultEngine: "llm" },
    }));

    expect(settings).toMatchObject({ theme: "dark", defaultEngine: "llm", defaultExport: "markdown" });
  });

  it("shows an offline state without loading demo data when backend hydration fails", async () => {
    vi.mocked(fetchWorkspaceSnapshot).mockRejectedValue(new Error("连接被拒绝"));

    render(<AppStoreProvider demoMode={false}><Probe /></AppStoreProvider>);

    await waitFor(() => expect(screen.getByTestId("hydrated")).toHaveTextContent("true"));
    expect(screen.getByTestId("connection")).toHaveTextContent("offline");
    expect(screen.getByTestId("projects")).toHaveTextContent("0");
    expect(screen.getByTestId("error")).toHaveTextContent("连接被拒绝");
  });

  it("does not let an older workspace snapshot erase a report loaded by realtime", () => {
    const state = createEmptyState();
    state.reports = [{
      id: "task-1",
      taskId: "task-1",
      type: "case",
      title: "刚完成的报告",
      markdown: "# 当前版本",
      version: 1,
      updatedAt: "2026-08-02T10:00:02.000Z",
      nodes: [],
      currentVersionId: "version-1",
      versions: [],
    }];

    const next = appReducer(state, {
      type: "HYDRATE_DATA",
      requestedAt: "2026-08-02T10:00:00.000Z",
      data: { projects: [], tasks: [], reports: [], materials: [] },
    });

    expect(next.reports).toHaveLength(1);
    expect(next.reports[0].title).toBe("刚完成的报告");
  });
});
