import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import FormattedDate from "@/components/FormattedDate";

// 隔离：避免加载真实 @/lib/api（含 fetch 封装）。验证 @ 别名解析与组件渲染。
vi.mock("@/lib/api", () => ({
  fmtDate: (iso?: string | null) => (iso ? `友好:${iso}` : "—"),
}));

describe("FormattedDate", () => {
  it("渲染非空且证明使用了 fmtDate（@/lib/api 别名解析正常）", () => {
    render(<FormattedDate iso="2026-07-17T10:00:00Z" />);
    expect(screen.getByText(/友好:2026-07-17/)).toBeInTheDocument();
  });

  it("空值渲染 —", () => {
    render(<FormattedDate iso={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
