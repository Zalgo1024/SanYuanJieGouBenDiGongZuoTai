import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { AnalysisCreation } from "./analysis-creation";


describe("AnalysisCreation routing intent", () => {
  it("submits freeform input with auto as the default engine", async () => {
    const onCreate = vi.fn(async () => undefined);
    render(<AnalysisCreation onCreate={onCreate} />);

    fireEvent.change(screen.getByLabelText("分析输入"), {
      target: { value: "分析这项政策为什么引发利益冲突" },
    });
    fireEvent.click(screen.getByRole("button", { name: /开始分析/ }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate.mock.calls[0][0]).toMatchObject({
      context: "分析这项政策为什么引发利益冲突",
      engine: "auto",
      inputMode: "freeform",
      web: true,
    });
  });

  it("shows a practical input tutorial without hiding it from mobile layouts", () => {
    render(<AnalysisCreation onCreate={vi.fn()} />);

    expect(screen.getByText("查看输入教程")).toBeInTheDocument();
    expect(screen.getByText("最少写清两件事")).toBeInTheDocument();
    expect(screen.getByText(/分析对象/)).toBeInTheDocument();
    expect(screen.getByText(/希望回答的问题/)).toBeInTheDocument();
    expect(screen.getByText(/材料怎么用/)).toBeInTheDocument();
  });

  it("switches examples with the analysis type and can fill the composer", () => {
    render(<AnalysisCreation onCreate={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("分析用途"), {
      target: { value: "policy" },
    });
    fireEvent.click(screen.getByRole("button", { name: "填入政策分析示例" }));

    const input = screen.getByLabelText("分析输入") as HTMLTextAreaElement;
    expect(input.value).toContain("政策要解决的问题");
    expect(input.value).toContain("执行约束");
  });
});
