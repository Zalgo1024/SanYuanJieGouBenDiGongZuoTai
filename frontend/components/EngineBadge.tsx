import { type AnalyzeResult } from "@/lib/api";

interface EngineBadgeProps {
  data?: AnalyzeResult["data"] | null;
}

export default function EngineBadge({ data }: EngineBadgeProps) {
  const used = data?.engine_used;
  if (!used) return null;
  const degraded = Boolean(data?.degraded_from_llm);
  const isRule = used === "rule";
  return (
    <div
      className={`rounded-input px-3 py-2 text-[12px] leading-relaxed ${
        isRule
          ? "bg-[#E8F5E9] border border-[#A5D6A7] text-[#2E7D32]"
          : "bg-[#F0F4FA] border border-navy/30 text-navy"
      }`}
    >
      <span className="font-medium">
        {isRule ? "规则引擎生成" : "AI 模型增强生成"}
      </span>
      {!isRule && data?.llm_model && (
        <span className="opacity-80"> · {data.llm_model}</span>
      )}
      {data?.prompt_version && (
        <span className="opacity-80"> · 提示词 v{data.prompt_version}</span>
      )}
      {degraded && (
        <div className="mt-1 text-[#C62828]">
          ⚠ 已从 LLM 降级到规则引擎：{data?.degrade_reason}
        </div>
      )}
    </div>
  );
}
