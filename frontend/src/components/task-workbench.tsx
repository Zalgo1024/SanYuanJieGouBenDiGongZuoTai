"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, CircleDot, FileText, ShieldCheck } from "lucide-react";
import React, { useState } from "react";
import { analysisTypes, phaseLabels, type AnalysisType } from "@/lib/domain";
import { useAppStore } from "@/lib/store";
import { useTaskProgress } from "@/lib/realtime";
import { AnalysisNetwork } from "@/components/analysis-network";
import { TaskReportPreview } from "@/components/task-report-preview";

type View = "overview" | "report" | "network";

const workbenchCopy: Record<AnalysisType, {
  diagnosis: string;
  detail: string;
  risk: string;
  actors: string[];
  network: string;
}> = {
  case: {
    diagnosis: "制度信任是协商成败的关键杠杆",
    detail: "补偿、风险监测与程序承诺需要同步落地，否则资源争议会进一步转化为信任冲突。",
    risk: "信任风险：高",
    actors: ["事件推动方", "直接承受者", "协调与审批方", "监督与解释方"],
    network: "事件主体围绕资源、程序与风险承担形成多层依赖。",
  },
  policy: {
    diagnosis: "执行资源与政策目标之间存在传导损耗",
    detail: "目标的统一表述尚未转化为基层可执行的资源、权限和反馈机制，政策效果可能在末端发生偏移。",
    risk: "执行偏差：中高",
    actors: ["政策制定部门", "基层执行部门", "政策目标群体", "评估与监督机构"],
    network: "政策链条在制定、执行和反馈节点之间形成递进约束。",
  },
  opinion: {
    diagnosis: "信息不确定与信任缺口正在共同放大叙事竞争",
    detail: "事实回应、情绪承接和责任说明需要分层处理，单次澄清难以修复长期积累的解释权失衡。",
    risk: "传播失真：高",
    actors: ["首发信源", "核心传播节点", "议题相关公众", "回应责任主体"],
    network: "观点通过信源、平台与群体认同形成循环强化。",
  },
  org: {
    diagnosis: "权责边界与协作依赖没有同时对齐",
    detail: "局部团队承担了超出授权范围的协调成本，关键资源仍集中在无法直接响应现场变化的节点。",
    risk: "协作阻塞：中高",
    actors: ["决策与授权层", "核心执行团队", "关键协作部门", "外部依赖方"],
    network: "组织角色通过授权、资源与交付依赖连接成实际运行结构。",
  },
  combo: {
    diagnosis: "跨模式的制度张力需要同时纳入同一判断框架",
    detail: "事件、政策、组织与舆情在单一对象上叠加时，单看任一维度都会遗漏关键的传导与反噬路径。",
    risk: "复合风险：高",
    actors: ["事件直接主体", "政策执行节点", "组织协同方", "舆情关切公众"],
    network: "多模式主体在同一结构中被利益与程序同时连接。",
  },
};

export function TaskWorkbench({ taskId }: { taskId: string }) {
  const [view, setView] = useState<View>("overview");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, hydrated, createReport } = useAppStore();
  // 后端通过 WebSocket 推送进度；任务在 POST /api/analyze 时已自动入队运行。
  useTaskProgress(taskId);
  const task = state.tasks.find((item) => item.id === taskId);

  if (!task) {
    return hydrated ? (
      <section className="empty-state">
        <span className="eyebrow">未找到分析任务</span>
        <h1>这个任务可能已被移除</h1>
        <p>返回新建分析，或从项目总览选择一个仍在进行的任务。</p>
        <div><Link className="primary-button" href="/analysis">新建分析</Link><Link className="secondary-button" href="/projects">查看项目</Link></div>
      </section>
    ) : <section className="task-workbench" aria-busy="true" />;
  }

  const copy = workbenchCopy[task.type];
  const typeLabel = analysisTypes.find((item) => item.id === task.type)?.label ?? "结构分析";
  const currentPhaseIndex = phaseLabels.findIndex((phase) => phase.id === task.phase);
  const linkedReport = state.reports.find((report) => report.taskId === task.id);

  function openReport(mode: "reader" | "network") {
    const reportId = createReport(task!.id);
    if (reportId) router.push(mode === "reader" ? `/reports/${reportId}` : `/interest-analysis/${reportId}`);
  }

  const running = task.status !== "done" && task.status !== "error";

  return (
    <section className="task-workbench">
      <header className="task-workbench__header">
        <div>
          <span className="eyebrow">{typeLabel} / {task.engine === "llm" ? "语言增强" : "规则引擎"}</span>
          <h1>{task.title}</h1>
          <p>{task.context || "当前任务尚未补充背景说明，仍可继续完善材料并审阅结构化诊断。"}</p>
        </div>
        <span className="status-pill status-pill--running"><span />{phaseLabels[currentPhaseIndex]?.label}</span>
      </header>

      <div className="workbench-tabs" role="tablist" aria-label="分析任务视图">
        {([["overview", "总览"], ["report", "报告"], ["network", "关系网络"]] as const).map(([id, label]) => (
          <button key={id} role="tab" type="button" aria-selected={view === id} className={view === id ? "workbench-tab workbench-tab--active" : "workbench-tab"} onClick={() => setView(id)}>{label}</button>
        ))}
      </div>

      {view === "overview" && (
        <div className="workbench-overview">
          <section className="phase-panel">
            <div className="section-title"><div><span className="eyebrow">分析链</span><h2>六步进度</h2></div><strong>{task.progress}%</strong></div>
            <ol>{phaseLabels.map((phase, index) => <li className={index < currentPhaseIndex ? "phase-item phase-item--done" : index === currentPhaseIndex ? "phase-item phase-item--active" : "phase-item"} key={phase.id}><span>{index < currentPhaseIndex ? <Check size={14} /> : String(index + 1)}</span><div><strong>{phase.label}</strong><small>{phase.note}</small></div></li>)}</ol>
          </section>
          <section className="diagnosis-panel">
            <span className="eyebrow">当前诊断</span><h2>{copy.diagnosis}</h2>
            <p>{copy.detail}</p>
            <div><span><CircleDot size={14} />{copy.risk}</span><span><ShieldCheck size={14} />证据完整度：{Math.max(task.progress, 42)}%</span></div>
            <div className="diagnosis-panel__actions">
              {running && <span className="task-run-status" role="status">分析任务已自动启动，正在生成结构化报告…</span>}
              <button className="text-action" type="button" onClick={() => setView("network")}>查看关系路径 <ArrowRight size={15} /></button>
            </div>
          </section>
          <aside className="actor-panel"><span className="eyebrow">关键主体</span>{copy.actors.map((actor) => <button type="button" key={actor} onClick={() => setView("network")}><span>{actor.slice(0, 1)}</span><div><strong>{actor}</strong><small>查看结构位置</small></div><ArrowRight size={15} /></button>)}</aside>
        </div>
      )}

      {view === "report" && (linkedReport ? <TaskReportPreview taskId={task.id} /> : <div className="workbench-report"><FileText size={23} /><div><span className="eyebrow">{linkedReport ? "报告初稿已生成" : "结构化输出"}</span><h2>{task.title}分析报告</h2><p>包括核心诊断、三元结构观察与行动建议，每段均可在报告编辑器中继续审阅和修订。</p><button type="button" className="primary-button" onClick={() => openReport("reader")}>进入报告阅读器 <ArrowRight size={16} /></button></div></div>)}
      {view === "network" && <AnalysisNetwork taskId={task.id} />}
    </section>
  );
}
