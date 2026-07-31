// 前端本地存储：仅保存「非机密」的 LLM 偏好（模型/温度/提示词版本）+ 分析引擎模式。
// 设计（阶段四）：API Key 与 base_url 不再存前端 —— 只通过后端 /api/settings/llm 存到
// 服务端（data/llm_settings.json，已 gitignore），前端从不持有明文密钥。「API Key 不写入前端」。

const KEY_CONFIG = "tsap_llm_pref"; // 仅非机密偏好
const KEY_MODE = "tsap_engine_mode"; // "rule" | "llm"
const KEY_MODE_EXPLICIT = "tsap_engine_mode_explicit"; // 仅当用户显式点过开关才写入

export interface LlmConfig {
  model: string;
  temperature: number;
  prompt_version: string;
}

export type EngineMode = "rule" | "llm";

export function getLlmConfig(): LlmConfig {
  if (typeof window === "undefined")
    return { model: "deepseek-chat", temperature: 0.7, prompt_version: "" };
  try {
    const raw = localStorage.getItem(KEY_CONFIG);
    if (raw) return JSON.parse(raw) as LlmConfig;
  } catch {
    /* ignore */
  }
  return { model: "deepseek-chat", temperature: 0.7, prompt_version: "" };
}

export function setLlmConfig(cfg: LlmConfig) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY_CONFIG, JSON.stringify(cfg));
}

export function getEngineMode(): EngineMode {
  if (typeof window === "undefined") return "rule";
  return localStorage.getItem(KEY_MODE) === "llm" ? "llm" : "rule";
}

/** 仅当用户显式点过引擎开关才返回其选择；否则返回 null（表示「未显式选择」，应由 LLM 配置决定默认）。 */
export function getExplicitEngineMode(): EngineMode | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(KEY_MODE_EXPLICIT);
  return v === "llm" || v === "rule" ? v : null;
}

export function setEngineMode(mode: EngineMode) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY_MODE, mode);
  localStorage.setItem(KEY_MODE_EXPLICIT, mode);
}

// 一键预设：填好各家默认 base_url / model，输入框本身仍可改（支持任意 OpenAI 兼容端点）
export const LLM_PRESETS: { name: string; baseUrl: string; model: string }[] = [
  { name: "DeepSeek", baseUrl: "https://api.deepseek.com", model: "deepseek-chat" },
  { name: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o" },
  { name: "Groq", baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
  { name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-4o" },
  { name: "Ollama 本地", baseUrl: "http://localhost:11434/v1", model: "qwen2.5" },
];

// 六类利益（与 theory_config / 网络图配色一致）
export const INTEREST_OPTIONS: { id: string; name: string }[] = [
  { id: "material", name: "物质利益" },
  { id: "security", name: "安全利益" },
  { id: "political", name: "政治利益" },
  { id: "identity_culture", name: "身份文化利益" },
  { id: "institutional_future", name: "制度性未来利益" },
  { id: "public", name: "公共利益" },
];

// 四类链线（关系类型）
export const RELATION_TYPES: { id: string; name: string }[] = [
  { id: "economic", name: "经济路径" },
  { id: "power", name: "权力路径" },
  { id: "cultural", name: "文化路径" },
  { id: "legal", name: "法律路径" },
];
