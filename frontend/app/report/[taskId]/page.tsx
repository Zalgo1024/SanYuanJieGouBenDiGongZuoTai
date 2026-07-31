"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AppShell from "@/components/layout/AppShell";
import NetworkCanvas from "@/components/NetworkCanvas";
import FormattedDate from "@/components/FormattedDate";
import ContractBadge from "@/components/ContractBadge";
import VersionTimeline from "@/components/VersionTimeline";
import RulesPanel from "@/components/RulesPanel";
import { useReport, useTasks } from "@/lib/hooks";
import { parseDiagrams } from "@/lib/network";
import { ANALYSIS_TYPE_LABEL, EXPECTED_CHAPTERS } from "@/lib/constants";
import {
  downloadUrl,
  deleteReport,
  getReportVersions,
  getReportVersion,
  reviseReport,
  rollbackVersion,
  type AnalyzeResult,
} from "@/lib/api";

/**
 * 报告展览页（T10/T13 重构）：
 *  - 顶部：类型徽标 + 版本 vN + 状态 + 下载 Word/PDF + 手动改 / AI 再改；
 *  - Tab：正文阅读 / 三态图查看器（多图按 viz 分流）/ 附录来源；
 *  - 右侧：版本时间线（可回滚）+ 铁律自检面板 + 报告信息。
 * 数据源：GET /api/analyze/{taskId}（正文/产物）+ GET /api/reports/{taskId}（版本列表）。
 */

const VIZ_LABEL: Record<string, string> = {
  network: "关系网络图",
  org: "组织层级树",
  flow: "水平流程图",
};

function SourceBadge({ data }: { data?: AnalyzeResult["data"] | null }) {
  const used = data?.engine_used;
  if (!used) return null;
  const isRule = used === "rule";
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-pill border ${
        isRule
          ? "bg-[#E8F5E9] border-[#A5D6A7] text-[#2E7D32]"
          : "bg-[#F0F4FA] border-navy/30 text-navy"
      }`}
      title={isRule ? "由内置规则引擎生成（模型生成）" : "由 AI 模型增强生成"}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${isRule ? "bg-[#2E7D32]" : "bg-navy"}`}
      />
      {isRule ? "模型生成" : "AI 生成"}
      {!isRule && data?.llm_model && (
        <span className="opacity-70 font-normal">· {data.llm_model}</span>
      )}
    </span>
  );
}

