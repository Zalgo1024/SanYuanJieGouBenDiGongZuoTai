"use client";

import { useTasks } from "@/lib/hooks";
import { fmtDate } from "@/lib/api";

/**
 * 报告选择器 —— 三张分析图（网络图 / 多主体 / 影响评估）共用。
 * 仅列出「已完成」的真实报告，选中后由父页面解析其 DIAGRAM。
 */
export default function ReportPicker({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (id: string) => void;
}) {
  const { data: tasks, isLoading } = useTasks({ status: "done", limit: 50 });
  const list = tasks ?? [];

  if (isLoading) return <span className="text-[12px] text-muted">加载报告…</span>;
  if (list.length === 0)
    return (
      <span className="text-[12px] text-muted">
        暂无已完成报告（请先在「分析引擎」运行）
      </span>
    );

  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-input bg-inputbg border border-cardborder px-3 text-[13px] text-ink outline-none focus:border-navy max-w-[320px]"
    >
      {list.map((t) => (
        <option key={t.task_id} value={t.task_id}>
          {t.title}（{fmtDate(t.created_at)}）
        </option>
      ))}
    </select>
  );
}
