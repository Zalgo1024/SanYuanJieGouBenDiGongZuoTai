import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { DashboardScreen } from "./app-screens";

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  refreshWorkspace: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ apiRequest: mocks.apiRequest }));

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
    refreshWorkspace: mocks.refreshWorkspace,
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

describe("DashboardScreen project management", () => {
  it("selects visible projects and permanently deletes them after confirmation", async () => {
    mocks.apiRequest.mockResolvedValue({ ok: true, deleted_count: 2, deleted: [], failed: [] });
    mocks.refreshWorkspace.mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<DashboardScreen />);

    const deleteButton = screen.getByRole("button", { name: "删除选中的项目" });
    expect(deleteButton).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "全选当前筛选结果" }));
    expect(screen.getByLabelText("选择项目 政策观察")).toBeChecked();
    expect(screen.getByLabelText("选择项目 组织诊断")).toBeChecked();
    expect(deleteButton).toBeEnabled();

    fireEvent.click(deleteButton);

    await waitFor(() => expect(mocks.apiRequest).toHaveBeenCalledWith("/api/projects", {
      method: "DELETE",
      body: JSON.stringify({ ids: ["project-policy", "project-org"], confirm: true }),
    }));
    expect(mocks.refreshWorkspace).toHaveBeenCalled();
  });
});
