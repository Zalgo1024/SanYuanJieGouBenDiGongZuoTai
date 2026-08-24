import { apiRequest } from "./api";

const PROFILE_STORAGE_KEY = "triad.llm-profile-id";

export type LlmProvider = "deepseek" | "openai" | "compatible";

export interface LlmProfileSummary {
  has_settings: boolean;
  has_key: boolean;
  provider: LlmProvider;
  model: string;
  base_url: string;
  temperature: number | null;
  prompt_version?: string;
}

export interface LlmProfileInput {
  provider: LlmProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
}

type LlmProfileRequest = (path: string, options?: RequestInit) => Promise<unknown>;

function fallbackProfileId() {
  const random = Math.random().toString(36).slice(2);
  return `browser-${Date.now().toString(36)}-${random}-${random}`;
}

export function getOrCreateLlmProfileId(): string {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem(PROFILE_STORAGE_KEY);
  if (existing && existing.length >= 20) return existing;
  const profileId = typeof window.crypto?.randomUUID === "function"
    ? window.crypto.randomUUID()
    : fallbackProfileId();
  window.localStorage.setItem(PROFILE_STORAGE_KEY, profileId);
  return profileId;
}

function profilePath(profileId: string) {
  return `/api/settings/llm/profiles/${encodeURIComponent(profileId)}`;
}

export async function fetchLlmProfile(
  profileId: string,
  request: LlmProfileRequest = apiRequest,
): Promise<LlmProfileSummary> {
  return await request(profilePath(profileId)) as LlmProfileSummary;
}

export async function saveLlmProfile(
  profileId: string,
  input: LlmProfileInput,
  request: LlmProfileRequest = apiRequest,
): Promise<LlmProfileSummary> {
  return await request(profilePath(profileId), {
    method: "POST",
    body: JSON.stringify({
      provider: input.provider,
      api_key: input.apiKey,
      base_url: input.baseUrl,
      model: input.model,
      temperature: input.temperature,
    }),
  }) as LlmProfileSummary;
}

export async function deleteLlmProfile(
  profileId: string,
  request: LlmProfileRequest = apiRequest,
): Promise<LlmProfileSummary> {
  return await request(profilePath(profileId), { method: "DELETE" }) as LlmProfileSummary;
}
