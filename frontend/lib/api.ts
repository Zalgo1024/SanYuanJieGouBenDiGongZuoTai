// 后端 API 客户端 — 仅本地联调（后端绑定 127.0.0.1:8000，不外放）。
const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

export interface AnalyzePayload {
  title: string;
  input_text?: string;
  analysis_type?: "case" | "policy" | "org" | "opinion" | "combo";
  mode?: "rule" | "llm";
  structured?: unknown;
  // 阶段四：LLM 增强模式下，前端只传模型/温度/提示词版本——**绝不传 api_key**。
  // 密钥由后端解析（data/llm_settings.json 或 .env），保证「API Key 不写入前端」。
  llm_config?: { model?: string; temperature?: number; prompt_version?: string };
  project_id?: string | null; // 归入项目（可选）；空 = 不归入
  material_ids?: string[]; // 阶段三：本次分析使用的材料（证据出处）
  // 阶段五：联网搜索（可选插件）。true=强制开启 / false=强制跳过 / 不传(null)=自动（已配置且值得搜才搜）
  search?: boolean | null;
  // T8：联网写报告（检索/抓取素材注入）。默认开；source_urls=用户勾选来源白名单（null=自动检索全部）。
  web?: boolean;
  source_urls?: string[];
}

/** 来源预览命中（T8）。 */
export interface SearchHitDTO {
  title: string;
  url: string;
  snippet: string;
}

/** 来源预览响应（POST /api/search/preview，T8）。 */
export interface SearchPreviewResult {
  query: string;
  provider: string;
  hits: SearchHitDTO[];
  degraded: string | null;
}

/** 检索结果（done 载荷 search_results，T1/T8 新结构；保留 snippets 兼容旧前端）。 */
export interface SearchResultsDTO {
  query: string;
  provider: string;
  hits: { title: string; url: string; snippet: string }[];
  snippets: string[]; // 兼容字段（旧 AnalysisEngine 读取）
  sources: { title: string; url: string }[]; // 来源清单（附录唯一真源）
  degraded: string | null;
}

/** LLM/规则引擎输出的「契约校验」结果（后端 app/contract.py 计算并透传）。 */
export interface ContractInfo {
  valid: boolean; // 整体是否通过（DIAGRAM 合法 + 必要章节齐全）
  diagram_ok: boolean; // DIAGRAM 是否存在且为合法 JSON
  diagram_synthetic: boolean; // 关系图是否为后端合成（原始缺失/损坏）
  missing_sections: string[]; // 缺失的必要章节
  errors: string[]; // 校验发现的问题（含已修复项）
  repaired: boolean; // 是否做过自动修复
  mode: "rule" | "llm"; // 来源引擎
}

export interface AnalyzeResult {
  task_id?: string;
  status?: string;
  // 阶段四：顶层引擎标注（get_result / poll 透出）
  engine_used?: "rule" | "llm";
  degraded_from_llm?: boolean;
  degrade_reason?: string | null;
  prompt_version?: string | null;
  llm_model?: string | null;
  data?: {
    markdown?: string;
    word?: string;
    pdf?: string;
    pdf_available?: boolean; // 是否真正生成了 PDF（否则仅 Word 可用）
    diagrams?: unknown[];
    title?: string;
    contract?: ContractInfo; // 结构契约校验结果（前端徽标用）
    // 阶段五：done 时后端把搜索结果一并带入 data（WS 直推即可展示，无需再轮询）
    search_results?: SearchResultsDTO | null;
    // 阶段四：done 时后端结果也带引擎标注（WebSocket 直接推 result dict）
    engine_used?: "rule" | "llm";
    degraded_from_llm?: boolean;
    degrade_reason?: string | null;
    prompt_version?: string | null;
    llm_model?: string | null;
  };
  error?: string;
  // 阶段五：联网搜索结果（done 时若执行过搜索则非空；跳过则为 null）
  search_results?: SearchResultsDTO | null;
}

/** 搜索特性运行态（GET /api/settings/search，脱敏）。 */
export interface SearchSettings {
  available: boolean; // 灰度总开关是否开放（SEARCH_ENABLED != off）
  configured: boolean; // 是否已配置搜索 API Key（实际能发起搜索的前提）
  provider: string; // serper / tavily / mock
  enabled_mode: string; // on / off / auto
}

