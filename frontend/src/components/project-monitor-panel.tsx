"use client";

import { BellRing, Play, Save } from "lucide-react";
import React, { useEffect, useState } from "react";
import type { ProjectMonitor } from "@/lib/domain";
import { fetchProjectMonitor, runProjectMonitor, updateProjectMonitor } from "@/lib/workspace-api";

function formatMoment(value?: string) {
  if (!value) return "尚未运行";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function ProjectMonitorPanel({ projectId, seedTaskId }: { projectId: string; seedTaskId?: string }) {
  const [monitor, setMonitor] = useState<ProjectMonitor>();
  const [enabled, setEnabled] = useState(false);
  const [intervalHours, setIntervalHours] = useState(24);
  const [busy, setBusy] = useState<"load" | "save" | "run" | "">("load");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setBusy("load");
    fetchProjectMonitor(projectId).then((value) => {
      if (!active) return;
      setMonitor(value); setEnabled(value.enabled); setIntervalHours(value.intervalHours);
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "追踪状态读取失败。"); }).finally(() => { if (active) setBusy(""); });
    return () => { active = false; };
  }, [projectId]);

  async function save() {
    setBusy("save"); setError(""); setNotice("");
    try {
      const value = await updateProjectMonitor(projectId, { enabled, intervalHours, seedTaskId });
      setMonitor(value); setEnabled(value.enabled); setIntervalHours(value.intervalHours); setNotice("追踪设置已保存。");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "追踪设置保存失败。"); }
    finally { setBusy(""); }
  }

  async function run() {
    setBusy("run"); setError(""); setNotice("");
    try {
      const value = await runProjectMonitor(projectId);
      setNotice(`已创建复盘任务 ${value.taskId}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "复盘任务创建失败。"); }
    finally { setBusy(""); }
  }

  return <section className="project-monitor-panel">
    <header><div><span className="eyebrow">本机自动研究</span><h2>持续追踪与复盘</h2><p>按设定频率重新检索公开信息，并将新增主体、关系变化和判断失效写入新版本。</p></div><BellRing size={22} /></header>
    {busy === "load" ? <p aria-busy="true">正在读取追踪设置...</p> : <>
      <div className="project-monitor-controls"><label className="monitor-toggle"><input type="checkbox" aria-label="启用持续追踪" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /><span>启用持续追踪</span></label><label><span>检查频率</span><select aria-label="检查频率" value={intervalHours} onChange={(event) => setIntervalHours(Number(event.target.value))}><option value={6}>每 6 小时</option><option value={12}>每 12 小时</option><option value={24}>每天</option><option value={72}>每 3 天</option><option value={168}>每周</option></select></label><button className="secondary-button" type="button" aria-label="保存追踪设置" onClick={() => void save()} disabled={Boolean(busy)}><Save size={15} />{busy === "save" ? "保存中" : "保存设置"}</button><button className="primary-button" type="button" aria-label="立即检查新信息" onClick={() => void run()} disabled={Boolean(busy) || !monitor?.configured}><Play size={15} />{busy === "run" ? "创建中" : "立即复盘"}</button></div>
      <dl className="project-monitor-status"><div><dt>上次运行</dt><dd>{formatMoment(monitor?.lastRunAt)}</dd></div><div><dt>下次检查</dt><dd>{enabled ? formatMoment(monitor?.nextRunAt) : "未启用"}</dd></div><div><dt>最近状态</dt><dd>{monitor?.lastError ? "运行失败" : monitor?.lastSuccessTaskId ? "已完成" : "等待首次复盘"}</dd></div></dl>
      {monitor?.latestChange?.summary?.length ? <div className="project-monitor-changes"><strong>最近变化</strong>{monitor.latestChange.summary.slice(0, 5).map((item) => <p key={item}>{item}</p>)}</div> : <p className="project-monitor-empty">还没有可比较的新旧研究快照。</p>}
    </>}
    {notice && <p className="delivery-notice" role="status">{notice}</p>}
    {error && <p className="delivery-error" role="alert">{error}</p>}
  </section>;
}
