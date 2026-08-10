import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { DashboardScreen, SettingsScreen } from "./app-screens";

vi.mock("@/lib/store", () => ({
  useAppStore: () => ({
    state: {
      projects: [
        { id: "project-policy", name: "政策观察", description: "政策项目", type: "policy", status: "active", progress: 40, updatedAt: "2026-08-09T10:00:00Z" },
        { id: "project-org", name: "组织诊断", description: "组织项目", type: "org", status: "review", progress: 100, updatedAt: "2026-08-08T10:00:00Z" },
      ],
      tasks: [],
      reports: [],
      materials: [],
      settings: { defaultEngine: "auto", theme: "light", defaultExport: "markdown" },
    },
    updateSettings: vi.fn(),
  }),
}));

describe("DashboardScreen", () => {
  it("keeps the project directory available even when no task is running", () => {
    render(<DashboardScreen />);

    expect(screen.getByRole("heading", { name: "项目" })).toBeInTheDocument();
    expect(screen.getByText("政策观察")).toBeInTheDocument();
    expect(screen.getByText("组织诊断")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("搜索项目"), { target: { value: "政策" } });

    expect(screen.getByText("政策观察")).toBeInTheDocument();
    expect(screen.queryByText("组织诊断")).not.toBeInTheDocument();
  });
});

describe("SettingsScreen", () => {
  it("does not expose obsolete engine routing controls", () => {
    render(<SettingsScreen />);

    expect(screen.queryByLabelText("默认分析引擎")).not.toBeInTheDocument();
    expect(screen.getByLabelText("显示主题")).toBeInTheDocument();
    expect(screen.getByLabelText("默认导出格式")).toBeInTheDocument();
  });
});
