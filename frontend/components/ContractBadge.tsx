"use client";

import type { ContractInfo } from "@/lib/api";

/** 结构契约校验徽标：展示报告结构是否通过校验、是否做过自动修复。 */
export default function ContractBadge({ contract }: { contract?: ContractInfo | null }) {
  if (!contract) return null;

  if (!contract.valid) {
    return (
      <div
        className="rounded-input border px-3 py-1.5 text-[12px] leading-relaxed border-interest-material/40 bg-[#FFEBEE] text-[#C62828]"
        title={contract.errors?.join("；")}
      >
        ✕ 结构异常：{contract.errors?.[0] ?? "校验未通过"}
      </div>
    );
  }

  if (contract.repaired) {
    const notes = [contract.diagram_synthetic ? "关系图为自动合成" : null, ...(contract.errors ?? [])].filter(
      Boolean
    ) as string[];
    return (
      <div
        className="rounded-input border px-3 py-1.5 text-[12px] leading-relaxed border-[#F39C12]/40 bg-[#FEF5E7] text-[#B9770E]"
        title={notes.join("；")}
      >
        ⚠ 结构已自动修复（{notes.length} 项）
      </div>
    );
  }

  return (
    <div className="rounded-input border px-3 py-1.5 text-[12px] border-[#2E7D32]/30 bg-[#E8F5E9] text-[#2E7D32]">
      ✓ 结构校验通过（{contract.mode === "rule" ? "内置规则引擎" : "AI 模型"}）
    </div>
  );
}
