"use client";

import type { ReportVersionMeta } from "@/lib/api";

/**
 * 版本时间线（T13）：vN / 时间戳 / 摘要 / 人-AI 徽标 / 回滚按钮。
 * 当前版本高亮；点击任意版本可查看，回滚按钮调父级回调。
 */
export default function VersionTimeline({
  versions,
  currentId,
  onSelect,
  onRollback,
  rollingBack,
}: {
  versions: ReportVersionMeta[];
  currentId: string | null;
  onSelect?: (vid: string) => void;
  onRollback?: (vid: string) => void;
  rollingBack?: boolean;
}) {
  if (!versions.length) {
    return <div className="text-[12px] text-muted px-1 py-2">暂无版本</div>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {[...versions]
        .sort((a, b) => (b.version_no ?? 0) - (a.version_no ?? 0))
        .map((v) => {
          const current = v.id === currentId;
          const isAi = v.edited_by === "ai";
          return (
            <div
              key={v.id}
              className={`rounded-input border px-3 py-2 ${
                current
                  ? "border-navy bg-[#F0F4FA]"
                  : "border-cardborder bg-white hover:bg-[#F9FAFB]"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-ink shrink-0">
                  v{v.version_no ?? 1}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-pill font-medium ${
                    isAi
                      ? "bg-[#F0F4FA] text-navy border border-navy/20"
                      : "bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7]"
                  }`}
                >
                  {isAi ? "AI" : "人"}
                </span>
                {current && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-pill bg-navy text-white">
                    当前
                  </span>
                )}
                <span className="ml-auto text-[11px] text-muted">
                  {v.created_at ? fmtTime(v.created_at) : ""}
                </span>
              </div>
              <div className="text-[11px] text-sub mt-1 leading-snug truncate">
                {v.summary || v.note || (v.kind === "original" ? "自动生成" : "修订")}
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                {onSelect && !current && (
                  <button
                    onClick={() => onSelect(v.id)}
                    className="text-[11px] text-navy hover:underline"
                  >
                    查看
                  </button>
                )}
                {onRollback && !current && (
                  <button
                    onClick={() => onRollback(v.id)}
                    disabled={rollingBack}
                    className="text-[11px] text-[#E74C3C] hover:underline disabled:opacity-40"
                  >
                    {rollingBack ? "回滚中…" : "回滚到该版本"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
