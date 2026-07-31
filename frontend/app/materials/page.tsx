"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AppShell from "@/components/layout/AppShell";
import { useProjects } from "@/lib/hooks";
import { LoadingState, ErrorState, EmptyState } from "@/components/states";
import {
  getMaterials,
  createMaterial,
  uploadMaterial,
  deleteMaterial,
  fmtDate,
  type MaterialMeta,
  type MaterialSourceType,
} from "@/lib/api";

const SRC_LABEL: Record<MaterialSourceType, string> = {
  paste: "粘贴",
  txt: "TXT",
  md: "MD",
  docx: "DOCX",
  pdf: "PDF",
};
const SRC_COLOR: Record<MaterialSourceType, string> = {
  paste: "#6B7280",
  txt: "#2E86C1",
  md: "#8E44AD",
  docx: "#1B3A5C",
  pdf: "#E74C3C",
};

/** 解析告警码 -> 中文提示（材料列表展示用）。 */
const WARN_LABEL: Record<string, string> = {
  pdf_text_empty: "PDF 未提取到文本（可能为扫描件/图片型）",
  pdf_garbled: "PDF 文本疑似乱码",
  pdf_too_large: "PDF 超过 50MB，已拒绝解析",
  pdf_parse_failed: "PDF 解析失败",
  text_garbled: "文本疑似乱码",
};

