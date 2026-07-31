import React from "react";

interface ChipProps {
  label: string;
  onRemove?: () => void;
  tone?: "default" | "url" | "tag" | "project";
}

/** 一颗可移除的识别 chip。 */
export default function Chip({ label, onRemove, tone = "default" }: ChipProps) {
  const toneCls =
    tone === "url"
      ? "bg-[#E3F2FD] text-navy border-navy/20"
      : tone === "tag"
        ? "bg-[#F3E5F5] text-[#6A1B9A] border-[#CE93D8]/40"
        : tone === "project"
          ? "bg-[#FFF3E0] text-[#E65100] border-[#FFB74D]/40"
          : "bg-inputbg text-ink border-cardborder";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] border ${toneCls}`}
    >
      {tone === "url" && <span className="opacity-60">🔗</span>}
      {tone === "tag" && <span className="opacity-60">#</span>}
      {tone === "project" && <span className="opacity-60">📁</span>}
      <span className="truncate max-w-[200px]">{label}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-0.5 opacity-60 hover:opacity-100 text-[14px] leading-none"
          aria-label="移除"
        >
          ×
        </button>
      )}
    </span>
  );
}
