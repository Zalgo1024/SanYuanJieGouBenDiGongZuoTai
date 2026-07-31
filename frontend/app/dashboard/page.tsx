"use client";

import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { useProjects, useTasks } from "@/lib/hooks";
import { type ProjectDTO, type TaskDTO } from "@/lib/api";
import FormattedDate from "@/components/FormattedDate";
import { IconProject, IconReport, IconInterest, IconBell } from "@/components/icons";

const TASK_STATUS: Record<string, { label: string; color: string }> = {
  queued: { label: "已入队", color: "#2E86C1" },
  generating: { label: "生成中", color: "#F49C12" },
  done: { label: "已完成", color: "#27AE60" },
  error: { label: "失败", color: "#E74C3C" },
};

function projectPill(status: string) {
  const isDone = status === "已完成";
  return {
    bg: isDone ? "#E8F5E9" : "#FFF3E0",
    fg: isDone ? "#2E7D32" : "#E65100",
  };
}

export default function DashboardPage() {
  const { data: projects, isLoading } = useProjects();
  const { data: tasks } = useTasks({ limit: 50 });

  const projList: ProjectDTO[] = projects ?? [];
  const taskList: TaskDTO[] = tasks ?? [];
  const doneCount = taskList.filter((t) => t.status === "done").length;
  const runningCount = taskList.filter(
    (t) => t.status === "queued" || t.status === "generating"
  ).length;

  const stats = [
    {
      label: "项目总数",
      value: String(projList.length),
      hint: `${doneCount} 份报告已生成`,
      color: "#2E86C1",
      icon: IconProject,
    },
    {
      label: "进行中任务",
      value: String(runningCount),
      hint: runningCount ? "后台处理中" : "当前无进行中",
      color: "#27AE60",
      icon: IconReport,
    },
    {
      label: "已完成报告",
      value: String(doneCount),
      hint: `共 ${taskList.length} 次分析`,
      color: "#8E44AD",
      icon: IconInterest,
    },
  ];

  const recentTasks = taskList.slice(0, 5);
  const runningTasks = taskList.filter(
    (t) => t.status === "queued" || t.status === "generating"
  );

  return (
    <AppShell title="工作台">
      <div className="max-w-[1200px] mx-auto">
        {/* Page header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-[22px] font-bold text-ink">工作台</h1>
            <p className="text-[13px] text-sub mt-1">
              基于三元结构理论的结构化分析总览（实时数据）
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/projects" className="btn-ghost h-9 px-4 text-[13px]">
              全部项目
            </Link>
            <Link href="/analysis" className="btn-primary h-9 px-4 text-[13px]">
              + 新建分析
            </Link>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="card p-5 flex items-center gap-4">
                <div
                  className="w-11 h-11 rounded-card flex items-center justify-center shrink-0"
                  style={{ background: `${s.color}1A` }}
                >
                  <Icon size={20} style={{ color: s.color }} />
                </div>
                <div>
                  <div className="text-[28px] font-bold text-ink leading-none">
                    {s.value}
                  </div>
                  <div className="text-[13px] text-sub mt-1.5">{s.label}</div>
                  <div className="text-[11px] text-muted mt-0.5">{s.hint}</div>
                </div>
              </div>
            );
          })}
        </div>

        {isLoading && (
          <div className="text-[13px] text-muted mb-4">加载中…</div>
        )}

        {/* Projects */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title">最近项目</h2>
          <Link href="/projects" className="text-[12px] text-muted hover:text-navy">
            查看全部 →
          </Link>
        </div>
        {projList.length === 0 && !isLoading ? (
          <div className="card p-8 text-center text-[13px] text-muted">
            暂无项目。可在「分析引擎」运行一次分析并归入项目。
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 mb-6">
            {projList.map((p) => {
              const pct = parseInt(p.progress, 10) || 0;
              const pill = projectPill(p.status);
              return (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="card p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-[15px] font-semibold text-ink">{p.name}</h3>
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-pill"
                      style={{ background: pill.bg, color: pill.fg }}
                    >
                      {p.status}
                    </span>
                  </div>
                  <p className="text-[12px] text-sub mt-2 leading-relaxed line-clamp-2">
                    {p.description}
                  </p>
                  <div className="flex gap-2 mt-3">
                    {[
                      `主体 ${p.subjects}`,
                      `利益项 ${p.interests}`,
                      `章节 ${p.chapters}`,
                    ].map((m) => (
                      <span
                        key={m}
                        className="text-[11px] px-2 py-0.5 rounded-pill bg-[#F3F4F6] text-sub"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 h-1.5 rounded-full bg-track overflow-hidden">
                    <div
                      className="h-full rounded-full bg-navy"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted mt-1.5">
                    <span>完成度 {p.progress}</span>
                    <span>
                      {p.owner_name || "—"} · <FormattedDate iso={p.updated_at} />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Bottom row: recent activity + running */}
        <div className="grid grid-cols-2 gap-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <IconBell size={16} className="text-sub" />
              <h3 className="text-[14px] font-semibold text-ink">最近活动</h3>
            </div>
            <div className="flex flex-col gap-2">
              {recentTasks.length === 0 && (
                <div className="text-[13px] text-muted">暂无分析记录</div>
              )}
              {recentTasks.map((t) => {
                const st = TASK_STATUS[t.status] ?? TASK_STATUS.queued;
                return (
                  <Link
                    key={t.task_id}
                    href={`/report/${t.task_id}`}
                    className="flex items-center justify-between border-b border-cardborder pb-2 last:border-0 last:pb-0 hover:text-navy"
                  >
                    <span className="text-[13px] text-ink truncate pr-3">
                      • {t.title}
                    </span>
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-pill shrink-0"
                      style={{ background: `${st.color}1A`, color: st.color }}
                    >
                      {st.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <IconProject size={16} className="text-sub" />
              <h3 className="text-[14px] font-semibold text-ink">进行中</h3>
            </div>
            <div className="flex flex-col gap-3">
              {runningTasks.length === 0 && (
                <div className="text-[13px] text-muted">当前没有进行中的任务</div>
              )}
              {runningTasks.map((t) => {
                const st = TASK_STATUS[t.status] ?? TASK_STATUS.queued;
                return (
                  <div key={t.task_id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px] text-ink truncate pr-3">
                        {t.title}
                      </span>
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-pill shrink-0"
                        style={{ background: `${st.color}1A`, color: st.color }}
                      >
                        {st.label}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-track overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent animate-pulse"
                        style={{ width: t.status === "generating" ? "70%" : "20%" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