/** 读取搜索特性运行态（前端据此决定是否展示「联网搜索」开关）。 */
export async function getSearchSettings(): Promise<SearchSettings> {
  const res = await fetch(`${BASE}/api/settings/search`);
  if (!res.ok) throw new Error(`获取搜索设置失败: ${res.status}`);
  return res.json();
}

/** 发起分析：立即返回 task_id，后台异步生成。 */
export async function startAnalyze(
  payload: AnalyzePayload
): Promise<{ task_id: string }> {
  const res = await fetch(`${BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`分析请求失败: ${res.status}`);
  return res.json();
}

/** T8 来源预览：即时检索，不落库。degraded 非空时提示「检索源不可用」。 */
export async function searchPreview(query: string): Promise<SearchPreviewResult> {
  const res = await fetch(`${BASE}/api/search/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`来源预览失败: ${res.status}`);
  return res.json();
}

/** 取任务结果（轮询兜底，主要走 WebSocket）。 */
export async function getAnalyze(taskId: string): Promise<AnalyzeResult> {
  const res = await fetch(`${BASE}/api/analyze/${taskId}`);
  return res.json();
}

/** 重试一个失败的任务：后端新建任务（继承标题/输入/模式/材料/搜索开关），返回新任务 id。 */
export interface RetryResult {
  new_task_id: string;
  retry_of: string;
  attempt_no: number;
}
export async function retryTask(taskId: string): Promise<RetryResult> {
  const res = await fetch(`${BASE}/api/analyze/${taskId}/retry`, { method: "POST" });
  if (!res.ok) throw new Error(`重试请求失败: ${res.status}`);
  return res.json();
}

// ============ LLM 设置（密钥只在后端，前端不持有明文 key） ============

/** 后端返回的脱敏 LLM 设置概览（不含明文 key）。 */
export interface LlmSettingsPublic {
  has_settings: boolean;
  has_key: boolean;
  provider: string;
  model: string;
  base_url_masked: string;
  prompt_version: string;
  temperature: number | null;
}

/** 写 LLM 设置（含密钥）—— 仅在此处提交一次，后端存盘；前端不持久化 key。 */
export interface LlmSettingsInput {
  provider?: string;
  api_key?: string;
  base_url?: string;
  model?: string;
  temperature?: number;
  prompt_version?: string;
}

/** 读取脱敏概览（是否配置、模型、脱敏地址、提示词版本）。 */
export async function getLlmSettings(): Promise<LlmSettingsPublic> {
  const res = await fetch(`${BASE}/api/settings/llm`);
  if (!res.ok) throw new Error(`获取 LLM 设置失败: ${res.status}`);
  return res.json();
}

/** 保存 LLM 设置（密钥提交到后端，前端不保留）。 */
export async function saveLlmSettings(
  body: LlmSettingsInput
): Promise<LlmSettingsPublic> {
  const res = await fetch(`${BASE}/api/settings/llm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`保存 LLM 设置失败: ${res.status}`);
  return res.json();
}

// ============ 通用应用配置（设置页：开关/偏好落后端，不再是纯前端） ============

/** 通用应用配置（落后端 data/app_config.json；GET 返回合并默认值后的完整配置）。 */
export interface AppConfig {
  engine_mode: "rule" | "llm";
  default_analysis_level: string;
  default_weight_system: string;
  default_depth: string;
  report_language: string;
  chart_palette: string;
  notify_on_done: boolean;
  weekly_digest: boolean;
}

/** 读取通用应用配置（合并默认值）。 */
export async function getAppConfig(): Promise<AppConfig> {
  const res = await fetch(`${BASE}/api/settings/config`);
  if (!res.ok) throw new Error(`获取应用配置失败: ${res.status}`);
  return res.json();
}

/** 部分更新通用应用配置（仅传入需要变更的字段）。 */
export async function saveAppConfig(body: Partial<AppConfig>): Promise<AppConfig> {
  const res = await fetch(`${BASE}/api/settings/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`保存应用配置失败: ${res.status}`);
  return res.json();
}

