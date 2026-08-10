import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest } from "./api";


afterEach(() => vi.unstubAllGlobals());


describe("apiRequest error envelope", () => {
  it("surfaces backend input-validation details from the nested error envelope", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      error: {
        code: "invalid_structured_input",
        message: "结构化录入缺少生成正式报告所需的数据。",
        phase: "input_validation",
        details: ["至少 2 个利益主体", "带来源的证据"],
      },
    }), { status: 422, headers: { "Content-Type": "application/json" } })));

    await expect(apiRequest("/api/analyze", { method: "POST" })).rejects.toMatchObject({
      code: "invalid_structured_input",
      status: 422,
      phase: "input_validation",
      details: ["至少 2 个利益主体", "带来源的证据"],
      message: "结构化录入缺少生成正式报告所需的数据。 至少 2 个利益主体；带来源的证据",
    });
  });
});
