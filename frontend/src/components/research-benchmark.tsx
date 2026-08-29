"use client";

import { ClipboardCheck, FlaskConical, Plus } from "lucide-react";
import React, { useEffect, useState } from "react";
import { createBenchmark, fetchBenchmarks, generateGeneralBaseline, type BenchmarkRun } from "@/lib/benchmark-api";

const candidateLabels = { system: "本系统", general: "通用 AI", human: "人工分析" } as const;
const metricRows = [
  ["actorCount", "识别主体"], ["evidenceBackedRelationCount", "有证据关系"], ["factErrorCount", "事实错误"],
  ["investigationDirectionCount", "调查方向"], ["durationSeconds", "耗时（秒）"],
] as const;

function display(value: number | null) { return value === null ? "未知" : String(value); }

export function ResearchBenchmark({ taskId, versionId }: { taskId: string; versionId?: string }) {
  const [runs, setRuns] = useState<BenchmarkRun[]>([]);
  const [open, setOpen] = useState(false);
  const [generalJson, setGeneralJson] = useState("");
  const [humanJson, setHumanJson] = useState("");
  const [generalErrors, setGeneralErrors] = useState("");
  const [humanErrors, setHumanErrors] = useState("");
  const [generalDuration, setGeneralDuration] = useState("");
  const [humanDuration, setHumanDuration] = useState("");
  const [preference, setPreference] = useState("unset");
  const [saving, setSaving] = useState(false);
  const [generatingBaseline, setGeneratingBaseline] = useState(false);
  const [generalModel, setGeneralModel] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { let live = true; void fetchBenchmarks(taskId).then((items) => { if (live) setRuns(versionId ? items.filter((item) => item.versionId === versionId) : items); }).catch(() => undefined); return () => { live = false; }; }, [taskId, versionId]);
  const latest = runs[0];

  async function submit() {
    setSaving(true); setError("");
    try {
      const general = generalJson.trim() ? JSON.parse(generalJson) : undefined;
      const human = humanJson.trim() ? JSON.parse(humanJson) : undefined;
      const audits: Record<string, { fact_error_count: number }> = {};
      if (generalErrors !== "") audits.general = { fact_error_count: Math.max(0, Number(generalErrors) || 0) };
      if (humanErrors !== "") audits.human = { fact_error_count: Math.max(0, Number(humanErrors) || 0) };
      const durations: Record<string, number> = {};
      if (generalDuration !== "") durations.general = Math.max(0, Number(generalDuration) || 0);
      if (humanDuration !== "") durations.human = Math.max(0, Number(humanDuration) || 0);
      const run = await createBenchmark(taskId, { version_id: versionId, general_snapshot: general, human_snapshot: human, audits, durations, preference, candidate_metadata: { general: { model: generalModel } } });
      setRuns((items) => [run, ...items]); setOpen(false);
    } catch (reason) {
      setError(reason instanceof SyntaxError ? "导入内容不是有效的研究账本 JSON。" : reason instanceof Error ? reason.message : "对照测试保存失败。");
    } finally { setSaving(false); }
  }

  async function generateBaseline() {
    setGeneratingBaseline(true); setError("");
    try {
      const baseline = await generateGeneralBaseline(taskId, versionId);
      setGeneralJson(JSON.stringify(baseline.snapshot, null, 2)); setGeneralDuration(String(baseline.durationSeconds)); setGeneralModel(baseline.model);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "通用 AI 基线生成失败。"); }
    finally { setGeneratingBaseline(false); }
  }

  return <section className="research-benchmark">
    <header><div><span className="eyebrow">产品评测</span><h2>同题对照测试</h2><p>同一任务、同一研究账本口径；不合成总分，也不让系统自己宣布胜者。</p></div><button type="button" className="secondary-button" onClick={() => setOpen((value) => !value)}><Plus size={15} />新建评测</button></header>
    {open && <div className="benchmark-form">
      <div><label><span>通用 AI 研究账本 JSON</span><textarea value={generalJson} onChange={(event) => setGeneralJson(event.target.value)} placeholder="可留空；导入使用同一来源完成的通用 AI 结构化结果" /></label><div className="benchmark-baseline-action"><button type="button" className="secondary-button" onClick={() => void generateBaseline()} disabled={generatingBaseline}>{generatingBaseline ? "生成中" : "用已配置模型生成中立基线"}</button>{generalModel && <span>{generalModel}</span>}</div><div className="benchmark-inline"><label><span>事实错误（人工审计）</span><input type="number" min="0" value={generalErrors} onChange={(event) => setGeneralErrors(event.target.value)} /></label><label><span>耗时（秒）</span><input type="number" min="0" value={generalDuration} onChange={(event) => setGeneralDuration(event.target.value)} /></label></div></div>
      <div><label><span>人工分析研究账本 JSON</span><textarea value={humanJson} onChange={(event) => setHumanJson(event.target.value)} placeholder="可留空；导入人工分析的结构化结果" /></label><div className="benchmark-inline"><label><span>事实错误（复核）</span><input type="number" min="0" value={humanErrors} onChange={(event) => setHumanErrors(event.target.value)} /></label><label><span>耗时（秒）</span><input type="number" min="0" value={humanDuration} onChange={(event) => setHumanDuration(event.target.value)} /></label></div></div>
      <label><span>最终偏好</span><select value={preference} onChange={(event) => setPreference(event.target.value)}><option value="unset">尚未选择</option><option value="system">本系统</option><option value="general">通用 AI</option><option value="human">人工分析</option><option value="tie">平局</option></select></label>
      {error && <p className="delivery-error" role="alert">{error}</p>}<footer><button type="button" className="secondary-button" onClick={() => setOpen(false)}>取消</button><button type="button" className="primary-button" onClick={() => void submit()} disabled={saving}><ClipboardCheck size={15} />{saving ? "保存中" : "运行比较"}</button></footer>
    </div>}
    {latest ? <div className="benchmark-result"><div className="benchmark-grid benchmark-grid--head"><span>比较维度</span>{(["system", "general", "human"] as const).map((name) => <strong key={name}>{candidateLabels[name]}</strong>)}</div>{metricRows.map(([key, label]) => <div className="benchmark-grid" key={key}><span>{label}</span>{(["system", "general", "human"] as const).map((name) => <strong className={latest.candidates[name].status === "missing" ? "is-missing" : ""} key={name}>{display(latest.candidates[name][key])}</strong>)}</div>)}<footer><span>用户偏好：{latest.preference === "unset" ? "尚未记录" : latest.preference === "tie" ? "平局" : candidateLabels[latest.preference]}</span><small>{latest.methodology.join("；")}</small></footer></div> : <div className="benchmark-empty"><FlaskConical size={19} /><div><strong>尚未建立对照基线</strong><span>可以先只保存本系统结果，后续再补通用 AI 和人工候选。</span></div></div>}
  </section>;
}
