"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AppShell from "@/components/layout/AppShell";
import NetworkCanvas from "@/components/NetworkCanvas";
import { getCases, importCase, type CaseItem } from "@/lib/api";

/**
 * 案例库页（T14）：列表 + 类型筛选 + 预览（正文+图）+ 套用（复制骨架清空正文进分析页）
 * + 编辑（import → 跳 /report/{taskId} 走 T13 留痕）。后端 ast 只读解析，绝不写回 KERNEL。
 */

const FILTERS = [
  { key: "all", label: "全部" },
  { key: "policy", label: "政策" },
  { key: "case", label: "事件" },
  { key: "org", label: "组织" },
  { key: "opinion", label: "舆情" },
  { key: "combo", label: "组合" },
];

const TYPE_BADGE: Record<string, string> = {
  case: "事件",
  policy: "政策",
  org: "组织",
  opinion: "舆情",
  combo: "组合·源序",
  unknown: "未分类",
};

export default function CasesPage() {
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<CaseItem | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");

  const casesQ = useQuery({ queryKey: ["cases"], queryFn: getCases });
  const cases = casesQ.data?.cases ?? [];

  const filtered = useMemo(
    () => (filter === "all" ? cases : cases.filter((c) => c.analysis_type === filter)),
    [cases, filter]
  );

  // 选中态：过滤后仍保留已选（即使不在当前筛选下）
  const preview = selected ?? filtered[0] ?? null;

  const handleApply = (c: CaseItem) => {
    // 套用：复制章节骨架 + DIAGRAM 结构，清空正文 → 进分析页预填骨架
    const skeleton = c.markdown
      .split("\n")
      .filter((l) => /^#{1,3}\s/.test(l) || /```DIAGRAM/.test(l))
      .join("\n");
    router.push(`/analysis?skeleton=${encodeURIComponent(skeleton)}&type=${c.analysis_type}`);
  };

  const handleEdit = async (c: CaseItem) => {
    setImporting(true);
    setImportError("");
    try {
      const { task_id } = await importCase(c.id);
      router.push(`/report/${task_id}`);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "导入失败");
      setImporting(false);
    }
  };

  const previewDiagrams = useMemo(
    () => preview?.diagrams ?? [],
    [preview]
  );

  return (
    <AppShell title="案例库">
      <div className="h-full flex flex-col">
        <div className="shrink-0 px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[20px] font-bold text-ink">案例库</h1>
            <p className="text-[12px] text-sub mt-1">
              {casesQ.data?.total ?? 0} 篇已验证成稿（ast 只读解析内核案例，可预览 / 套用 / 编辑留痕）
            </p>
          </div>
          {/* 类型筛选 */}
          <div className="flex gap-1 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`h-8 px-3 rounded-pill text-[12px] font-medium border ${
                  filter === f.key
                    ? "bg-navy text-white border-navy"
                    : "border-cardborder text-sub hover:text-ink bg-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 flex gap-4 px-4 pb-4">
          {/* 左：案例列表 */}
          <div className="w-[320px] shrink-0 card flex flex-col overflow-hidden">
            <div className="h-11 flex items-center gap-2 px-4 bg-inputbg border-b border-cardborder">
              <span className="text-[13px] font-semibold text-ink">案例（{filtered.length}）</span>
            </div>
            <div className="flex flex-col gap-0.5 overflow-y-auto p-2">
              {filtered.length === 0 && (
                <div className="px-2 py-3 text-[12px] text-muted">该分类暂无案例</div>
              )}
              {filtered.map((c) => {
                const active = preview?.id === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className={`text-left h-12 flex items-center gap-2 px-3 rounded-md text-[13px] ${
                      active
                        ? "bg-[#F0F4FA] text-navy font-medium"
                        : "text-ink hover:bg-[#F3F4F6]"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{c.name}</div>
                      <div className="text-[11px] text-muted">
                        {TYPE_BADGE[c.analysis_type] ?? c.analysis_type} · {c.chapters} 章
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 右：预览 + 操作 */}
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            {!preview ? (
              <div className="flex-1 card flex items-center justify-center text-[13px] text-muted">
                请选择左侧案例预览。
              </div>
            ) : (
              <>
                <div className="shrink-0 card p-4 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[15px] font-semibold text-ink truncate">
                        {preview.name}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-pill bg-[#F0F4FA] text-navy border border-navy/20">
                        {TYPE_BADGE[preview.analysis_type] ?? preview.analysis_type}
                      </span>
                      <span className="text-[11px] text-muted">
                        {preview.chapters} 章 · {preview.script}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleApply(preview)}
                      className="h-9 px-4 rounded-md text-[13px] font-medium text-white bg-navy hover:bg-navy/90"
                    >
                      套用为模板
                    </button>
                    <button
                      onClick={() => handleEdit(preview)}
                      disabled={importing}
                      className="h-9 px-4 rounded-md text-[13px] font-medium text-[#1B3A5C] bg-[#F0F4FA] hover:bg-[#E4ECF6] border border-cardborder disabled:opacity-50"
                    >
                      {importing ? "导入中…" : "编辑（导入留痕）"}
                    </button>
                  </div>
                </div>

                {importError && (
                  <div className="shrink-0 rounded-input border border-interest-material/40 bg-[#FFEBEE] px-3 py-2 text-[12px] text-[#C62828]">
                    ⚠ {importError}
                  </div>
                )}

                <div className="flex-1 min-h-0 card flex flex-col overflow-hidden">
                  <div className="h-10 shrink-0 flex items-center gap-1 px-3 border-b border-cardborder bg-white">
                    <div className="text-[13px] font-medium text-ink">成稿预览</div>
                    {previewDiagrams.length > 0 && (
                      <div className="ml-auto flex gap-1">
                        {previewDiagrams.map((d, i) => (
                          <span
                            key={i}
                            className="text-[11px] px-2 py-0.5 rounded-pill bg-[#F3F4F6] text-sub"
                          >
                            图{i + 1} · {d.viz ?? "network"}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto p-6">
                    <div className="md-body max-w-[720px] mx-auto">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {preview.markdown}
                      </ReactMarkdown>
                    </div>
                    {/* 图预览（多图） */}
                    {previewDiagrams.length > 0 && (
                      <div className="max-w-[720px] mx-auto mt-6 flex flex-col gap-3">
                        {previewDiagrams.map((d, i) => (
                          <div key={i} className="rounded-input border border-cardborder overflow-hidden">
                            <div className="h-[260px] bg-[#FAFBFC]">
                              <NetworkCanvas
                                nodes={(d.nodes as any) ?? []}
                                edges={(d.edges as any) ?? []}
                                viz={(d.viz as "network" | "org" | "flow") ?? "network"}
                              />
                            </div>
                            <div className="px-3 py-1.5 text-[11px] text-muted">
                              图{i + 1} · {d.title ?? d.viz ?? "关系图"}（{d.nodes?.length ?? 0} 节点）
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