export default function MaterialsPage() {
  const qc = useQueryClient();
  const { data: projects } = useProjects();
  const [projectId, setProjectId] = useState<string>("");
  const [tab, setTab] = useState<"paste" | "upload">("paste");

  // 粘贴表单
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [pasteSource, setPasteSource] = useState("");
  const [pasteTags, setPasteTags] = useState("");

  // 上传表单
  const [file, setFile] = useState<File | null>(null);
  const [upTitle, setUpTitle] = useState("");
  const [upSource, setUpSource] = useState("");
  const [upTags, setUpTags] = useState("");

  // 搜索
  const [search, setSearch] = useState("");

  const [expanded, setExpanded] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const listQ = useQuery({
    queryKey: ["materials", projectId, search],
    queryFn: () => getMaterials(projectId || undefined, search || undefined),
  });

  const createMut = useMutation({
    mutationFn: () =>
      createMaterial({
        project_id: projectId || null,
        title: pasteTitle.trim() || undefined,
        content_text: pasteText,
        source_type: "paste",
        source: pasteSource.trim() || null,
        tags: pasteTags.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["materials", projectId] });
      setPasteTitle("");
      setPasteText("");
      setPasteSource("");
      setPasteTags("");
      setErr(null);
    },
    onError: (e) => setErr((e as Error).message),
  });

  const uploadMut = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("请先选择文件");
      const fd = new FormData();
      fd.append("file", file);
      if (projectId) fd.append("project_id", projectId);
      if (upTitle.trim()) fd.append("title", upTitle.trim());
      if (upSource.trim()) fd.append("source", upSource.trim());
      if (upTags.trim()) fd.append("tags", upTags.trim());
      return uploadMaterial(fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["materials", projectId] });
      setFile(null);
      setUpTitle("");
      setUpSource("");
      setUpTags("");
      setErr(null);
    },
    onError: (e) => setErr((e as Error).message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteMaterial(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["materials", projectId] }),
  });

  const list: MaterialMeta[] = listQ.data ?? [];

  return (
    <AppShell title="输入材料">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-5">
          <h1 className="text-[22px] font-bold text-ink">输入材料</h1>
          <p className="text-[13px] text-sub mt-1">
            把长文本粘贴进来，或上传 .txt / .md / .docx / .pdf 文件；材料会解析为正文，
            可在「自动生成向导」的证据步骤一键插入为分析依据。（网页抓取 / 关键词搜索后置）
          </p>
        </div>

        <div className="flex gap-5 items-start">
          {/* 左：新建素材 */}
          <div className="w-[360px] shrink-0 flex flex-col gap-4">
            <div className="card overflow-hidden">
              <div className="h-11 flex items-center px-4 bg-inputbg border-b border-cardborder">
                <span className="text-[13px] font-semibold text-ink">新建素材</span>
              </div>
              {/* tabs */}
              <div className="flex border-b border-cardborder">
                {(["paste", "upload"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`flex-1 h-10 text-[13px] font-medium transition-colors ${
                      tab === t
                        ? "text-navy border-b-2 border-navy bg-white"
                        : "text-sub hover:bg-[#FAFBFC]"
                    }`}
                  >
                    {t === "paste" ? "粘贴文本" : "上传文件"}
                  </button>
                ))}
              </div>

              <div className="p-4 flex flex-col gap-3">
                {tab === "paste" ? (
                  <>
                    <input
                      value={pasteTitle}
                      onChange={(e) => setPasteTitle(e.target.value)}
                      placeholder="素材标题（可选）"
                      className="h-10 rounded-input bg-inputbg border border-cardborder px-3 text-[13px] text-ink outline-none focus:border-navy"
                    />
                    <textarea
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      placeholder="在此粘贴长文本（新闻、公告、判决书、访谈记录…）"
                      className="h-56 rounded-input bg-inputbg border border-cardborder px-3 py-2 text-[13px] text-ink outline-none focus:border-navy resize-none leading-7"
                    />
                    <input
                      value={pasteSource}
                      onChange={(e) => setPasteSource(e.target.value)}
                      placeholder="来源（可选，如：公告链接 / 文号 / 出处说明）"
                      className="h-10 rounded-input bg-inputbg border border-cardborder px-3 text-[13px] text-ink outline-none focus:border-navy"
                    />
                    <input
                      value={pasteTags}
                      onChange={(e) => setPasteTags(e.target.value)}
                      placeholder="标签（可选，逗号分隔，如：政策,业主陈述）"
                      className="h-10 rounded-input bg-inputbg border border-cardborder px-3 text-[13px] text-ink outline-none focus:border-navy"
                    />
                    <div className="text-[11px] text-muted text-right">
                      {pasteText.length} 字
                    </div>
                    <button
                      onClick={() => createMut.mutate()}
                      disabled={createMut.isPending || pasteText.trim().length === 0}
                      className="btn-primary h-10 text-[13px] disabled:opacity-50"
                    >
                      {createMut.isPending ? "保存中…" : "保存素材"}
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      value={upTitle}
                      onChange={(e) => setUpTitle(e.target.value)}
                      placeholder="素材标题（可选，默认用文件名）"
                      className="h-10 rounded-input bg-inputbg border border-cardborder px-3 text-[13px] text-ink outline-none focus:border-navy"
                    />
                    <label className="flex flex-col items-center justify-center gap-2 h-44 rounded-input border-2 border-dashed border-cardborder bg-inputbg cursor-pointer hover:border-navy transition-colors">
                      <input
                        type="file"
                        accept=".txt,.md,.docx,.pdf"
                        className="hidden"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      />
                      <span className="text-[26px] text-muted">＋</span>
                      <span className="text-[12px] text-sub px-4 text-center">
                        {file ? file.name : "点击选择 .txt / .md / .docx / .pdf"}
                      </span>
                      <span className="text-[11px] text-muted">
                        系统按扩展名解析正文
                      </span>
                    </label>
                    <input
                      value={upSource}
                      onChange={(e) => setUpSource(e.target.value)}
                      placeholder="来源（可选，如：公告链接 / 文号）"
                      className="h-10 rounded-input bg-inputbg border border-cardborder px-3 text-[13px] text-ink outline-none focus:border-navy"
                    />
                    <input
                      value={upTags}
                      onChange={(e) => setUpTags(e.target.value)}
                      placeholder="标签（可选，逗号分隔，如：政策,业主陈述）"
                      className="h-10 rounded-input bg-inputbg border border-cardborder px-3 text-[13px] text-ink outline-none focus:border-navy"
                    />
                    <button
                      onClick={() => uploadMut.mutate()}
                      disabled={uploadMut.isPending || !file}
                      className="btn-primary h-10 text-[13px] disabled:opacity-50"
                    >
                      {uploadMut.isPending ? "解析中…" : "上传并解析"}
                    </button>
                  </>
                )}
                {err && (
                  <div className="text-[12px] text-[#C62828]">{err}</div>
                )}
              </div>
            </div>

            {/* 项目筛选 */}
            <div className="card p-4">
              <div className="text-[13px] font-semibold text-ink mb-2">归属项目</div>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full h-10 rounded-input bg-inputbg border border-cardborder px-3 text-[13px] text-ink outline-none focus:border-navy"
              >
                <option value="">全部项目</option>
                {(projects ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <div className="text-[11px] text-muted mt-2 leading-relaxed">
                素材可按项目归类；选「全部项目」时显示所有素材。
              </div>
            </div>
          </div>

          {/* 右：素材列表 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3 gap-3">
              <span className="text-[14px] font-semibold text-ink">
                素材库（{list.length}）
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索标题 / 正文 / 来源 / 标签"
                className="h-9 w-[260px] rounded-input bg-inputbg border border-cardborder px-3 text-[13px] text-ink outline-none focus:border-navy"
              />
            </div>

            {listQ.isLoading ? (
              <LoadingState text="正在加载素材库…" />
            ) : listQ.isError ? (
              <ErrorState
                message={(listQ.error as Error)?.message || "素材库加载失败"}
                onRetry={() => listQ.refetch()}
              />
            ) : list.length === 0 ? (
              <EmptyState
                title="暂无素材"
                hint="从左侧粘贴文本或上传 .txt / .md / .docx / .pdf 文件开始。材料会解析为正文并可在向导中作为证据引用。"
              />
            ) : (
              <div className="flex flex-col gap-3">
                {list.map((m) => {
                  const open = expanded === m.id;
                  return (
                    <div key={m.id} className="card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="text-[11px] px-1.5 py-0.5 rounded-pill shrink-0"
                              style={{
                                background: `${SRC_COLOR[m.source_type]}1A`,
                                color: SRC_COLOR[m.source_type],
                              }}
                            >
                              {SRC_LABEL[m.source_type]}
                            </span>
                            <span className="text-[14px] font-medium text-ink truncate">
                              {m.title}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted mt-1">
                            {m.char_count} 字
                            {m.original_filename ? ` · ${m.original_filename}` : ""}
                            {" · "}
                            {fmtDate(m.created_at)}
                          </div>
                          {(m.source || m.tags) && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {m.source && (
                                <span className="text-[11px] text-sub bg-inputbg border border-cardborder rounded-pill px-2 py-0.5 truncate max-w-[240px]">
                                  来源：{m.source}
                                </span>
                              )}
                              {(m.tags || "")
                                .split(",")
                                .map((t: string) => t.trim())
                                .filter(Boolean)
                                .map((t: string) => (
                                  <span
                                    key={t}
                                    className="text-[11px] text-navy bg-[#F0F4FA] rounded-pill px-2 py-0.5"
                                  >
                                    #{t}
                                  </span>
                                ))}
                            </div>
                          )}
                          {m.warnings && m.warnings.length > 0 && (
                            <div className="flex flex-col gap-1 mt-2">
                              {m.warnings.map((w: string) => (
                                <div
                                  key={w}
                                  className="text-[11px] text-[#B45309] bg-[#FEF3C7] border border-[#FDE68A] rounded-md px-2 py-1"
                                >
                                  ⚠ {WARN_LABEL[w] || w}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => setExpanded(open ? null : m.id)}
                            className="h-8 px-2.5 rounded-md text-[12px] text-navy bg-[#F0F4FA] hover:bg-[#E4ECF6]"
                          >
                            {open ? "收起" : "查看"}
                          </button>
                          <button
                            onClick={() => delMut.mutate(m.id)}
                            disabled={delMut.isPending}
                            className="h-8 px-2.5 rounded-md text-[12px] text-[#C62828] bg-[#FFEBEE] hover:bg-[#FFDDE0]"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                      {open && <MaterialPreview id={m.id} />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

/** 展开查看素材正文（按需拉取完整内容）。 */
function MaterialPreview({ id }: { id: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["material", id],
    queryFn: () =>
      fetch(
        `${process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"}/api/materials/${id}`
      ).then((r) => r.json()),
  });
  if (isLoading) return <LoadingState text="加载正文…" />;
  const text: string = data?.content_text ?? "";
  return (
    <div className="mt-3 rounded-input bg-inputbg border border-cardborder p-3 max-h-72 overflow-y-auto">
      <pre className="whitespace-pre-wrap text-[12px] leading-7 text-ink/90 font-sans">
        {text || "（空）"}
      </pre>
    </div>
  );
}
