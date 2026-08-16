import { ApiError, apiBaseUrl, apiRequest } from "./api";
import type { ReportVersionSummary } from "./domain";

export type ReportRequest = (path: string, options?: RequestInit) => Promise<unknown>;
export type ReportArtifactKind = "word" | "pdf";

interface VersionMetaDto {
  id?: string;
  version_no?: number;
  kind?: string | null;
  edited_by?: string | null;
  summary?: string | null;
  note?: string | null;
  editor?: string | null;
  created_at?: string | null;
  is_current?: boolean;
}

interface VersionIndexDto {
  task_id?: string;
  title?: string;
  current_version_id?: string | null;
  versions?: VersionMetaDto[];
}

interface VersionContentDto extends VersionMetaDto {
  content_markdown?: string;
  content_html?: string | null;
  status?: string;
}

export interface ReportVersionIndex {
  taskId: string;
  title: string;
  currentVersionId: string;
  versions: ReportVersionSummary[];
}

export interface ReportVersionContent extends ReportVersionSummary {
  markdown: string;
  html: string;
}

export interface RollbackResult {
  currentVersionId: string;
  version: number;
  wordAvailable: boolean;
  pdfAvailable: boolean;
  warning: string;
}

function normalizeVersion(item: VersionMetaDto): ReportVersionSummary {
  const version = Number(item.version_no);
  if (!item.id || !Number.isInteger(version) || version < 1 || !item.created_at) {
    throw new ApiError("报告版本元数据不完整", "invalid_version_metadata", 502);
  }
  return {
    id: item.id,
    version,
    kind: item.kind ?? "unknown",
    editedBy: item.edited_by ?? "unknown",
    summary: item.summary ?? "",
    note: item.note ?? "",
    editor: item.editor ?? "",
    createdAt: item.created_at,
    isCurrent: Boolean(item.is_current),
  };
}

export async function fetchReportVersions(
  taskId: string,
  request: ReportRequest = apiRequest,
): Promise<ReportVersionIndex> {
  const value = await request(`/api/reports/${taskId}`) as VersionIndexDto;
  const versions = Array.isArray(value.versions) ? value.versions.map(normalizeVersion) : [];
  return {
    taskId: value.task_id ?? taskId,
    title: value.title ?? "",
    currentVersionId: value.current_version_id ?? "",
    versions,
  };
}

export async function fetchReportVersion(
  taskId: string,
  versionId: string,
  request: ReportRequest = apiRequest,
): Promise<ReportVersionContent> {
  const value = await request(`/api/reports/${taskId}/versions/${versionId}`) as VersionContentDto;
  if (value.status === "not_found" || !value.id || typeof value.content_markdown !== "string") {
    throw new ApiError("报告版本不存在", "version_not_found", 404);
  }
  return {
    ...normalizeVersion(value),
    markdown: value.content_markdown,
    html: value.content_html ?? "",
  };
}

export async function rollbackReportVersion(
  versionId: string,
  request: ReportRequest = apiRequest,
): Promise<RollbackResult> {
  const value = await request(`/api/versions/${versionId}/rollback`, { method: "POST" }) as {
    ok?: boolean;
    error?: string;
    message?: string;
    current_version_id?: string;
    version_no?: number;
    word?: string | null;
    pdf_available?: boolean;
    render_warning?: string;
  };
  if (!value.ok || !value.current_version_id) {
    throw new ApiError(value.message ?? "版本回滚失败", value.error ?? "rollback_failed", 400);
  }
  return {
    currentVersionId: value.current_version_id,
    version: Number(value.version_no) || 1,
    wordAvailable: Boolean(value.word),
    pdfAvailable: Boolean(value.pdf_available),
    warning: value.render_warning ?? "",
  };
}

function responseFilename(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (utf8) {
    try { return decodeURIComponent(utf8.replace(/^"|"$/g, "")); } catch { return fallback; }
  }
  return disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? fallback;
}

async function artifactError(response: Response): Promise<ApiError | null> {
  const contentType = response.headers.get("content-type") ?? "";
  if (response.ok && !contentType.includes("application/json")) return null;
  let detail: { error?: string; code?: string; message?: string } = {};
  try { detail = await response.json(); } catch { /* empty response */ }
  const code = detail.error ?? detail.code ?? "download_failed";
  const fallback = code === "file_missing" ? "报告文件不存在，请重新生成或改用其他格式。" : "报告下载失败。";
  return new ApiError(detail.message ?? fallback, code, response.status);
}

export async function downloadReportArtifact(
  taskId: string,
  kind: ReportArtifactKind,
  versionId: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const query = new URLSearchParams({ kind });
  if (versionId) query.set("version", versionId);
  const response = await fetcher(`${apiBaseUrl()}/api/download/${taskId}?${query.toString()}`);
  const failure = await artifactError(response);
  if (failure) throw failure;
  const extension = kind === "word" ? "docx" : "pdf";
  const filename = responseFilename(response.headers.get("content-disposition"), `report.${extension}`);
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  // 延迟释放 blob URL：立即 revoke 在部分浏览器（Safari 等）会导致下载 0 字节
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return filename;
}
