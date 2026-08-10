import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { AnalysisCreation } from "./analysis-creation";
import type { NewAnalysisInput } from "@/lib/domain";


describe("AnalysisCreation routing intent", () => {
  it("submits freeform input with deterministic render as the default mode", async () => {
    const onCreate = vi.fn(async (_input: NewAnalysisInput) => undefined);
    render(<AnalysisCreation onCreate={onCreate} />);

    fireEvent.change(screen.getByLabelText("分析输入"), {
      target: { value: "分析这项政策为什么引发利益冲突" },
    });
    fireEvent.click(screen.getByRole("button", { name: /生成报告/ }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate.mock.calls[0][0]).toMatchObject({
      context: "分析这项政策为什么引发利益冲突",
      engine: "rule",
      inputMode: "freeform",
      renderOnly: true,
      web: false,
    });
  });

  it("uses the auto engine only in AI assist mode", async () => {
    const onCreate = vi.fn(async (_input: NewAnalysisInput) => undefined);
    render(<AnalysisCreation onCreate={onCreate} />);

    fireEvent.click(screen.getByRole("button", { name: /AI 辅助/ }));
    fireEvent.change(screen.getByLabelText("分析输入"), {
      target: { value: "分析恋与深空制作人事件" },
    });
    fireEvent.click(screen.getByRole("button", { name: /开始分析/ }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate.mock.calls[0][0]).toMatchObject({
      engine: "auto",
      inputMode: "freeform",
      web: true,
    });
    expect(onCreate.mock.calls[0][0].renderOnly).toBeFalsy();
  });
});