/** 连接进度通道：返回 WebSocket 实例，onMsg 收到 {status,data,phase?,progress_pct?}。 */
export function connectProgress(
  taskId: string,
  onMsg: (msg: { status: string; data?: unknown; phase?: string; progress_pct?: number }) => void
): WebSocket {
  const ws = new WebSocket(`ws://127.0.0.1:8000/ws/progress/${taskId}`);
  ws.onmessage = (e) => onMsg(JSON.parse(e.data));
  return ws;
}

/** 下载生成的报告文件。version 可选：指定某次修订版（人工修订版也能导出）。 */
export function downloadUrl(
  taskId: string,
  kind: "word" | "pdf" = "word",
  version?: string
) {
  const q = version ? `?kind=${kind}&version=${version}` : `?kind=${kind}`;
  return `${BASE}/api/download/${taskId}${q}`;
}

// ============ 报告版本（原始生成版 / 人工修订版） ============

export interface ReportVersionMeta {
  id: string;
  version_no: number; // v1/v2/v3…
  kind: "original" | "revised";
  edited_by: "human" | "ai"; // 手动改 / AI 再改
  summary: string | null; // 改动摘要
  note: string | null;
  editor: string | null;
  created_at: string | null;
  is_current: boolean;
}

export interface ReportVersionList {
  task_id: string;
  title: string;
  current_version_id: string;
  versions: ReportVersionMeta[];
}

export interface ReportVersionFull {
  id: string;
  version_no: number;
  kind: string;
  edited_by: "human" | "ai";
  summary: string | null;
  note: string | null;
  editor: string | null;
  created_at: string | null;
  is_current: boolean;
  content_markdown: string;
  content_html: string | null;
}

/** 报告版本列表（首次访问后端自动播种 original 版本）。 */
export async function getReportVersions(taskId: string): Promise<ReportVersionList> {
  const res = await fetch(`${BASE}/api/reports/${taskId}`);
  if (!res.ok) throw new Error(`获取版本失败: ${res.status}`);
  return res.json();
}

/** 取单个版本完整内容。 */
export async function getReportVersion(
  taskId: string,
  vid: string
): Promise<ReportVersionFull> {
  const res = await fetch(`${BASE}/api/reports/${taskId}/versions/${vid}`);
  if (!res.ok) throw new Error(`获取版本内容失败: ${res.status}`);
  return res.json();
}

