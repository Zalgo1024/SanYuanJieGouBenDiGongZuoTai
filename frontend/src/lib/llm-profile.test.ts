import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteLlmProfile,
  fetchLlmProfile,
  getOrCreateLlmProfileId,
  saveLlmProfile,
} from "./llm-profile";

describe("browser LLM profile", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });
  });

  it("keeps one opaque profile id in the current browser", () => {
    const first = getOrCreateLlmProfileId();
    const second = getOrCreateLlmProfileId();

    expect(first).toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(20);
  });

  it("loads, saves and removes the profile without requesting the stored key", async () => {
    const request = vi.fn(async (path: string, options?: RequestInit) => {
      if (options?.method === "POST") return { has_settings: true, has_key: true, provider: "deepseek", model: "deepseek-chat", base_url: "https://api.deepseek.com", temperature: 0.3 };
      if (options?.method === "DELETE") return { has_settings: false, has_key: false, provider: "deepseek", model: "", base_url: "", temperature: 0.3 };
      return { has_settings: false, has_key: false, provider: "deepseek", model: "", base_url: "", temperature: 0.3 };
    });
    const profileId = "browser-profile-111111111111";

    await fetchLlmProfile(profileId, request);
    await saveLlmProfile(profileId, { provider: "deepseek", apiKey: "sk-private", baseUrl: "https://api.deepseek.com", model: "deepseek-chat", temperature: 0.3 }, request);
    await deleteLlmProfile(profileId, request);

    const path = `/api/settings/llm/profiles/${profileId}`;
    expect(request).toHaveBeenNthCalledWith(1, path);
    expect(request).toHaveBeenNthCalledWith(2, path, expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ provider: "deepseek", api_key: "sk-private", base_url: "https://api.deepseek.com", model: "deepseek-chat", temperature: 0.3 }),
    }));
    expect(request).toHaveBeenNthCalledWith(3, path, { method: "DELETE" });
  });
});
