"use client";

import { useState, useEffect } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  getLlmConfig,
  setLlmConfig,
  getEngineMode,
  setEngineMode,
  LLM_PRESETS,
  type EngineMode,
} from "@/lib/llmConfig";
import {
  getLlmSettings,
  saveLlmSettings,
  type LlmSettingsPublic,
} from "@/lib/api";

const inputCls =
  "w-full h-10 rounded-input bg-inputbg border border-cardborder px-3 text-[13px] text-ink outline-none focus:border-navy placeholder:text-muted";

// 设置页本地编辑态（密钥仅在保存瞬间经网络发给后端，提交后立即从内存清空，不落 localStorage）
interface LlmForm {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  prompt_version: string;
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-11 h-6 rounded-full transition-colors ${
        on ? "bg-toggleon" : "bg-toggleoff"
      } relative`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
          on ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[13px] font-medium text-ink mb-1.5">{label}</div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const [user, setUser] = useState("未登录");
  useEffect(() => {
    const u = localStorage.getItem("tsap_user");
    if (u) setUser(u);
  }, []);

  // 引擎模式（本地非机密偏好）
  const [engineMode, setMode] = useState<EngineMode>("rule");
  // LLM 表单（含密钥，仅编辑态；保存后清空 key）
  const [cfg, setCfg] = useState<LlmForm>({
    provider: "deepseek",
    baseUrl: "",
    apiKey: "",
    model: "deepseek-chat",
    temperature: 0.7,
    prompt_version: "",
  });
  // 后端脱敏概览（是否配置、模型、脱敏地址…）
  const [pub, setPub] = useState<LlmSettingsPublic | null>(null);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setMode(getEngineMode());
    const c = getLlmConfig();
    setCfg((f) => ({
      ...f,
      model: c.model || "deepseek-chat",
      temperature: c.temperature ?? 0.7,
      prompt_version: c.prompt_version || "",
    }));
    getLlmSettings()
      .then((p) => {
        setPub(p);
        if (p.model) setCfg((f) => ({ ...f, model: p.model }));
        if (p.prompt_version) setCfg((f) => ({ ...f, prompt_version: p.prompt_version }));
        if (p.temperature != null) setCfg((f) => ({ ...f, temperature: p.temperature as number }));
      })
      .catch(() => {});
  }, []);

  const switchMode = (m: EngineMode) => {
    setMode(m);
    setEngineMode(m);
  };

  const onSave = async () => {
    setErr("");
    try {
      // 1) 非机密偏好存本地（供分析页读取模型/温度/提示词版本）
      setLlmConfig({
        model: cfg.model,
        temperature: cfg.temperature,
        prompt_version: cfg.prompt_version,
      });
      setEngineMode(engineMode);
      // 2) 完整设置（含密钥）提交后端；留空字段表示不修改服务端已有值
      const pubRes = await saveLlmSettings({
        provider: cfg.provider,
        api_key: cfg.apiKey || undefined,
        base_url: cfg.baseUrl || undefined,
        model: cfg.model,
        temperature: cfg.temperature,
        prompt_version: cfg.prompt_version,
      });
      setPub(pubRes);
      setSaved(true);
      setCfg((c) => ({ ...c, apiKey: "" })); // 提交后立即清空本地密钥
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <AppShell title="设置">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-5">
          <h1 className="text-[22px] font-bold text-ink">设置</h1>
          <p className="text-[13px] text-sub mt-1">配置分析偏好、账号与 AI 引擎</p>
        </div>

        <div className="grid grid-cols-2 gap-5">
          {/* Left */}
          <div className="flex flex-col gap-5">
            <div className="card p-5">
              <h2 className="text-[15px] font-semibold text-ink mb-4">通用设置</h2>
              <div className="flex flex-col gap-4">
                <Row label="默认分析层级">
                  <div className="flex gap-2 flex-wrap">
                    {["组织", "事件", "政策"].map((o) => (
                      <button key={o} className="h-9 px-3 rounded-input text-[13px] border border-cardborder text-sub hover:bg-[#F3F4F6]">
                        {o}
                      </button>
                    ))}
                  </div>
                </Row>
                <Row label="默认权重体系">
                  <div className="flex gap-2 flex-wrap">
                    {["中国", "通用"].map((o) => (
                      <button key={o} className="h-9 px-3 rounded-input text-[13px] border border-cardborder text-sub hover:bg-[#F3F4F6]">
                        {o}
                      </button>
                    ))}
                  </div>
                </Row>
                <Row label="默认分析深度">
                  <div className="flex gap-2 flex-wrap">
                    {["快速", "标准", "深入"].map((o) => (
                      <button key={o} className="h-9 px-3 rounded-input text-[13px] border border-cardborder text-sub hover:bg-[#F3F4F6]">
                        {o}
                      </button>
                    ))}
                  </div>
                </Row>
                <Row label="默认报告语言">
                  <select className={inputCls} defaultValue="简体中文">
                    <option>简体中文</option>
                    <option>English</option>
                  </select>
                </Row>
              </div>
            </div>

            <div className="card p-5">
              <h2 className="text-[15px] font-semibold text-ink mb-4">AI 引擎</h2>
              <div className="flex flex-col gap-4">
                {/* 引擎模式 */}
                <Row label="分析引擎">
                  <div className="flex gap-2">
                    <button
                      onClick={() => switchMode("rule")}
                      className={`flex-1 h-11 rounded-input text-[13px] border ${
                        engineMode === "rule"
                          ? "border-navy bg-[#F0F4FA] text-navy font-medium"
                          : "border-cardborder text-sub hover:bg-[#F3F4F6]"
                      }`}
                    >
                      内置规则引擎
                      <div className="text-[11px] font-normal mt-0.5 opacity-80">
                        离线 · 无需 API
                      </div>
                    </button>
                    <button
                      onClick={() => switchMode("llm")}
                      className={`flex-1 h-11 rounded-input text-[13px] border ${
                        engineMode === "llm"
                          ? "border-navy bg-[#F0F4FA] text-navy font-medium"
                          : "border-cardborder text-sub hover:bg-[#F3F4F6]"
                      }`}
                    >
                      AI 模型（增强）
                      <div className="text-[11px] font-normal mt-0.5 opacity-80">
                        服务端保存 Key
                      </div>
                    </button>
                  </div>
                </Row>

                {engineMode === "rule" ? (
                  <div className="rounded-input bg-[#E8F5E9] border border-[#A5D6A7] px-3 py-3 text-[12px] text-[#2E7D32] leading-relaxed">
                    当前使用<strong>内置规则引擎</strong>：程序按「三元结构理论」直接生成分析，
                    完全离线、不需要任何 API Key。结构化输入请在「自动生成向导」中填写。
                  </div>
                ) : (
                  <>
                    {/* 服务端密钥状态 */}
                    <div className="rounded-input bg-[#F0F4FA] border border-navy/20 px-3 py-2 text-[12px] text-navy leading-relaxed">
                      {pub?.has_key ? (
                        <>
                          已配置密钥（{pub.provider} · 模型 {pub.model || "—"}）
                          {pub.base_url_masked ? ` · 端点 ${pub.base_url_masked}` : ""}
                        </>
                      ) : (
                        "尚未在服务端配置密钥"
                      )}
                      。密钥仅保存在后端（data/llm_settings.json，不入库、不进前端代码），前端永不持有明文。
                    </div>

                    <Row label="服务商（决定 base_url 默认值）">
                      <select
                        className={inputCls}
                        value={cfg.provider}
                        onChange={(e) => setCfg({ ...cfg, provider: e.target.value })}
                      >
                        <option value="deepseek">DeepSeek</option>
                        <option value="openai">OpenAI</option>
                      </select>
                    </Row>

                    <div>
                      <div className="text-[12px] text-sub mb-1.5">一键预设（可改）</div>
                      <div className="flex gap-2 flex-wrap">
                        {LLM_PRESETS.map((p) => (
                          <button
                            key={p.name}
                            onClick={() =>
                              setCfg((c) => ({ ...c, baseUrl: p.baseUrl, model: p.model }))
                            }
                            className="h-9 px-3 rounded-input text-[13px] border border-cardborder text-sub hover:bg-[#F3F4F6]"
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <Row label="API Base URL（任意 OpenAI 兼容端点）">
                      <input
                        className={inputCls}
                        placeholder="https://api.deepseek.com 或 http://localhost:11434/v1"
                        value={cfg.baseUrl}
                        onChange={(e) => setCfg({ ...cfg, baseUrl: e.target.value })}
                      />
                    </Row>
                    <Row label="API Key（保存后仅留于服务端）">
                      <input
                        className={inputCls}
                        type="password"
                        placeholder={pub?.has_key ? "已配置；留空表示保持不变" : "sk-...（保存时发往服务端）"}
                        value={cfg.apiKey}
                        onChange={(e) => setCfg({ ...cfg, apiKey: e.target.value })}
                      />
                    </Row>
                    <Row label="模型名称（自由填写）">
                      <input
                        className={inputCls}
                        placeholder="deepseek-chat / gpt-4o / qwen2.5 …"
                        value={cfg.model}
                        onChange={(e) => setCfg({ ...cfg, model: e.target.value })}
                      />
                    </Row>
                    <div className="grid grid-cols-2 gap-3">
                      <Row label="采样温度">
                        <input
                          className={inputCls}
                          type="number"
                          step="0.1"
                          min="0"
                          max="2"
                          value={cfg.temperature}
                          onChange={(e) =>
                            setCfg({ ...cfg, temperature: Number(e.target.value) || 0.7 })
                          }
                        />
                      </Row>
                      <Row label="提示词版本">
                        <input
                          className={inputCls}
                          placeholder="留空=最新 (1.0)"
                          value={cfg.prompt_version}
                          onChange={(e) => setCfg({ ...cfg, prompt_version: e.target.value })}
                        />
                      </Row>
                    </div>

                    <div className="rounded-input bg-[#FFF8E1] border border-[#F0D98C] px-3 py-2.5 text-[12px] text-[#8a6d1f] leading-relaxed">
                      密钥仅在此保存时经网络发往本地后端并存入服务端文件，浏览器不持久化明文。
                      Ollama 本地模型可留空 Key。若服务端未配置密钥，选「AI 模型」发起分析会自动降级到规则引擎。
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="flex flex-col gap-5">
            <div className="card p-5">
              <h2 className="text-[15px] font-semibold text-ink mb-4">账号</h2>
              <div className="flex flex-col gap-4">
                <Row label="当前账号">
                  <input className={inputCls} value={user} readOnly />
                </Row>
                <Row label="说明">
                  <div className="text-[12px] text-sub leading-relaxed">
                    当前为前端占位登录（任意账号密码即可进入）。正式会员 / 多用户隔离将在后端「会员系统」阶段接入，
                    届时每用户的 AI Key 将独立保存。
                  </div>
                </Row>
              </div>
            </div>

            <div className="card p-5">
              <h2 className="text-[15px] font-semibold text-ink mb-4">主题与显示</h2>
              <div className="flex flex-col gap-4">
                <Row label="图表配色">
                  <div className="flex gap-2 flex-wrap">
                    {["六类利益标准色", "单色渐变"].map((o) => (
                      <button key={o} className="h-9 px-3 rounded-input text-[13px] border border-cardborder text-sub hover:bg-[#F3F4F6]">
                        {o}
                      </button>
                    ))}
                  </div>
                </Row>
              </div>
            </div>

            <div className="card p-5">
              <h2 className="text-[15px] font-semibold text-ink mb-4">通知与协作</h2>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-ink">报告生成完成通知</span>
                  <Toggle on={true} onClick={() => {}} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-ink">每周利益格局摘要</span>
                  <Toggle on={false} onClick={() => {}} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Save bar */}
        <div className="card mt-5 h-16 px-5 flex items-center justify-end gap-2">
          {err && <span className="text-[13px] text-[#C62828] mr-2">{err}</span>}
          {saved && <span className="text-[13px] text-[#2E7D32] mr-2">已保存（服务端）✓</span>}
          <button className="btn-ghost h-9 px-4 text-[13px]" onClick={() => {
            setMode(getEngineMode());
            const c = getLlmConfig();
            setCfg((f) => ({ ...f, model: c.model, temperature: c.temperature ?? 0.7, prompt_version: c.prompt_version, apiKey: "" }));
          }}>
            放弃更改
          </button>
          <button className="btn-primary h-9 px-5 text-[13px]" onClick={onSave}>
            保存设置
          </button>
        </div>
      </div>
    </AppShell>
  );
}
