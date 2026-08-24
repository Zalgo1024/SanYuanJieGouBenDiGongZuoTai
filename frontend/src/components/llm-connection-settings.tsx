"use client";

import { CheckCircle2, Eye, EyeOff, KeyRound, Trash2 } from "lucide-react";
import React from "react";
import { useEffect, useState } from "react";
import {
  deleteLlmProfile,
  fetchLlmProfile,
  getOrCreateLlmProfileId,
  saveLlmProfile,
  type LlmProfileSummary,
  type LlmProvider,
} from "@/lib/llm-profile";

const providerDefaults: Record<LlmProvider, { baseUrl: string; model: string }> = {
  deepseek: { baseUrl: "https://api.deepseek.com", model: "deepseek-chat" },
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  compatible: { baseUrl: "", model: "" },
};

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
      <label><span>接口类型</span><select aria-label="AI 接口类型" value={provider} onChange={(event) => changeProvider(event.target.value as LlmProvider)} disabled={loading || saving}><option value="deepseek">DeepSeek</option><option value="openai">OpenAI</option><option value="compatible">OpenAI 兼容接口</option></select></label>
      <label className="llm-field--wide"><span>API Key</span><div className="secret-input"><input aria-label="AI API Key" type={showKey ? "text" : "password"} value={apiKey} onChange={(event) => setApiKey(event.target.value)} autoComplete="new-password" placeholder={summary.has_key ? "已保存；留空则继续使用原密钥" : "粘贴你的 API Key"} /><button type="button" onClick={() => setShowKey((current) => !current)} aria-label={showKey ? "隐藏 API Key" : "显示 API Key"}>{showKey ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
      <label className="llm-field--wide"><span>API 地址</span><input aria-label="AI API 地址" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.example.com/v1" /></label>
      <label><span>模型名称</span><input aria-label="AI 模型名称" value={model} onChange={(event) => setModel(event.target.value)} placeholder="模型 ID" /></label>
      <label className="temperature-field">
        <span className="temperature-field__title"><span>生成温度</span><strong>{temperatureHelp.label}</strong></span>
        <input aria-label="AI 生成温度" type="number" min="0" max="2" step="0.1" value={temperature} onChange={(event) => setTemperature(Number(event.target.value))} />
        <small>控制表达随机性，不代表分析深度。正式报告建议 0.2–0.4，默认 0.3；当前设置会让{temperatureHelp.detail}。</small>
      </label>
      <div className="llm-connection__actions">
        <button className="primary-button" type="button" onClick={() => void saveConnection()} disabled={loading || saving || missingRequired}><KeyRound size={16} />{saving ? "处理中" : summary.has_key ? "更新连接" : "保存连接"}</button>
        {summary.has_key && <button className="danger-text-button" type="button" onClick={() => void removeConnection()} disabled={saving}><Trash2 size={15} />移除密钥</button>}
      </div>
      {message && <p className="form-success" role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  </div>;
}
