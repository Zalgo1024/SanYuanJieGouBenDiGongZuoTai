"use client";

import { CheckCircle2, Eye, EyeOff, KeyRound, Trash2 } from "lucide-react";
import React from "react";
import { useEffect, useState } from "react";
import {
  deleteLlmProfile,
  fetchLlmProfile,
  getOrCreateLlmProfileId,
  saveLlmProfile,
  testLlmConnection,
  type LlmProfileSummary,
  type LlmProvider,
} from "@/lib/llm-profile";

interface ProviderPreset {
  label: string;
  baseUrl: string;
  models: string[];
  /** 官方注册地址/控制台，用于引导访客自行取得 API Key；自定义接口留空。 */
  signupUrl: string;
}

/** 全部走 OpenAI 兼容协议；provider 只决定预设地址与常用模型候选。 */
const PROVIDER_PRESETS: Record<LlmProvider, ProviderPreset> = {
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    models: ["deepseek-chat", "deepseek-reasoner"],
    signupUrl: "https://platform.deepseek.com",
  },
  zhipu: {
    label: "智谱 GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    models: ["glm-4.6", "glm-4-air", "glm-4-flash"],
    signupUrl: "https://open.bigmodel.cn",
  },
  qwen: {
    label: "通义千问",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: ["qwen-plus", "qwen-max", "qwen-flash"],
    signupUrl: "https://dashscope.aliyun.com",
  },
  kimi: {
    label: "Kimi（月之暗面）",
    baseUrl: "https://api.moonshot.cn/v1",
    models: ["moonshot-v1-32k", "kimi-k2-0905-preview"],
    signupUrl: "https://platform.moonshot.cn",
  },
  siliconflow: {
    label: "硅基流动",
    baseUrl: "https://api.siliconflow.cn/v1",
    models: ["deepseek-ai/DeepSeek-V3", "Qwen/Qwen2.5-72B-Instruct"],
    signupUrl: "https://cloud.siliconflow.cn",
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    models: ["openrouter/auto"],
    signupUrl: "https://openrouter.ai",
  },
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4o-mini", "gpt-4o"],
    signupUrl: "https://platform.openai.com",
  },
  ollama: {
    label: "本地 Ollama",
    baseUrl: "http://127.0.0.1:11434/v1",
    models: ["qwen3:8b", "llama3.1"],
    signupUrl: "https://ollama.com",
  },
  compatible: {
    label: "自定义（OpenAI 兼容）",
    baseUrl: "",
    models: [],
    signupUrl: "",
  },
};

const providerDefaults: Record<LlmProvider, { baseUrl: string; model: string }> =
  Object.fromEntries(
    (Object.keys(PROVIDER_PRESETS) as LlmProvider[]).map((key) => [
      key,
      {
        baseUrl: PROVIDER_PRESETS[key].baseUrl,
        model: PROVIDER_PRESETS[key].models[0] ?? "",
      },
    ]),
  ) as Record<LlmProvider, { baseUrl: string; model: string }>;

type TestState = "idle" | "testing" | "ok" | "fail";

const emptySummary: LlmProfileSummary = {
  has_settings: false,
  has_key: false,
  provider: "deepseek",
  model: "",
  base_url: "",
  temperature: 0.3,
};

export function temperatureGuidance(value: number) {
  const temperature = Number.isFinite(value) ? value : 0.3;
  if (temperature <= 0.2) return { label: "严谨稳定", detail: "输出更稳定，适合事实核对与政策材料" };
  if (temperature <= 0.5) return { label: "均衡分析", detail: "兼顾稳定与自然表达，适合正式分析报告" };
  if (temperature <= 0.8) return { label: "发散表达", detail: "表达更丰富，但结论稳定性会下降" };
  return { label: "创意探索", detail: "随机性较高，更适合创意探索而非正式报告" };
}

