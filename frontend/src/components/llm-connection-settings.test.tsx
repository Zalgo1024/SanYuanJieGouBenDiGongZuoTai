import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { LlmConnectionSettings, temperatureGuidance } from "./llm-connection-settings";

vi.mock("@/lib/llm-profile", () => ({
  getOrCreateLlmProfileId: () => "test-profile",
  fetchLlmProfile: vi.fn(async () => ({
    has_settings: false,
    has_key: false,
    provider: "deepseek",
    model: "",
    base_url: "",
    temperature: 0.3,
  })),
  saveLlmProfile: vi.fn(),
  deleteLlmProfile: vi.fn(),
}));

describe("LlmConnectionSettings temperature guidance", () => {
  it("maps temperature ranges to plain-language use cases", () => {
    expect(temperatureGuidance(0.1).label).toBe("严谨稳定");
    expect(temperatureGuidance(0.3).label).toBe("均衡分析");
    expect(temperatureGuidance(0.7).label).toBe("发散表达");
    expect(temperatureGuidance(1.2).label).toBe("创意探索");
  });

  it("explains the setting and updates the current range", async () => {
    render(<LlmConnectionSettings />);
    await waitFor(() => expect(screen.getByText("均衡分析")).toBeInTheDocument());

    expect(screen.getByText(/控制表达随机性，不代表分析深度/)).toBeInTheDocument();
    expect(screen.getByText(/正式报告建议 0.2–0.4/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("AI 生成温度"), {
      target: { value: "0.7" },
    });
    expect(screen.getByText("发散表达")).toBeInTheDocument();
  });
});