/** 保存一次人工修订版（返回新版本元信息）。 */
export async function saveReportVersion(
  taskId: string,
  body: { content_html?: string; content_markdown: string; note?: string }
): Promise<ReportVersionMeta> {
  const res = await fetch(`${BASE}/api/reports/${taskId}/versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`保存修订版失败: ${res.status}`);
  return res.json();
}

/** T13 AI 再改：基于当前版本全文 + 指令生成新版本并重渲。 */
export async function reviseReport(
  taskId: string,
  body: { instruction: string; llm_config?: { model?: string; temperature?: number; prompt_version?: string } }
): Promise<ReportVersionMeta & { word: string | null; pdf_available: boolean; render_warning?: string }> {
  const res = await fetch(`${BASE}/api/reports/${taskId}/revise`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `AI 再改失败: ${res.status}`;
    try {
      const j = await res.json();
      if (j?.message) msg = j.message;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json();
}

/** T13 回滚到指定版本：切换 is_current 并重渲产物。 */
export interface RollbackResult {
  ok: boolean;
  current_version_id: string;
  version_no: number;
  word: string | null;
  pdf_available: boolean;
  render_warning?: string;
}
export async function rollbackVersion(vid: string): Promise<RollbackResult> {
  const res = await fetch(`${BASE}/api/versions/${vid}/rollback`, { method: "POST" });
  if (!res.ok) throw new Error(`回滚失败: ${res.status}`);
  return res.json();
}

/** 删除整篇报告（含所有版本与产物文件）。不可恢复，前端需二次确认。 */
export async function deleteReport(taskId: string): Promise<{ status: string }> {
  const res = await fetch(`${BASE}/api/reports/${taskId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`删除报告失败: ${res.status}`);
  return res.json();
}

// ============ 账本查询（阶段三：前端接真实数据） ============

/** 项目（分析报告归属）。后端 /api/projects 返回结构。 */
export interface ProjectDTO {
  id: string;
  name: string;
  description: string;
  status: string; // 进行中 / 已完成
  subjects: string; // 利益主体数（字符串）
  interests: string; // 利益项数
  chapters: string; // 报告章节数
  progress: string; // 完成度（如 "68%"）
  owner_name: string | null;
  updated_at: string | null; // ISO 时间
}

/** 分析任务（报告）。后端 /api/tasks 返回结构。 */
export interface TaskDTO {
  task_id: string;
  title: string;
  status: "queued" | "generating" | "done" | "error";
  analysis_type: string;
  project_id: string | null;
  created_at: string | null; // ISO 时间
}

export interface TaskListParams {
  project_id?: string;
  status?: string;
  limit?: number;
}

/** 项目列表（账本查询）。 */
export async function getProjects(): Promise<ProjectDTO[]> {
  const res = await fetch(`${BASE}/api/projects`);
  if (!res.ok) throw new Error(`获取项目失败: ${res.status}`);
  return res.json();
}

/** 删除项目（硬删除），会级联删除其下任务与产物文件；需二次确认。 */
export async function deleteProject(
  id: string
): Promise<{ ok: boolean; project_id: string; tasks_deleted: number }> {
  const res = await fetch(`${BASE}/api/projects/${id}?confirm=true`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`删除项目失败: ${res.status}`);
  return res.json();
}

/** 批量删除项目（硬删除），级联删除各自下任务与产物文件；需二次确认。 */
export interface BulkDeleteResult {
  ok: boolean;
  deleted: { id: string; tasks_deleted: number; report_versions_deleted: number; files_removed: number; materials_unlinked: number }[];
  failed: { id: string; reason: string }[];
  deleted_count: number;
}
export async function deleteProjects(ids: string[]): Promise<BulkDeleteResult> {
  const res = await fetch(`${BASE}/api/projects`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, confirm: true }),
  });
  if (!res.ok) throw new Error(`批量删除项目失败: ${res.status}`);
  return res.json();
}

/** 单个项目（账本查询）。找不到返回 null。 */
export async function getProject(id: string): Promise<ProjectDTO | null> {
  const res = await fetch(`${BASE}/api/projects/${id}`);
  if (!res.ok) throw new Error(`获取项目失败: ${res.status}`);
  const d = await res.json();
  return d && d.status === "not_found" ? null : d;
}

/** 任务列表（账本查询）。支持按项目 / 状态过滤。 */
export async function getTasks(params: TaskListParams = {}): Promise<TaskDTO[]> {
  const qs = new URLSearchParams();
  if (params.project_id) qs.set("project_id", params.project_id);
  if (params.status) qs.set("status", params.status);
  if (params.limit) qs.set("limit", String(params.limit));
  const res = await fetch(`${BASE}/api/tasks?${qs.toString()}`);
  if (!res.ok) throw new Error(`获取任务失败: ${res.status}`);
  return res.json();
}

/** ISO 时间 -> 简短本地显示（2026-07-10 14:30 / 刚刚 / N 分钟前）。 */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ============ 输入材料（粘贴长文本 / 上传 .txt .md .docx .pdf） ============

export type MaterialSourceType = "paste" | "txt" | "md" | "docx" | "pdf";

export interface MaterialMeta {
  id: string;
  project_id: string | null;
  title: string;
  source_type: MaterialSourceType;
  source: string | null; // 来源出处
  tags: string | null; // 逗号分隔标签
  warnings: string[]; // 解析告警（如 pdf_text_empty / pdf_garbled / pdf_too_large）
  original_filename: string | null;
  char_count: number;
  created_at: string | null;
}

export interface MaterialFull extends MaterialMeta {
  content_text: string;
}