export function LlmConnectionSettings() {
  const [profileId, setProfileId] = useState("");
  const [summary, setSummary] = useState<LlmProfileSummary>(emptySummary);
  const [provider, setProvider] = useState<LlmProvider>("deepseek");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(providerDefaults.deepseek.baseUrl);
  const [model, setModel] = useState(providerDefaults.deepseek.model);
  const [temperature, setTemperature] = useState(0.3);
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [testState, setTestState] = useState<TestState>("idle");
  const [testMessage, setTestMessage] = useState("");

  useEffect(() => {
    const id = getOrCreateLlmProfileId();
    setProfileId(id);
    void fetchLlmProfile(id)
      .then((current) => {
        setSummary(current);
        setProvider(current.provider);
        setBaseUrl(current.base_url || providerDefaults[current.provider].baseUrl);
        setModel(current.model || providerDefaults[current.provider].model);
        setTemperature(current.temperature ?? 0.3);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "无法读取 AI 连接配置。"))
      .finally(() => setLoading(false));
  }, []);

  function changeProvider(next: LlmProvider) {
    setProvider(next);
    setBaseUrl(providerDefaults[next].baseUrl);
    setModel(providerDefaults[next].model);
    setMessage("");
    setTestState("idle");
    setTestMessage("");
  }

  async function testConnection() {
    const hasKey = summary.has_key || apiKey.trim().length > 0;
    if (!baseUrl.trim() || !model.trim() || !hasKey) {
      setTestState("fail");
      setTestMessage("请先填写 API 地址、模型名称和密钥再测试。");
      return;
    }
    setTestState("testing");
    setTestMessage("");
    try {
      const result = await testLlmConnection({
        provider,
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim(),
        model: model.trim(),
        profileId: apiKey.trim() ? undefined : profileId,
      });
      setTestState(result.ok ? "ok" : "fail");
      setTestMessage(result.message);
    } catch (reason) {
      setTestState("fail");
      setTestMessage(reason instanceof Error ? reason.message : "测试请求失败。");
    }
  }

  async function saveConnection() {
    if (!profileId || !baseUrl.trim() || !model.trim() || (!summary.has_key && !apiKey.trim())) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const current = await saveLlmProfile(profileId, {
        provider,
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim(),
        model: model.trim(),
        temperature,
      });
      setSummary(current);
      setApiKey("");
      setShowKey(false);
      setMessage("AI 连接已保存，之后的新分析只会使用这份配置。 ");
      setTestState("idle");
      setTestMessage("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "AI 连接保存失败。 ");
    } finally {
      setSaving(false);
    }
  }

  async function removeConnection() {
    if (!profileId || !window.confirm("移除当前浏览器保存的 AI API 连接？之后自由输入分析将无法运行，直到重新配置。")) return;
    setSaving(true);
    setError("");
    try {
      const current = await deleteLlmProfile(profileId);
      setSummary(current);
      setApiKey("");
      setMessage("AI 连接已移除。 ");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "AI 连接移除失败。 ");
    } finally {
      setSaving(false);
    }
  }

  const missingRequired = !baseUrl.trim() || !model.trim() || (!summary.has_key && !apiKey.trim());
  const temperatureHelp = temperatureGuidance(temperature);

  return <div className="llm-connection">
    <div className="llm-connection__intro">
      <span className="eyebrow">AI API 连接</span>
      <div className="llm-connection__title-row">
        <h2>使用你自己的模型额度</h2>
        <span className={`connection-state${summary.has_key ? " connection-state--ready" : ""}`}>
          {summary.has_key ? <CheckCircle2 size={14} /> : <KeyRound size={14} />}
          {loading ? "读取中" : summary.has_key ? "已配置" : "未配置"}
        </span>
      </div>
      <p>每个浏览器独立配置。密钥保存后不会回显，也不会写入分析任务、报告或关系图；未配置时，系统不会改用服务器管理员的 AI 密钥。</p>
    </div>
    <div className="llm-connection__form">
      <label><span>接口类型</span><select aria-label="AI 接口类型" value={provider} onChange={(event) => changeProvider(event.target.value as LlmProvider)} disabled={loading || saving}>{(Object.keys(PROVIDER_PRESETS) as LlmProvider[]).map((key) => <option key={key} value={key}>{PROVIDER_PRESETS[key].label}</option>)}</select>
        {PROVIDER_PRESETS[provider].signupUrl && (
          <small className="llm-provider-hint">
            还没有 Key？<a href={PROVIDER_PRESETS[provider].signupUrl} target="_blank" rel="noreferrer noopener">前往 {PROVIDER_PRESETS[provider].label} 官网</a> 注册并在控制台创建即可。各家是否提供免费额度、额度多少，以官网公示为准。
          </small>
        )}
      </label>
      <label className="llm-field--wide"><span>API Key</span><div className="secret-input"><input aria-label="AI API Key" type={showKey ? "text" : "password"} value={apiKey} onChange={(event) => setApiKey(event.target.value)} autoComplete="new-password" placeholder={summary.has_key ? "已保存；留空则继续使用原密钥" : "粘贴你的 API Key"} /><button type="button" onClick={() => setShowKey((current) => !current)} aria-label={showKey ? "隐藏 API Key" : "显示 API Key"}>{showKey ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
      <label className="llm-field--wide"><span>API 地址</span><input aria-label="AI API 地址" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.example.com/v1" /></label>
      <label><span>模型名称</span><input aria-label="AI 模型名称" value={model} onChange={(event) => setModel(event.target.value)} placeholder="模型 ID" list="llm-model-options" /></label>
      <datalist id="llm-model-options">{(PROVIDER_PRESETS[provider]?.models ?? []).map((candidate) => <option key={candidate} value={candidate} />)}</datalist>
      <label className="temperature-field">
        <span className="temperature-field__title"><span>生成温度</span><strong>{temperatureHelp.label}</strong></span>
        <input aria-label="AI 生成温度" type="number" min="0" max="2" step="0.1" value={temperature} onChange={(event) => setTemperature(Number(event.target.value))} />
        <small>控制表达随机性，不代表分析深度。正式报告建议 0.2–0.4，默认 0.3；当前设置会让{temperatureHelp.detail}。</small>
      </label>
      <div className="llm-connection__actions">
        <button className="primary-button" type="button" onClick={() => void saveConnection()} disabled={loading || saving || missingRequired}><KeyRound size={16} />{saving ? "处理中" : summary.has_key ? "更新连接" : "保存连接"}</button>
        <button className="secondary-button" type="button" onClick={() => void testConnection()} disabled={loading || saving || testState === "testing"}>{testState === "testing" ? "测试中…" : "测试连接"}</button>
        {summary.has_key && <button className="danger-text-button" type="button" onClick={() => void removeConnection()} disabled={saving}><Trash2 size={15} />移除密钥</button>}
      </div>
      {testMessage && <p className={testState === "ok" ? "form-success" : "form-error"} role="status">{testState === "ok" ? "✓ " : "✕ "}{testMessage}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  </div>;
}
