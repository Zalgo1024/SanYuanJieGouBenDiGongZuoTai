"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, FileText, RefreshCw, Trash2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { analysisTypes, phaseLabels } from "@/lib/domain";
import { useAppStore } from "@/lib/store";
import { useTaskProgress } from "@/lib/realtime";
import { deleteReport } from "@/lib/workspace-api";
import { AnalysisNetwork } from "@/components/analysis-network";
import { TaskReportPreview } from "@/components/task-report-preview";

type View = "overview" | "report" | "network";

export function TaskWorkbench({ taskId }: { taskId: string }) {
  const [view, setView] = useState<View>("overview");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const router = useRouter();
  const { state, hydrated, connection, loadTask, loadReport, deleteReports } = useAppStore();
  const task = state.tasks.find((item) => item.id === taskId);

  useTaskProgress(taskId, connection !== "demo");

  useEffect(() => {
    if (hydrated && !task && connection !== "offline") {
      void loadTask(taskId);
    }
  }, [connection, hydrated, loadTask, task, taskId]);

  async function handleDelete() {
    const confirmed = window.confirm(
      "确定要永久删除这个案例吗？关联的报告、版本和生成文件都会被清除，且无法恢复。",
    );
    if (!confirmed) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteReport(taskId);
      deleteReports([taskId]);
      router.push("/dashboard");
    } catch (reason) {
      setDeleteError(reason instanceof Error ? reason.message : "删除失败，请稍后重试");
    } finally {
      setDeleting(false);
    }
  }

  if (!task) {
    if (!hydrated || connection === "checking") {
      return <section className="task-workbench" aria-busy="true" />;
    }

    if (connection === "offline") {
      return (
        <section className="empty-state">
          <span className="eyebrow">本地后端未连接</span>
          <h1>暂时无法读取这个任务</h1>
          <p>启动本项目后端后重新连接，工作台会从本机数据库读取任务和报告。</p>
          <button className="primary-button" type="button" onClick={() => void loadTask(taskId)}>
            <RefreshCw size={16} />重新读取
          </button>
        </section>
      );
    }

    return (
      <section className="empty-state">
        <span className="eyebrow">未找到分析任务</span>
        <h1>这个任务不存在或已被移除</h1>
        <p>返回新建分析，或从项目工作台选择后端仍然保留的任务。</p>
        <div>
          <Link className="primary-button" href="/analysis">新建分析</Link>
          <Link className="secondary-button" href="/dashboard">返回工作台</Link>
        </div>
      </section>
    );
  }

  const typeLabel = analysisTypes.find((item) => item.id === task.type)?.label ?? "结构分析";
  const currentPhaseIndex = Math.max(0, phaseLabels.findIndex((phase) => phase.id === task.phase));
  const currentPhase = phaseLabels[currentPhaseIndex];
  const linkedReport = state.reports.find((report) => report.taskId === task.id);
  const linkedMaterials = state.materials.filter((material) => task.materialIds.includes(material.id));
  const running = task.status === "queued" || task.status === "generating";
  const errorPhaseLabel = task.errorPhase === "quality_gate"
    ? "报告质量校验"
    : task.errorPhase === "input_validation"
      ? "输入校验"
      : phaseLabels.find((phase) => phase.id === task.errorPhase)?.label;
  const statusText = task.status === "done"
    ? linkedReport ? "任务已完成，后端当前报告版本已同步。" : "任务已完成，正在同步后端当前报告版本。"
    : task.status === "error"
      ? `后端在${errorPhaseLabel ?? currentPhase?.label ?? "当前步骤"}失败。${task.error || "请检查输入材料后重新发起分析。"}`
      : "后端正在执行分析。此处只显示任务实际返回的阶段与进度。";

  return (
    <section className="task-workbench">
      <header className="task-workbench__header">
        <div>
          <span className="eyebrow">{typeLabel} / {task.engine === "llm" ? "语言模型" : "规则引擎"}</span>
          <h1>{task.title}</h1>
          <p>{task.context || "该任务未填写补充背景，分析范围以后端收到的题目和素材为准。"}</p>
        </div>
        <div className="task-workbench__actions">
          <span className={`status-pill status-pill--${task.status === "done" ? "verified" : task.status === "error" ? "warning" : "running"}`}>
            <span />{currentPhase?.label ?? "等待后端"}
          </span>
          <button
            type="button"
            className="danger-button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            aria-label="删除这个案例"
          >
            <Trash2 size={15} />{deleting ? "删除中…" : "删除案例"}
          </button>
          {deleteError && (
            <span className="form-error task-workbench__delete-error" role="alert">
              {deleteError}
            </span>
          )}
        </div>
      </header>

      <div className="workbench-tabs" role="tablist" aria-label="分析任务视图">
        {([["overview", "总览"], ["report", "报告"], ["network", "关系网络"]] as const).map(([id, label]) => (
          <button key={id} role="tab" type="button" aria-selected={view === id} className={view === id ? "workbench-tab workbench-tab--active" : "workbench-tab"} onClick={() => setView(id)}>{label}</button>
        ))}
      </div>

      {view === "overview" && (
        <div className="workbench-overview">
          <section className="phase-panel">
            <div className="section-title">
              <div><span className="eyebrow">分析链</span><h2>六步进度</h2></div>
              <strong>{task.progress}%</strong>
            </div>
            <ol>
              {phaseLabels.map((phase, index) => (
                <li className={index < currentPhaseIndex ? "phase-item phase-item--done" : index === currentPhaseIndex ? "phase-item phase-item--active" : "phase-item"} key={phase.id}>
                  <span>{index < currentPhaseIndex ? <Check size={14} /> : String(index + 1)}</span>
                  <div><strong>{phase.label}</strong><small>{phase.note}</small></div>
                </li>
              ))}
            </ol>
          </section>

          <section className="diagnosis-panel">
            <span className="eyebrow">后端任务状态</span>
            <h2>{currentPhase?.label ?? "等待后端响应"}</h2>
            <p>{statusText}</p>
            {task.status === "error" && task.error && <p className="task-error-detail" role="alert">错误详情：{task.error}</p>}
            {task.quality && (
              <section className="quality-result" aria-label="报告质量校验结果">
                <div><strong>报告质量校验</strong><span>{task.quality.issues.filter((issue) => issue.severity === "error").length} 项错误 · {task.quality.issues.filter((issue) => issue.severity === "warning").length} 项警告</span></div>
                {task.quality.issues.length > 0 && (
                  <ul>{task.quality.issues.map((issue) => (
                    <li key={`${issue.code}-${issue.section ?? "report"}`}>
                      <strong>{issue.section ?? "全文"}</strong>
                      <span>{issue.message}</span>
                    </li>
                  ))}</ul>
                )}
              </section>
            )}
            <div>
              <span>任务状态：{task.status}</span>
              <span>分析素材：{task.materialIds.length} 项</span>
            </div>
            <div className="diagnosis-panel__actions">
              {linkedReport ? (
                <Link className="text-action" href={`/reports/${linkedReport.id}`}>阅读当前报告 <ArrowRight size={15} /></Link>
              ) : task.status === "done" ? (
                <button className="text-action" type="button" onClick={() => void loadReport(task.id)}><RefreshCw size={15} />重新同步报告</button>
              ) : running ? (
                <span className="task-run-status" role="status">等待后端生成结构化报告</span>
              ) : null}
            </div>
          </section>

          <aside className="actor-panel">
            <span className="eyebrow">任务元数据</span>
            <div className="task-metadata-row"><strong>分析类型</strong><span>{typeLabel}</span></div>
            <div className="task-metadata-row"><strong>执行引擎</strong><span>{task.engine === "llm" ? "语言模型" : "规则引擎"}</span></div>
            <div className="task-metadata-row"><strong>报告版本</strong><span>{linkedReport ? `v${linkedReport.version}` : "尚未生成"}</span></div>
          </aside>
        </div>
      )}

      {view === "report" && (
        linkedReport ? <TaskReportPreview report={linkedReport} /> : (
          <div className="workbench-report">
            <FileText size={23} />
            <div>
              <span className="eyebrow">后端结构化输出</span>
              <h2>{task.status === "done" ? "正在同步当前报告版本" : "报告尚未生成"}</h2>
              <p>{task.status === "done" ? "任务已经完成，但当前版本尚未读取成功。可重新向后端请求该任务的当前报告。" : "任务完成后，后端生成的报告会自动显示在这里。"}</p>
              {task.status === "done" && <button type="button" className="primary-button" onClick={() => void loadReport(task.id)}><RefreshCw size={16} />重新同步报告</button>}
            </div>
          </div>
        )
      )}
      {view === "network" && <AnalysisNetwork taskId={task.id} markdown={linkedReport?.markdown} materials={linkedMaterials} research={linkedReport?.research} researchStatus={linkedReport?.researchStatus} />}
    </section>
  );
}
