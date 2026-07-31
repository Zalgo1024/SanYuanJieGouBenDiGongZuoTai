"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { useTasks } from "@/lib/hooks";
import FormattedDate from "@/components/FormattedDate";

const TASK_STATUS: Record<string, { label: string; color: string }> = {
  queued: { label: "已入队", color: "#2E86C1" },
  generating: { label: "生成中", color: "#F49C12" },
  done: { label: "已完成", color: "#27AE60" },
  error: { label: "失败", color: "#E74C3C" },
};

function ReportInner() {
  const searchParams = useSearchParams();
  const initial = searchParams.get("task");
  const { data: tasks } = useTasks({ limit: 100 });
  const list = tasks ?? [];

  const [sel, setSel] = useState<string | null>(initial);
  useEffect(() => {
    if (initial) setSel(initial);
  }, [initial]);

  const current = list.find((t) => t.task_id === sel) ?? list[0] ?? null;
  const st = current ? TASK_STATUS[current.status] ?? TASK_STATUS.queued : null;

  return (
    <AppShell title="报告库">
      <div className="h-full flex gap-4">
        {/* 左：报告列表 — 点击即进入统一展示页（含关系图/来源/返回上一步/删除） */}
        <div className="w-[280px] shrink-0 card p-3 flex flex-col">
          <div className="text-[13px] font-semibold text-ink px-2 py-2">
            报告库（{list.length}）
          </div>
          <div className="flex flex-col gap-0.5 overflow-y-auto">
            {list.length === 0 && (
              <div className="px-2 py-3 text-[12px] text-muted">暂无报告</div>
            )}
            {list.map((t) => {
              const s = TASK_STATUS[t.status] ?? TASK_STATUS.queued;
              const active = t.task_id === current?.task_id;
              return (
                <Link
                  key={t.task_id}
                  href={`/report/${t.task_id}`}
                  onClick={() => setSel(t.task_id)}
                  className={`text-left h-9 flex items-center gap-2 px-3 rounded-md text-[13px] truncate ${
                    active
                      ? "bg-[#F0F4FA] text-navy font-medium"
                      : "text-sub hover:bg-[#F3F4F6]"
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: s.color }}
                  />
                  <span className="truncate">{t.title}</span>
                </Link>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-cardborder">
            <Link
              href="/report"
              className="h-9 w-full rounded-md text-[13px] text-navy bg-[#F0F4FA] hover:bg-[#E4ECF6] flex items-center justify-center"
            >
              返回报告库
            </Link>
          </div>
        </div>

        {/* 右：选中报告快速信息 + 进入统一展示页入口 */}
        <div className="flex-1 min-w-0 card flex flex-col overflow-hidden">
          {!current ? (
            <div className="flex-1 flex items-center justify-center text-[13px] text-muted">
              请选择左侧一份报告查看。
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-8">
              <div className="max-w-[680px] mx-auto">
                <span
                  className="text-[11px] px-2 py-0.5 rounded-pill inline-block"
                  style={{ background: `${st!.color}1A`, color: st!.color }}
                >
                  {st!.label}
                </span>
                <h2 className="text-[20px] font-semibold text-ink mt-2 mb-2">
                  {current.title}
                </h2>
                <div className="text-[12px] text-sub mb-6">
                  生成时间：<FormattedDate iso={current.created_at} />
                </div>
                <p className="text-[13px] text-muted leading-relaxed mb-6">
                  点击下方按钮，在统一展示页查看完整报告 —— 含利益关系网络图、来源标识
                  （模型生成 / AI 生成）、下载 Word / PDF、手动调整与 AI 重新生成、
                  返回上一步、删除报告。新建报告完成后也会自动跳转到此页。
                </p>
                <Link
                  href={`/report/${current.task_id}`}
                  className="btn-primary h-10 px-5 text-[14px] inline-flex items-center justify-center"
                >
                  打开完整展示页 →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export default function ReportPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="报告">
          <div className="text-[13px] text-muted">加载中…</div>
        </AppShell>
      }
    >
      <ReportInner />
    </Suspense>
  );
}