export default function ReportShowPage() {
  const params = useParams<{ taskId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const taskId = params?.taskId ?? "";

  const { data: report, isLoading } = useReport(taskId);
  const result = report?.data;
  const markdown = result?.markdown ?? "";
  const status = report?.status;
  const done = status === "done";
  const title = (result?.title || "未命名分析") as string;
  // analysis_type 不在 analyze 结果里，从任务列表取（T5 类型徽标用）
  const { data: tasks } = useTasks({ limit: 100 });
  const analysisType =
    (tasks ?? []).find((t) => t.task_id === taskId)?.analysis_type || "case";

  // 版本列表（T13）
  const versionsQ = useQuery({
    queryKey: ["report-versions", taskId],
    queryFn: () => getReportVersions(taskId),
    enabled: !!taskId,
  });
  const versions = versionsQ.data?.versions ?? [];
  const currentVersionId = versionsQ.data?.current_version_id ?? null;
  const currentVersion =
    versions.find((v) => v.id === currentVersionId) ?? versions[0] ?? null;

  // 多图全量解析（T6）
  const diagrams = useMemo(() => parseDiagrams(markdown), [markdown]);
  const [diagramIdx, setDiagramIdx] = useState(0);
  useEffect(() => {
    setDiagramIdx(0);
  }, [diagrams.length]);

  // 正文阅读视图：默认当前版本内容；点选历史版本「查看」后临时切换显示
  const [displayMd, setDisplayMd] = useState<string | null>(null);
  const [displayVid, setDisplayVid] = useState<string | null>(null);
  const shownMd = displayMd ?? markdown;
  useEffect(() => {
    // 当前版本变化（revise/rollback/初次加载）时复位为当前版本
    setDisplayMd(null);
    setDisplayVid(null);
  }, [markdown]);

  const handleViewVersion = async (vid: string) => {
    try {
      const v = await getReportVersion(taskId, vid);
      setDisplayMd(v.content_markdown);
      setDisplayVid(vid);
    } catch {
      /* 忽略加载失败 */
    }
  };

  // T13 AI 再改
  const [reviseOpen, setReviseOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [revising, setRevising] = useState(false);
  const [reviseError, setReviseError] = useState("");

  const handleRevise = async () => {
    if (!instruction.trim() || revising) return;
    setRevising(true);
    setReviseError("");
    try {
      await reviseReport(taskId, { instruction: instruction.trim() });
      setInstruction("");
      setReviseOpen(false);
      qc.invalidateQueries({ queryKey: ["report", taskId] });
      qc.invalidateQueries({ queryKey: ["report-versions", taskId] });
    } catch (e) {
      setReviseError(e instanceof Error ? e.message : "AI 再改失败");
    } finally {
      setRevising(false);
    }
  };

  // T13 回滚
  const [rollingBack, setRollingBack] = useState(false);
  const [rollbackError, setRollbackError] = useState("");

  const handleRollback = async (vid: string) => {
    if (rollingBack) return;
    if (
      !window.confirm("回滚到该版本？当前内容将被替换为该版本内容（历史版本不删除）。")
    ) {
      return;
    }
    setRollingBack(true);
    setRollbackError("");
    try {
      await rollbackVersion(vid);
      qc.invalidateQueries({ queryKey: ["report", taskId] });
      qc.invalidateQueries({ queryKey: ["report-versions", taskId] });
    } catch (e) {
      setRollbackError(e instanceof Error ? e.message : "回滚失败");
    } finally {
      setRollingBack(false);
    }
  };

  // 删除报告
  async function handleDelete() {
    if (
      !window.confirm(
        `确定删除报告「${title}」？\n此操作不可恢复——报告正文、所有修订版本与产物文件将被永久删除。`
      )
    ) {
      return;
    }
    try {
      await deleteReport(taskId);
      router.push("/report");
    } catch (e) {
      window.alert("删除失败：" + (e instanceof Error ? e.message : String(e)));
    }
  }

  // 附录来源（取 [名称](url) 行）
  const appendixLines = useMemo(() => {
    const idx = Math.max(markdown.indexOf("## 附录"), markdown.indexOf("**数据来源**"));
    if (idx < 0) return [];
    return markdown
      .slice(idx)
      .split("\n")
      .filter((l) => /\[[^\]]+\]\((https?:\/\/[^)]+)\)/.test(l))
      .slice(0, 30);
  }, [markdown]);

  const [activeTab, setActiveTab] = useState<"read" | "diagram" | "appendix">("read");

  return (
    <AppShell title="报告展示">
      <div className="h-full flex flex-col">
        {/* 顶部信息栏 */}
        <div className="shrink-0 px-6 py-4 bg-gradient-to-r from-[#1B3A5C] to-[#2E5C8A] text-white flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-[18px] font-semibold truncate">{title}</div>
              {/* T5 类型徽标 + 预计章节数（双轨护栏显性化） */}
              <span className="text-[11px] px-2 py-0.5 rounded-pill bg-white/15 text-white/90 border border-white/20">
                {ANALYSIS_TYPE_LABEL[analysisType as keyof typeof ANALYSIS_TYPE_LABEL] ?? analysisType}
                {EXPECTED_CHAPTERS[analysisType as keyof typeof EXPECTED_CHAPTERS]
                  ? ` · ${EXPECTED_CHAPTERS[analysisType as keyof typeof EXPECTED_CHAPTERS]} 段`
                  : ""}
              </span>
              {currentVersion && (
                <span className="text-[11px] px-2 py-0.5 rounded-pill bg-[#27AE60]/20 text-[#A5F0C5]">
                  v{currentVersion.version_no ?? 1}
                </span>
              )}
            </div>
            <div className="text-[12px] text-white/70 mt-1 flex items-center gap-3 flex-wrap">
              <span>生成时间：<FormattedDate iso={report ? new Date().toISOString() : null} /></span>
              {status && (
                <span className={`px-2 py-0.5 rounded-pill text-[11px] ${
                  done ? "bg-[#27AE60]/20 text-[#A5F0C5]" : "bg-amber-400/20 text-amber-200"
                }`}>
                  {done ? "已完成" : status === "error" ? "失败" : "生成中"}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/analysis?task=${taskId}`}
              className="h-9 px-4 rounded-md text-[13px] font-medium bg-white/15 hover:bg-white/25 text-white flex items-center"
            >
              返回上一步
            </Link>
            <SourceBadge data={result} />
            {done && (
              <>
                <a
                  href={downloadUrl(taskId, "word")}
                  className="h-9 px-4 rounded-md text-[13px] font-medium bg-white/15 hover:bg-white/25 text-white flex items-center"
                >
                  下载 Word
                </a>
                {result?.pdf_available ? (
                  <a
                    href={downloadUrl(taskId, "pdf")}
                    className="h-9 px-4 rounded-md text-[13px] font-medium bg-white/15 hover:bg-white/25 text-white flex items-center"
                  >
                    下载 PDF
                  </a>
                ) : (
                  <span className="text-[12px] text-white/60 px-2">PDF 待配置</span>
                )}
                <Link
                  href={`/report/${taskId}/edit`}
                  className="h-9 px-4 rounded-md text-[13px] font-medium bg-white text-[#1B3A5C] hover:bg-white/90 flex items-center"
                >
                  手动改
                </Link>
                <button
                  onClick={() => setReviseOpen((v) => !v)}
                  className="h-9 px-4 rounded-md text-[13px] font-medium bg-[#E74C3C] hover:bg-[#D62C1A] text-white flex items-center"
                >
                  AI 再改
                </button>
              </>
            )}
          </div>
        </div>

        {/* T13：AI 再改指令输入（展开条） */}
        {reviseOpen && (
          <div className="shrink-0 px-6 py-3 bg-[#FDECEA] border-b border-[#F5C6C0]">
            <div className="flex items-center gap-3 flex-wrap">
              <input
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRevise()}
                placeholder="输入修改意图，如：把第三章改写得更尖锐"
                className="h-9 flex-1 min-w-[240px] rounded-input border border-cardborder bg-white px-3 text-[13px] text-ink outline-none focus:border-navy"
              />
              <button
                onClick={handleRevise}
                disabled={revising || !instruction.trim()}
                className="h-9 px-4 rounded-md text-[13px] font-medium text-white bg-[#E74C3C] hover:bg-[#D62C1A] disabled:opacity-40"
              >
                {revising ? "再改中…" : "确认 AI 再改"}
              </button>
              <button
                onClick={() => setReviseOpen(false)}
                className="h-9 px-3 rounded-md text-[12px] text-sub hover:text-ink"
              >
                取消
              </button>
            </div>
            {reviseError && (
              <div className="text-[12px] text-[#C62828] mt-1.5">⚠ {reviseError}</div>
            )}
            {rollbackError && (
              <div className="text-[12px] text-[#C62828] mt-1.5">⚠ {rollbackError}</div>
            )}
          </div>
        )}

        {/* 主体：Tab 区 + 右侧面板 */}
        <div className="flex-1 min-h-0 flex gap-4 p-4">
          {/* 左：Tab 阅读区 */}
          <div className="flex-1 min-w-0 card flex flex-col overflow-hidden">
            <div className="h-11 shrink-0 flex items-center gap-1 px-3 border-b border-cardborder bg-white">
              {(
                [
                  ["read", "正文阅读"],
                  ["diagram", `三态图（${diagrams.length}）`],
                  ["appendix", `附录来源（${appendixLines.length}）`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`h-full px-4 text-[13px] font-medium border-b-2 -mb-px ${
                    activeTab === key
                      ? "border-navy text-navy"
                      : "border-transparent text-sub hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
              {displayVid && (
                <span className="ml-auto text-[11px] text-amber-600">
                  正在查看历史版本（非当前）
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              {isLoading && <div className="text-[13px] text-muted">加载报告…</div>}
              {!isLoading && !shownMd && (
                <div className="text-[13px] text-muted">
                  报告内容为空或正在生成。
                </div>
              )}

              {activeTab === "read" && shownMd && (
                <div className="md-body max-w-[820px] mx-auto">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {shownMd}
                  </ReactMarkdown>
                </div>
              )}

              {activeTab === "diagram" &&
                (diagrams.length === 0 ? (
                  <div className="text-[13px] text-muted text-center py-10">
                    本报告未包含关系图数据
                  </div>
                ) : (
                  <div className="max-w-[900px] mx-auto">
                    {/* 多图 Tab（T6 全量） */}
                    <div className="flex gap-1 border-b border-cardborder mb-3 flex-wrap">
                      {diagrams.map((d, i) => (
                        <button
                          key={`${d.title}-${i}`}
                          onClick={() => setDiagramIdx(i)}
                          className={`h-9 px-3 text-[12px] font-medium border-b-2 -mb-px ${
                            i === diagramIdx
                              ? "border-navy text-navy"
                              : "border-transparent text-sub hover:text-ink"
                          }`}
                        >
                          图 {i + 1} · {d.title || VIZ_LABEL[d.viz] || "关系图"}
                          <span className="ml-1.5 text-[10px] text-muted">
                            {VIZ_LABEL[d.viz] || "关系网络"}
                          </span>
                        </button>
                      ))}
                    </div>
                    {diagrams[diagramIdx] && (
                      <>
                        <div className="h-[420px] rounded-input border border-cardborder overflow-hidden bg-[#FAFBFC]">
                          <NetworkCanvas
                            nodes={diagrams[diagramIdx].nodes}
                            edges={diagrams[diagramIdx].edges}
                            viz={
                              (diagrams[diagramIdx].viz as "network" | "org" | "flow") ??
                              "network"
                            }
                            centerId={
                              diagrams[diagramIdx].nodes.find((n) => n.type === "actor")?.id ??
                              diagrams[diagramIdx].nodes[0]?.id
                            }
                          />
                        </div>
                        <div className="text-[11px] text-muted mt-2">
                          {diagrams[diagramIdx].title || "关系图"} ·{" "}
                          {diagrams[diagramIdx].nodes.length} 个节点 ·{" "}
                          {diagrams[diagramIdx].edges.length} 条关系 · 可拖拽缩放
                        </div>
                      </>
                    )}
                  </div>
                ))}

              {activeTab === "appendix" && (
                <div className="max-w-[820px] mx-auto">
                  {appendixLines.length === 0 ? (
                    <div className="text-[13px] text-muted">
                      未识别到可点击来源（附录需使用 [名称](url) 格式）。
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {appendixLines.map((l, i) => (
                        <div
                          key={i}
                          className="rounded-input border border-cardborder bg-white px-3 py-2 text-[13px]"
                        >
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{l}</ReactMarkdown>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 右：版本时间线 + 铁律自检 + 信息 */}
          <div className="w-[300px] shrink-0 flex flex-col gap-4 overflow-y-auto">
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[13px] font-semibold text-ink">
                  版本时间线（{versions.length}）
                </div>
              </div>
              <VersionTimeline
                versions={versions}
                currentId={currentVersionId}
                onSelect={handleViewVersion}
                onRollback={handleRollback}
                rollingBack={rollingBack}
              />
            </div>

            {/* T9 铁律自检面板（机检当前正文） */}
            {shownMd && (
              <RulesPanel markdown={shownMd} analysisType={analysisType} />
            )}

            {/* 概念标注 */}
            {diagrams.length > 0 && (
              <div className="card p-4">
                <div className="text-[13px] font-semibold text-ink mb-2">
                  核心概念
                </div>
                <div className="flex flex-wrap gap-2">
                  {diagrams[diagramIdx]?.nodes.slice(0, 12).map((n) => (
                    <span
                      key={n.id}
                      className="text-[11px] px-2 py-0.5 rounded-pill bg-[#F3F4F6] text-sub"
                    >
                      {n.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 报告信息 */}
            <div className="card p-4">
              <div className="text-[13px] font-semibold text-ink mb-2">报告信息</div>
              <div className="text-[12px] text-sub leading-relaxed space-y-1">
                <div>生成时间：<FormattedDate iso={report ? new Date().toISOString() : null} /></div>
                <div>状态：{done ? "已完成" : status ?? "—"}</div>
                {result?.prompt_version && (
                  <div>提示词版本：v{result.prompt_version}</div>
                )}
                {result?.search_results?.provider && (
                  <div>检索源：{result.search_results.provider}</div>
                )}
              </div>
              {result?.contract && (
                <div className="mt-2">
                  <ContractBadge contract={result.contract} />
                </div>
              )}
            </div>

            {/* 快捷操作 */}
            <div className="card p-4 flex flex-col gap-2">
              <Link
                href="/report"
                className="h-9 rounded-md text-[13px] text-navy bg-[#F0F4FA] hover:bg-[#E4ECF6] flex items-center justify-center"
              >
                返回报告库
              </Link>
              <button
                onClick={handleDelete}
                className="h-9 rounded-md text-[13px] font-medium text-[#E74C3C] bg-[#FDECEA] hover:bg-[#FAD9D5] flex items-center justify-center"
              >
                删除报告
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
