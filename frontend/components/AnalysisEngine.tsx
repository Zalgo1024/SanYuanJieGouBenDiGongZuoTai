"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AppShell from "@/components/layout/AppShell";
import {
  ANALYSIS_TABS,
  ANALYSIS_PHASES,
  ANALYSIS_TYPE,
  ANALYSIS_TYPE_LABEL,
  EXPECTED_CHAPTERS,
  describeErrorPhase,
} from "@/lib/constants";
import {
  startAnalyze,
  getAnalyze,
  connectProgress,
  retryTask,
  downloadUrl,
  searchPreview,
  getMaterialStats,
  getSearchSettings,
  getLlmSettings,
  type AnalyzeResult,
  type SearchSettings,
  type SearchHitDTO,
} from "@/lib/api";
import {
  getEngineMode,
  getExplicitEngineMode,
  getLlmConfig,
  setEngineMode,
  type EngineMode,
} from "@/lib/llmConfig";
import { useProjects } from "@/lib/hooks";
import ContractBadge from "@/components/ContractBadge";
import Chip from "@/components/Chip";
import EngineBadge from "@/components/EngineBadge";

export type AnalysisVariant = "engine";

interface AnalysisEngineProps {
  variant: AnalysisVariant;
}

/** 分析引擎展示配置（通用入口）。 */
const VARIANT_CONFIG: Record<
  AnalysisVariant,
  {
    shellTitle: string;
    title: string;
    subtitle: string;
    tabs: string[] | null; // null 表示不展示标签页
    placeholder: string;
  }
> = {
  engine: {
    shellTitle: "分析引擎",
    title: "分析引擎",
    subtitle: "粘贴事件、政策或关键词，系统自动识别。",
    tabs: ANALYSIS_TABS,
    placeholder: "输入关键词、事件描述或网络链接…",
  },
};

/** 标签页 -> 分析类型（T5：5 Tab 真映射，杜绝「组织 Tab 实际走 case」）。 */
// 顺序与 ANALYSIS_TABS 一一对应：事件/政策/组织/舆情/组合
// ANALYSIS_TYPE 从 constants 导入（case|policy|org|opinion|combo）

/**
 * 无 phase 信号时的兜底映射（向后兼容旧后端）。
 * 返回当前活跃步骤的索引（0-5），-1 = 未知。
 */
function fallbackStepIdx(status: string): number {
  if (status === "queued") return 0;
  if (status === "generating") return 2; // decompose
  if (status === "done") return ANALYSIS_PHASES.length; // 全部完成
  return -1;
}

/* ────────────────────────────────────────────────────────────────────── */
/* 智能识别：单输入框解析器                                                 */
/* ────────────────────────────────────────────────────────────────────── */

interface ParsedInput {
  /** 推断的标题（首行非空）。 */
  title: string;
  /** 推断的描述（去掉标题/URL/#tag/项目提示 后的剩余文本）。 */
  description: string;
  /** 抓到的链接列表（保留顺序、去重）。 */
  urls: string[];
  /** `#关键词` 解析结果。 */
  keywords: string[];
  /** `项目:xxx` / `项目：xxx` 的提示文本（用于匹配下拉）。 */
  projectHint: string | null;
  /** 整段去掉碎片的剩余可见文本（含首行），用于回显输入。 */
  visible: string;
}

const URL_RE = /https?:\/\/[^\s，,。；;！!？?)\]】」]+/g;
const TAG_RE = /#([^#\s，,。；;！!？?\]\)）】」]+)/g;
const PROJECT_RE = /项目\s*[:：]\s*([^\n，,。；;！!？?]+)/;

/**
 * 解析单输入框内容。规则：
 * - `https?://…` 自动识别为数据来源；
 * - `#xxx` 自动识别为关键词；
 * - `项目:xxx` / `项目：xxx` 提示归入哪个项目；
 * - 标题不再从首行自动提取，避免用户输入被截断成标题；
 * - 剩余可见文本作为描述。
 * 解析时同步返回「去掉碎片后的可见文本」用于回显，但不强制改写输入。
 */