/** 素材列表（可按项目过滤 + 关键词 q 搜索；不带 project_id 取全部）。 */
export async function getMaterials(
  projectId?: string,
  q?: string
): Promise<MaterialMeta[]> {
  const params = new URLSearchParams();
  if (projectId) params.set("project_id", projectId);
  if (q && q.trim()) params.set("q", q.trim());
  const qs = params.toString();
  const res = await fetch(`${BASE}/api/materials${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(`获取素材失败: ${res.status}`);
  return res.json();
}

/** 单个素材完整内容（含 content_text）。 */
export async function getMaterial(id: string): Promise<MaterialFull> {
  const res = await fetch(`${BASE}/api/materials/${id}`);
  if (!res.ok) throw new Error(`获取素材失败: ${res.status}`);
  return res.json();
}

/** 手动粘贴长文本创建素材。 */
export async function createMaterial(body: {
  project_id?: string | null;
  title?: string;
  content_text: string;
  source_type?: MaterialSourceType;
  source?: string | null;
  tags?: string | null;
}): Promise<MaterialMeta> {
  const res = await fetch(`${BASE}/api/materials`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`创建素材失败: ${res.status}`);
  return res.json();
}

/** 上传文件（.txt/.md/.docx/.pdf），后端按扩展名解析。source/tags 可选。 */
export async function uploadMaterial(form: FormData): Promise<MaterialMeta> {
  const res = await fetch(`${BASE}/api/materials/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`上传素材失败: ${res.status}`);
  return res.json();
}

/** 删除素材。 */
export async function deleteMaterial(id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/materials/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`删除素材失败: ${res.status}`);
}

/** 材料来源统计（数据页「材料来源统计」用，基于真实材料账本聚合）。 */
export interface MaterialStats {
  total: number;
  by_type: Record<string, number>; // paste/txt/md/docx/pdf -> count
  by_source: { source: string; count: number }[]; // 按来源出处聚合（Top 12）
  with_warnings: number; // 带解析告警的材料数
  linked_to_project: number; // 已关联到项目的材料数
}

/** 取材料来源统计（可按项目过滤）。 */
export async function getMaterialStats(
  projectId?: string
): Promise<MaterialStats> {
  const params = new URLSearchParams();
  if (projectId) params.set("project_id", projectId);
  const qs = params.toString();
  const res = await fetch(`${BASE}/api/materials/stats${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(`获取材料统计失败: ${res.status}`);
  return res.json();
}

/** 触发文件下载（Word / PDF）。PDF 不可用时返回 {ok:false, error:"pdf_unavailable"}。 */
export async function downloadVersion(
  taskId: string,
  kind: "word" | "pdf",
  version?: string
): Promise<{ ok: boolean; error?: string }> {
  const url = downloadUrl(taskId, kind, version);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      try {
        const j = await res.json();
        if (j?.error === "pdf_unavailable") return { ok: false, error: "pdf_unavailable" };
      } catch {
        /* ignore */
      }
      return { ok: false, error: `download_failed_${res.status}` };
    }
    const blob = await res.blob();
    const cd = res.headers.get("content-disposition");
    const m = cd?.match(/filename\*?=(?:UTF-8'')?(.+)/i);
    const fn = m?.[1]?.replace(/["']/g, "") || `report.${kind}`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fn;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    return { ok: true };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

// ============ 案例库（T14：GET /api/cases + POST import，后端 ast 只读解析 KERNEL） ============

/** 案例库条目（后端 ast 只读解析 KERNEL cases/*.py 的 TITLE/BODY）。 */
export interface CaseItem {
  id: string;
  name: string;
  analysis_type: "case" | "policy" | "org" | "opinion" | "combo" | "unknown";
  chapters: number;
  script: string;
  title: string;
  markdown: string;
  diagrams: { viz?: string; title?: string; nodes?: unknown[]; edges?: unknown[] }[];
}

export interface CaseList {
  total: number;
  cases: CaseItem[];
}

/** 案例库列表。 */
export async function getCases(): Promise<CaseList> {
  const res = await fetch(`${BASE}/api/cases`);
  if (!res.ok) throw new Error(`获取案例库失败: ${res.status}`);
  return res.json();
}

/** 导入案例：复制为 Task + 播种 original 版本，返回新 task_id（绝不写回 KERNEL）。 */
export async function importCase(caseId: string): Promise<{ task_id: string }> {
  const res = await fetch(`${BASE}/api/cases/${caseId}/import`, { method: "POST" });
  if (!res.ok) throw new Error(`导入案例失败: ${res.status}`);
  return res.json();
}
