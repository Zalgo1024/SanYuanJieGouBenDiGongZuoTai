"use client";

import { useMemo, useState } from "react";
import { RULES, checkRules } from "@/lib/rules";

/**
 * 铁律自检面板（T9）：13 条写作铁律实时清单。
 * 可机检项自动算（章节齐全/DIAGRAM 合法/附录 [名](url)/——≤8/段落≤5 行/套话黑名单/概念≤3）；
 * 不可机检项由用户人工勾选。
 */
export default function RulesPanel({
  markdown,
  analysisType = "case",
}: {
  markdown: string;
  analysisType?: string;
}) {
  const [manualPassed, setManualPassed] = useState<Set<string>>(new Set());
  const machineResults = useMemo(
    () => checkRules(markdown, analysisType),
    [markdown, analysisType]
  );
  const machineMap = useMemo(
    () => new Map(machineResults.map((r) => [r.id, r])),
    [machineResults]
  );

  const machineOk = machineResults.filter((r) => r.pass).length;
  const manualTotal = RULES.filter((r) => !r.machine).length;
  const manualOk = RULES.filter((r) => !r.machine && manualPassed.has(r.id)).length;
  const total = RULES.length;
  const passed = machineOk + manualOk;

  const toggleManual = (id: string) => {
    const next = new Set(manualPassed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setManualPassed(next);
  };

  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[13px] font-semibold text-ink">铁律自检</div>
        <span
          className={`text-[11px] px-2 py-0.5 rounded-pill font-medium ${
            passed === total
              ? "bg-[#E8F5E9] text-[#2E7D32]"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {passed}/{total}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        {RULES.map((rule) => {
          const auto = machineMap.get(rule.id);
          const done = rule.machine ? !!auto?.pass : manualPassed.has(rule.id);
          return (
            <div
              key={rule.id}
              className={`flex items-start gap-2 rounded-input border px-2.5 py-1.5 ${
                done ? "border-[#A5D6A7] bg-[#F2FBF4]" : "border-cardborder bg-white"
              }`}
            >
              {rule.machine ? (
                <span
                  className={`w-4 h-4 rounded-full mt-0.5 shrink-0 flex items-center justify-center text-[10px] ${
                    done ? "bg-[#2E7D32] text-white" : "bg-amber-400 text-white"
                  }`}
                >
                  {done ? "✓" : "!"}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => toggleManual(rule.id)}
                  className={`w-4 h-4 rounded border mt-0.5 shrink-0 flex items-center justify-center text-[10px] ${
                    done
                      ? "bg-navy border-navy text-white"
                      : "border-cardborder bg-white"
                  }`}
                  title="人工确认该项"
                >
                  {done ? "✓" : ""}
                </button>
              )}
              <div className="min-w-0 flex-1">
                <div
                  className={`text-[12px] font-medium ${done ? "text-[#2E7D32]" : "text-ink"}`}
                >
                  {rule.title}
                  {rule.machine && auto && (
                    <span className="ml-1.5 text-[11px] font-normal text-sub">
                      {auto.pass ? `· ${auto.detail}` : `· ${auto.detail}`}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-sub leading-snug mt-0.5">
                  {rule.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
