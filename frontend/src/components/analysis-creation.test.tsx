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
    });
  });
});