function parseSmartInput(raw: string): ParsedInput {
  const urls: string[] = [];
  const keywords: string[] = [];
  let projectHint: string | null = null;

  // 1) URL
  const urlMatches = raw.match(URL_RE) || [];
  for (const u of urlMatches) {
    if (!urls.includes(u)) urls.push(u);
  }

  // 2) #tag
  const tagMatches = [...raw.matchAll(TAG_RE)];
  for (const m of tagMatches) {
    const k = m[1]?.trim();
    if (k && !keywords.includes(k)) keywords.push(k);
  }

  // 3) 项目:xxx
  const pm = raw.match(PROJECT_RE);
  if (pm) projectHint = pm[1].trim();

  // 4) 可见文本（去掉所有碎片 + 折叠连续空行）
  const visible = raw
    .replace(URL_RE, "")
    .replace(TAG_RE, "")
    .replace(PROJECT_RE, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // 5) 标题：不再自动提取，统一交给用户/后端决定
  const title = "";
  const description = visible;

  return { title, description, urls, keywords, projectHint, visible };
}

/* ────────────────────────────────────────────────────────────────────── */
/* 组件                                                                  */
/* ────────────────────────────────────────────────────────────────────── */

export default function AnalysisEngine({ variant }: AnalysisEngineProps) {
  const config = VARIANT_CONFIG[variant];
  const [tab, setTab] = useState(0);
  const statsQ = useQuery({
    queryKey: ["material-stats"],
    queryFn: () => getMaterialStats(),
  });

  // 智能输入框原始内容
  const [raw, setRaw] = useState("");
  // 归入项目（手动下拉，优先级高于 raw 里的项目提示）
  const [projectId, setProjectId] = useState<string>("");
  // 引擎模式
  const [engineMode, setEngineModeState] = useState<EngineMode>("rule");
  // 后端是否已配置 LLM key（决定默认引擎与 UI 提示）
  const [llmConfigured, setLlmConfigured] = useState(false);

  const [status, setStatus] = useState<string>("idle");
  const [taskId, setTaskId] = useState("");
  const router = useRouter();
  const [result, setResult] = useState<AnalyzeResult["data"] | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [errorPhase, setErrorPhase] = useState("");
  const [errorType, setErrorType] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [phase, setPhase] = useState<string>("");
  const [progressPct, setProgressPct] = useState(0);
  // 阶段五：联网搜索（可选插件）。true=强制开启 / false=强制跳过 / null=自动
  const [searchOpt, setSearchOpt] = useState<boolean | null>(null);
  // T8：联网写报告开关（默认开）+ 来源预览 + 剔除集合
  const [webOn, setWebOn] = useState(true);
  const [previewState, setPreviewState] = useState<
    "idle" | "loading" | "ready" | "degraded" | "error"
  >("idle");
  const [previewHits, setPreviewHits] = useState<SearchHitDTO[]>([]);
  const [previewProvider, setPreviewProvider] = useState("");
  const [previewDegraded, setPreviewDegraded] = useState<string | null>(null);
  const [excludedUrls, setExcludedUrls] = useState<Set<string>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);
  const taskIdRef = useRef("");
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const { data: projects } = useProjects();

  // 搜索特性运行态（灰度开关 / 是否已配置 API）
  const searchQ = useQuery({
    queryKey: ["search-settings"],
    queryFn: getSearchSettings,
  });
  const searchSettings: SearchSettings | undefined = searchQ.data;
  const searchOffered = searchSettings?.available ?? false; // 灰度是否开放
  const searchConfigured = searchSettings?.configured ?? false; // 是否有 key

  useEffect(() => {
    let active = true;
    getLlmSettings()
      .then((s) => {
        if (!active) return;
        const configured = Boolean(s.has_key);
        setLlmConfigured(configured);
        // 已配置 key 时默认走「AI 增强」：规则引擎面向结构化/离线输入，
        // 对自由文本只能产出占位骨架；若用户曾显式选择过模式，则沿用其选择。
        setEngineModeState(
          configured ? getExplicitEngineMode() ?? "llm" : getEngineMode()
        );
      })
      .catch(() => {
        // 探测失败（如后端未启动）：退回原默认，不阻塞页面
        if (active) setEngineModeState(getEngineMode());
      });
    return () => {
      active = false;
    };
  }, []);

  // 标题（不再从输入框首行自动提取，由用户手动输入；后端完成后可回填）。
  const [title, setTitle] = useState("");

  // 需求：报告展示页「返回上一步」——携带 ?task= 进入时，把该报告正文预填进输入框，
  // 让用户能基于已有报告修改后重新分析（而非从空白重新开始）。
  const backTask = useSearchParams().get("task");
  // T14：案例库「套用」——携带 ?skeleton=（章节骨架+DIAGRAM 结构）与 ?type=（analysis_type）进入
  const skeletonParam = useSearchParams().get("skeleton");
  const typeParam = useSearchParams().get("type");
  useEffect(() => {
    if (!backTask) return;
    let active = true;
    getAnalyze(backTask)
      .then((r) => {
        if (!active) return;
        const md = r.data?.markdown;
        if (md) setRaw(md);
        if (r.data?.title) setTitle(r.data.title);
      })
      .catch(() => {
        /* 后端未启动或任务不存在：忽略，保持空白输入 */
      });
    return () => {
      active = false;
    };
    // 仅在进入页面时预填一次（raw 初始为空）；不依赖 raw 变化重跑
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backTask]);

  // T14 套用骨架：预填章节骨架（清空正文只留标题结构 + DIAGRAM 占位），并切到对应类型 Tab
  useEffect(() => {
    if (skeletonParam) {
      setRaw(skeletonParam);
      if (typeParam) {
        const idx = ANALYSIS_TYPE.indexOf(typeParam as (typeof ANALYSIS_TYPE)[number]);
        if (idx >= 0) setTab(idx);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skeletonParam, typeParam]);

  // 实时解析
  const parsed = useMemo(() => parseSmartInput(raw), [raw]);

  // T8：来源预览检索（调 POST /api/search/preview，即时返回不落库）。
  // 检索词：优先首个 URL，其次关键词/描述首行。
  const previewQuery = useMemo(() => {
    if (parsed.urls.length) return parsed.urls[0];
    const firstLine = (parsed.description || raw).split("\n")[0]?.trim() || "";
    return (firstLine || parsed.keywords[0] || "").slice(0, 80);
  }, [parsed, raw]);

  const fetchPreview = async (q: string) => {
    const query = (q || previewQuery || "").trim();
    if (!query) return;
    setPreviewState("loading");
    try {
      const r = await searchPreview(query);
      setPreviewHits(r.hits ?? []);
      setPreviewProvider(r.provider ?? "");
      setPreviewDegraded(r.degraded ?? null);
      setPreviewState(r.degraded ? "degraded" : r.hits.length ? "ready" : "degraded");
    } catch {
      setPreviewHits([]);
      setPreviewDegraded("检索源不可用（可配置 BING/BRAVE Key 或改用手动 URL 输入）");
      setPreviewState("error");
    }
  };

  // 输入框聚焦/回车时触发来源预览（仅当联网开且尚未有结果）
  const handlePreviewTrigger = () => {
    if (webOn && previewState === "idle" && previewQuery) {
      void fetchPreview(previewQuery);
    }
  };

  /** 解析得到项目提示与下拉项目的最佳匹配 id（仅在没手动选时用）。 */
  const autoProjectId = useMemo(() => {
    if (projectId) return "";
    if (!parsed.projectHint || !projects) return "";
    const hint = parsed.projectHint.toLowerCase().trim();
    const hit = projects.find(
      (p) =>
        p.id.toLowerCase() === hint ||
        p.name.toLowerCase().includes(hint) ||
        hint.includes(p.name.toLowerCase()),
    );
    return hit?.id || "";
  }, [parsed.projectHint, projects, projectId]);

  const effectiveProjectId = projectId || autoProjectId;

  // 自动撑高 textarea
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 360) + "px";
  }, [raw]);

  // 检测到首次输入后 1.5s 自动收起提示
  useEffect(() => {
    if (raw.length > 30 && showHint) {
      const t = setTimeout(() => setShowHint(false), 1500);
      return () => clearTimeout(t);
    }
  }, [raw, showHint]);

  /** 进度通道消息处理（初始提交与重试共用）。 */
  const onProgressMsg = (msg: {
    status: string;
    data?: unknown;
    phase?: string;
    progress_pct?: number;
  }) => {
    setStatus(msg.status);
    if (msg.phase) setPhase(msg.phase as string);
    if (msg.progress_pct != null) setProgressPct(msg.progress_pct as number);
    if (msg.status === "done" && msg.data) {
      setResult(msg.data as AnalyzeResult["data"]);
      // 分析完成后优先跳转到独立报告展示页（更美观、含关系图/来源/下载/调整）
      const tid = taskIdRef.current || taskId;
      if (tid) {
        setTimeout(() => router.push(`/report/${tid}`), 600);
      }
    }
    if (msg.status === "error" && msg.data) {
      // 后端错误 payload 为 {message,type,phase}（实时推送）；
      // 断线重连快照则为 data=错误字符串 + 顶层 phase（无 type）。两者兼容。
      const d = msg.data as { message?: string; type?: string; phase?: string };
      setErrorMsg(d.message || String(msg.data) || "未知错误");
      setErrorPhase(d.phase || msg.phase || "");
      setErrorType(d.type || "");
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const desc = parsed.description || parsed.visible || "（无描述）";
      const input_text = [
        parsed.keywords.length && `关键词：${parsed.keywords.join("、")}`,
        desc && `分析描述：${desc}`,
        parsed.urls.length && `数据来源：${parsed.urls.join("  ")}`,
      ]
        .filter(Boolean)
        .join("\n");
      const payload: Parameters<typeof startAnalyze>[0] = {
        title: title.trim() || "未命名分析",
        input_text,
        analysis_type: ANALYSIS_TYPE[tab],
        mode: engineMode,
      };
      if (engineMode === "llm") {
        const c = getLlmConfig();
        payload.llm_config = {
          model: c.model,
          temperature: c.temperature,
          prompt_version: c.prompt_version,
        };
      }
      if (effectiveProjectId) {
        payload.project_id = effectiveProjectId;
      }
      // 阶段五：联网搜索开关（可选插件）。仅在灰度开放时传，避免对关闭环境发无意义请求
      if (searchOffered) {
        payload.search = searchOpt; // true=强制 / false=跳过 / null=自动
      }
      // T8：联网写报告（默认开）。勾选的来源白名单 = 未剔除的 URL；无勾选则后端自动检索全部。
      payload.web = webOn;
      if (webOn) {
        const kept = previewHits
          .filter((h) => !excludedUrls.has(h.url))
          .map((h) => h.url);
        if (kept.length) payload.source_urls = kept;
      }
      const { task_id } = await startAnalyze(payload);
      return task_id;
    },
    onSuccess: (task_id) => {
      setTaskId(task_id);
      taskIdRef.current = task_id;
      setStatus("queued");
      setErrorMsg("");
      setErrorPhase("");
      setErrorType("");
      setResult(null);
      setPhase("");
      setProgressPct(0);
      wsRef.current = connectProgress(task_id, onProgressMsg);
    },
    onError: (e: Error) => {
      setStatus("error");
      setErrorMsg(e.message);
      setErrorPhase("");
      setErrorType("");
    },
  });

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  const running = status === "queued" || status === "generating";
  const done = status === "done";

  // 计算当前活跃步骤索引：优先用后端推送的 phase，兜底用 status 映射
  const isSearchSkipped = phase === "search_skipped";
  const activeStepIdx = isSearchSkipped
    ? 1 // 「全网搜索」被跳过时，第 2 步标记跳过，进度继续流转
    : phase
      ? Math.max(0, ANALYSIS_PHASES.findIndex((p) => p.key === phase))
      : fallbackStepIdx(status);
  const totalSteps = ANALYSIS_PHASES.length;
  const completedSteps = done ? totalSteps : activeStepIdx;
  const canSubmit = !running && raw.trim().length > 0;

  // 错误时定位到具体步骤（第 X 步（名称））— 阶段七：error_phase 精确定位
  const { stepNo: errStepNo, label: errStepLabel } = describeErrorPhase(errorPhase);

  /** 重试失败的任务：后端新建任务继承参数，前端切到新 WS 通道。 */
  const handleRetry = async () => {
    if (!taskId || running || retrying) return;
    setRetrying(true);
    try {
      const r = await retryTask(taskId);
      wsRef.current?.close();
      setTaskId(r.new_task_id);
      setStatus("queued");
      setErrorMsg("");
      setErrorPhase("");
      setErrorType("");
      setResult(null);
      setPhase("");
      setProgressPct(0);
      wsRef.current = connectProgress(r.new_task_id, onProgressMsg);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "重试失败");
      setStatus("error");
    } finally {
      setRetrying(false);
    }
  };

  /** 把当前已识别的碎片以可读形式写回输入框（用来「格式化」）。 */
  const formatInput = () => {
    const blocks: string[] = [];
    if (parsed.description) blocks.push(parsed.description);
    for (const k of parsed.keywords) blocks.push(`#${k}`);
    for (const u of parsed.urls) blocks.push(u);
    setRaw(blocks.join("\n"));
  };

  return (
    <AppShell title={config.shellTitle}>
      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-[22px] font-bold text-ink">{config.title}</h1>
          <p className="text-[13px] text-sub mt-1">{config.subtitle}</p>
        </div>

        {/* Tabs（仅分析引擎展示） */}
        {config.tabs && (
          <div className="flex items-end gap-3 border-b border-cardborder mb-5 flex-wrap">
            <div className="flex gap-1">
              {config.tabs.map((t, i) => (
                <button
                  key={t}
                  onClick={() => {
                    setTab(i);
                    // 切类型时清掉旧来源预览（类型变化后检索词可能不同）
                    setPreviewState("idle");
                  }}
                  className={`h-10 px-4 text-[14px] font-medium border-b-2 -mb-px transition-colors ${
                    tab === i
                      ? "border-navy text-navy"
                      : "border-transparent text-sub hover:text-ink"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            {/* T5 双轨护栏显性化：当前判定类型 + 预计章节数 */}
            <div className="text-[12px] text-sub pb-2">
              当前类型：
              <span className="text-navy font-medium">
                {ANALYSIS_TYPE_LABEL[ANALYSIS_TYPE[tab]]}
              </span>
              {" · 预计章节数："}
              <span className="text-navy font-medium">
                {EXPECTED_CHAPTERS[ANALYSIS_TYPE[tab]] === 0
                  ? "按作者源序"
                  : `${EXPECTED_CHAPTERS[ANALYSIS_TYPE[tab]]} 段`}
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-[1fr_320px] gap-5">
          {/* Left: 智能单输入框 */}
          <div className="card p-6 flex flex-col gap-4">
            {/* 输入框本体 */}
            <div className="rounded-input border border-cardborder bg-inputbg focus-within:border-navy transition-colors">
              <textarea
                ref={taRef}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                onFocus={() => {
                  setShowHint(true);
                  handlePreviewTrigger();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handlePreviewTrigger();
                  }
                }}
                placeholder={config.placeholder}
                className="w-full bg-transparent px-4 pt-3.5 pb-2 text-[14px] text-ink outline-none placeholder:text-muted resize-none leading-relaxed min-h-[160px] max-h-[360px]"
                rows={6}
              />

              {/* 已识别 chips */}
              {/* 标题：独立可编辑输入框，不再从首行自动提取 */}
              {(raw.trim().length > 0 ||
                parsed.keywords.length ||
                parsed.urls.length ||
                parsed.projectHint) && (
                <div className="px-4 pb-3 flex flex-wrap gap-1.5 items-center">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="输入标题（默认：未命名分析）"
                    className="h-7 min-w-[180px] max-w-[360px] rounded-input border border-cardborder bg-white px-2.5 text-[12px] text-ink outline-none focus:border-navy"
                    title="分析标题，可手动修改；分析完成后可由平台自动回填"
                  />
                  {parsed.keywords.map((k, i) => (
                    <Chip key={`k${i}`} tone="tag" label={k} />
                  ))}
                  {parsed.urls.map((u, i) => (
                    <Chip key={`u${i}`} tone="url" label={u} />
                  ))}
                  {parsed.projectHint && (
                    <Chip tone="project" label={parsed.projectHint} />
                  )}
                </div>
              )}

              {/* 输入框底部工具条：项目选择 + 引擎切换 + 启动 */}
              <div className="flex items-center gap-2 px-3 pb-3 pt-1 border-t border-cardborder/60 flex-wrap">
                <select
                  className="h-8 rounded-input bg-white border border-cardborder px-2 text-[12px] text-ink outline-none focus:border-navy"
                  value={effectiveProjectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  title="归入项目"
                >
                  <option value="">不归入项目</option>
                  {(projects ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                <div className="flex rounded-input border border-cardborder overflow-hidden">
                  <button
                    onClick={() => {
                      setEngineModeState("rule");
                      setEngineMode("rule");
                    }}
                    className={`px-3 h-8 text-[12px] ${
                      engineMode === "rule"
                        ? "bg-navy text-white"
                        : "bg-white text-sub hover:text-ink"
                    }`}
                  >
                    规则引擎
                  </button>
                  <button
                    onClick={() => {
                      setEngineModeState("llm");
                      setEngineMode("llm");
                    }}
                    className={`px-3 h-8 text-[12px] border-l border-cardborder ${
                      engineMode === "llm"
                        ? "bg-navy text-white"
                        : "bg-white text-sub hover:text-ink"
                    }`}
                  >
                    {llmConfigured ? "AI 增强 ✓" : "AI 增强"}
                  </button>
                </div>

                {/* 阶段五：联网搜索（可选插件）。灰度开放时才显示；勾选=强制开启，不勾=自动判断 */}
                {searchOffered && (
                  <label
                    className="flex items-center gap-1.5 h-8 px-2.5 rounded-input border border-cardborder bg-white text-[12px] text-ink cursor-pointer select-none"
                    title={
                      searchConfigured
                        ? "勾选后将联网检索补充背景（可选增强），不勾则由系统自动判断"
                        : "尚未配置搜索 API Key，勾选也不会真正发起搜索（将自动跳过）"
                    }
                  >
                    <input
                      type="checkbox"
                      checked={searchOpt === true}
                      onChange={(e) => setSearchOpt(e.target.checked ? true : null)}
                      className="accent-navy"
                    />
                    联网搜索
                    {!searchConfigured && (
                      <span className="text-[11px] text-amber-600">未配置</span>
                    )}
                  </label>
                )}

                {/* T8：联网写报告开关（默认开） */}
                <label
                  className="flex items-center gap-1.5 h-8 px-2.5 rounded-input border border-cardborder bg-white text-[12px] text-ink cursor-pointer select-none"
                  title="开启后系统将联网检索/抓取素材写入报告；关闭则只用你输入的内容"
                >
                  <input
                    type="checkbox"
                    checked={webOn}
                    onChange={(e) => {
                      setWebOn(e.target.checked);
                      if (!e.target.checked) setPreviewState("idle");
                    }}
                    className="accent-navy"
                  />
                  联网写报告
                </label>

                <div className="ml-auto flex items-center gap-2">
                  {(parsed.description ||
                    parsed.keywords.length ||
                    parsed.urls.length) && (
                    <button
                      onClick={formatInput}
                      className="h-8 px-3 rounded-input text-[12px] text-sub hover:text-ink border border-cardborder bg-white"
                      title="把识别到的碎片整理到正式格式"
                    >
                      整理格式
                    </button>
                  )}
                  <button
                    className="btn-primary h-8 px-4 text-[13px] disabled:opacity-60"
                    disabled={!canSubmit}
                    onClick={() => mutation.mutate()}
                  >
                    {running ? "生成中…" : "启动分析"}
                  </button>
                </div>
              </div>

              {engineMode === "rule" && llmConfigured && (
                <div className="px-3 pb-2 -mt-1 text-[12px] text-amber-600">
                  ⓘ 规则引擎基于结构化输入（主体/利益/证据），当前为自由文本只会生成占位骨架；建议切到「AI 增强」获得真实分析。
                </div>
              )}
            </div>

            {/* T8：来源预览列表（联网写报告开启时展示，可勾选/剔除后再提交） */}
            {webOn && (
              <div className="rounded-input border border-cardborder bg-white">
                <div className="flex items-center justify-between px-4 pt-3 pb-1">
                  <div className="text-[12px] font-medium text-ink">
                    检索来源预览
                    {previewState === "ready" && (
                      <span className="ml-2 text-[11px] text-muted uppercase">
                        {previewProvider}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {previewHits.length > 0 && excludedUrls.size > 0 && (
                      <button
                        onClick={() => setExcludedUrls(new Set())}
                        className="text-[11px] text-navy hover:underline"
                      >
                        恢复全部
                      </button>
                    )}
                    <button
                      onClick={() => void fetchPreview(previewQuery)}
                      disabled={previewState === "loading" || !previewQuery}
                      className="text-[11px] text-navy hover:underline disabled:opacity-40"
                    >
                      {previewState === "loading" ? "检索中…" : "检索来源"}
                    </button>
                  </div>
                </div>
                <div className="px-4 pb-3">
                  {previewState === "loading" && (
                    <div className="text-[12px] text-muted py-2">正在检索来源…</div>
                  )}
                  {previewState === "error" && (
                    <div className="text-[12px] text-[#C62828] py-2 leading-relaxed">
                      ⚠ {previewDegraded}
                    </div>
                  )}
                  {previewState === "degraded" && previewHits.length === 0 && (
                    <div className="text-[12px] text-amber-600 py-2 leading-relaxed">
                      ⚠ {previewDegraded ?? "检索源不可用，可配置 BING/BRAVE Key 或改用手动 URL 输入"}
                    </div>
                  )}
                  {previewHits.length > 0 && (
                    <ul className="flex flex-col gap-1.5 mt-1">
                      {previewHits.map((h, i) => {
                        const excluded = excludedUrls.has(h.url);
                        return (
                          <li
                            key={`${h.url}-${i}`}
                            className={`flex items-start gap-2 rounded-input border px-2.5 py-2 ${
                              excluded
                                ? "border-cardborder bg-[#F9FAFB] opacity-60"
                                : "border-cardborder bg-white"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={!excluded}
                              onChange={(e) => {
                                const next = new Set(excludedUrls);
                                if (e.target.checked) next.delete(h.url);
                                else next.add(h.url);
                                setExcludedUrls(next);
                              }}
                              className="accent-navy mt-0.5 shrink-0"
                              title={excluded ? "已剔除（点击恢复）" : "勾选后写入报告素材"}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-[12px] text-ink leading-snug truncate">
                                {h.title || h.url}
                              </div>
                              {h.snippet && (
                                <div className="text-[11px] text-sub leading-relaxed line-clamp-2">
                                  {h.snippet}
                                </div>
                              )}
                              <a
                                href={h.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-navy hover:underline truncate block"
                              >
                                {h.url}
                              </a>
                            </div>
                            <button
                              onClick={() => {
                                const next = new Set(excludedUrls);
                                if (excluded) next.delete(h.url);
                                else next.add(h.url);
                                setExcludedUrls(next);
                              }}
                              className="text-[11px] text-sub hover:text-[#E74C3C] shrink-0"
                            >
                              {excluded ? "恢复" : "剔除"}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {previewState === "ready" && previewHits.length === 0 && (
                    <div className="text-[12px] text-muted py-1">未检索到来源。</div>
                  )}
                </div>
              </div>
            )}

            {/* 提示/帮助 */}
            {showHint && (
              <div className="rounded-input bg-[#F0F4FA] border border-navy/20 px-4 py-2.5 text-[12px] text-sub leading-relaxed">
                支持关键词、事件/政策描述、网络链接。系统会自动识别分析对象。
              </div>
            )}

            {status === "error" && (
              <div className="flex items-start gap-2 rounded-input border border-interest-material/40 bg-[#FFEBEE] px-3 py-2.5">
                <span className="text-interest-material text-[15px] leading-none mt-0.5">
                  ⚠
                </span>
                <div className="text-[13px] text-[#C62828]">
                  {errStepNo
                    ? `第 ${errStepNo} 步（${errStepLabel}）失败：${errorMsg}`
                    : `分析失败：${errorMsg}`}
                  <div className="text-[12px] text-sub mt-1">
                    已定位到具体步骤，可重新分析；若反复失败请检查后端日志。
                  </div>
                  <button
                    type="button"
                    onClick={handleRetry}
                    disabled={retrying}
                    className="btn-ghost h-8 text-[12px] mt-2 px-3 disabled:opacity-50"
                  >
                    {retrying ? "重试中…" : "重新分析"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: 进度 + 材料概览 */}
          <div className="flex flex-col gap-5">
            <div className="card p-5">
              <div className="text-[14px] font-semibold text-ink mb-3">
                分析进度
              </div>
              {done ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-[13px] text-[#2E7D32]">
                    <span className="w-5 h-5 rounded-full bg-[#2E7D32] text-white text-[12px] flex items-center justify-center">
                      ✓
                    </span>
                    分析完成，报告已生成
                  </div>
                  <EngineBadge data={result} />
                  <ContractBadge contract={result?.contract} />
                  <div className="flex flex-col gap-2">
                    <a
                      href={taskId ? downloadUrl(taskId, "word") : "#"}
                      className="btn-primary h-9 text-[13px] flex items-center justify-center"
                    >
                      下载 Word (.docx)
                    </a>
                    {result?.pdf_available ? (
                      <a
                        href={taskId ? downloadUrl(taskId, "pdf") : "#"}
                        className="btn-ghost h-9 text-[13px] flex items-center justify-center"
                      >
                        下载 PDF
                      </a>
                    ) : (
                      <div className="rounded-input border border-cardborder bg-white px-3 py-2 text-[12px] text-sub leading-relaxed">
                        <span className="text-[#2E7D32] font-medium">
                          Word 可用
                        </span>
                        ，PDF 待配置（本机未安装 LibreOffice 等转换引擎；装好后 PDF
                        将自动恢复）。
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {/* 进度条 */}
                  {(running || progressPct > 0) && (
                    <div className="mb-1">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[12px] text-sub">
                          {running ? "分析进行中" : "准备中…"}
                        </span>
                        <span className="text-[12px] font-medium text-navy">
                          {progressPct}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-track overflow-hidden">
                        <div
                          className="h-full rounded-full bg-navy transition-all duration-500 ease-out"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {ANALYSIS_PHASES.map((p, i) => {
                    const skipped = isSearchSkipped && i === 1; // 第 2 步「全网搜索」被跳过
                    const state = skipped
                      ? "skip"
                      : completedSteps > i
                        ? "done"
                        : i === activeStepIdx && running
                          ? "active"
                          : "wait";
                    return (
                      <div key={p.key} className="flex items-center gap-2.5">
                        <span
                          className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center shrink-0 ${
                            state === "done"
                              ? "bg-[#2E7D32] text-white"
                              : state === "active"
                                ? "bg-navy text-white animate-pulse"
                                : state === "skip"
                                  ? "bg-amber-100 text-amber-700 border border-amber-300"
                                  : "bg-track text-muted"
                          }`}
                        >
                          {state === "done" ? "✓" : state === "skip" ? "–" : i + 1}
                        </span>
                        <div className="flex flex-col">
                          <span
                            className={`text-[13px] ${
                              state === "wait"
                                ? "text-sub"
                                : "text-ink font-medium"
                            }`}
                          >
                            {p.label}
                          </span>
                          {state === "active" && (
                            <span className="text-[11px] text-muted">
                              {phase === "search" ? "正在联网检索…" : p.desc}
                            </span>
                          )}
                          {state === "skip" && (
                            <span className="text-[11px] text-amber-600">
                              已跳过（
                              {!searchOffered
                                ? "灰度未开放"
                                : !searchConfigured
                                  ? "未配置搜索 API"
                                  : "自动判断无需检索"}
                              ）
                            </span>
                          )}
                        </div>
                        <span className="ml-auto text-[11px] text-muted">
                          {state === "done"
                            ? "完成"
                            : state === "active"
                              ? "进行中"
                              : state === "skip"
                                ? "已跳过"
                                : "等待"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* T8：联网检索补充（done 且执行过检索时展示；新结构 hits[]/sources[]） */}
            {done && (result?.search_results?.hits?.length ?? 0) > 0 && (
              <div className="card p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[14px] font-semibold text-ink">
                    联网检索补充
                  </div>
                  <span className="text-[11px] text-muted uppercase">
                    {result?.search_results?.provider}
                  </span>
                </div>
                <div className="text-[11px] text-sub mb-2 truncate">
                  检索词：{result?.search_results?.query}
                  {result?.search_results?.degraded && (
                    <span className="text-amber-600">
                      {" "}
                      ⚠ {result.search_results.degraded}
                    </span>
                  )}
                </div>
                <ul className="flex flex-col gap-2">
                  {result?.search_results?.hits.map((h, i) => (
                    <li
                      key={`${h.url}-${i}`}
                      className="text-[12px] text-ink leading-relaxed border-l-2 border-navy/30 pl-2"
                    >
                      {h.title && <span className="font-medium">{h.title}：</span>}
                      {h.snippet}
                      <a
                        href={h.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-[11px] text-navy hover:underline truncate"
                      >
                        {h.url}
                      </a>
                    </li>
                  ))}
                </ul>
                {result?.search_results?.sources &&
                  result.search_results.sources.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1">
                      <div className="text-[11px] text-muted">素材来源（已抓取正文）：</div>
                      {result.search_results.sources.map((src, i) => (
                        <a
                          key={`${src.url}-${i}`}
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-navy hover:underline truncate"
                        >
                          🔗 {src.title || src.url}
                        </a>
                      ))}
                    </div>
                  )}
              </div>
            )}

            {/* 已开放但本任务未检索时的轻提示 */}
            {done &&
              searchOffered &&
              (result?.search_results?.hits?.length ?? 0) === 0 && (
                <div className="rounded-input border border-cardborder bg-white px-3 py-2 text-[12px] text-sub leading-relaxed">
                  本次未执行联网搜索（
                  {searchConfigured ? "系统判断无需检索或检索无结果" : "未配置搜索 API"}）。
                </div>
              )}

            <div className="card p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[14px] font-semibold text-ink">材料来源</div>
                <Link
                  href="/materials"
                  className="text-[12px] text-navy hover:underline"
                >
                  查看统计
                </Link>
              </div>
              <p className="text-[12px] text-sub leading-relaxed">
                {statsQ.isLoading
                  ? "正在统计已入库材料…"
                  : statsQ.data
                    ? `已入库 ${statsQ.data.total} 份材料（${statsQ.data.by_type.pdf || 0} 份 PDF / ${
                        statsQ.data.by_type.docx || 0
                      } 份 Word / ${statsQ.data.by_type.paste || 0} 份粘贴）。`
                    : "暂无入库材料。"}
              </p>
              <p className="text-[12px] text-muted mt-2 leading-relaxed">
                在「输入材料」页粘贴文本或上传文件，分析时可在向导中作为证据引用。
              </p>
            </div>
          </div>
        </div>

        {/* 结果预览 */}
        {done && result?.markdown && (
          <div className="card p-6 mt-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[14px] font-semibold text-ink">
                报告预览
              </div>
              <span className="text-[12px] text-muted">
                {result.title || title || "未命名分析"}
              </span>
            </div>
            <div className="md-body max-h-[520px] overflow-auto border border-cardborder rounded-input p-5 bg-white">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {result.markdown}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
