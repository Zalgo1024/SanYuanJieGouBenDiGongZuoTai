import { ApiError, apiBaseUrl, apiRequest } from "./api";
import type { ReportVersionSummary, ResearchBundle, ResearchSnapshotStatus } from "./domain";

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
  research_status?: string | null;
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
  research?: unknown;
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
  research?: ResearchBundle;
  researchStatus: ResearchSnapshotStatus;
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
    researchStatus: normalizeResearchStatus(item.research_status),
  };
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function phrases(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) return [value.trim()];
  const items = strings(value);
  if (items.length >= 4 && items.every((item) => item.length <= 1)) return [items.join("")];
  return items;
}

function confidence(value: unknown): "high" | "medium" | "low" | "unknown" {
  return value === "high" || value === "medium" || value === "low" ? value : "unknown";
}

function normalizeResearchStatus(value: unknown): ResearchSnapshotStatus {
  return value === "verified" || value === "fallback" || value === "stale" ? value : "unavailable";
}

export function normalizeResearchBundle(value: unknown): ResearchBundle | undefined {
  const root = record(value);
  if (!Object.keys(root).length) return undefined;
  const metrics = record(root.metrics);
  return {
    schemaVersion: typeof root.schema_version === "string" ? root.schema_version : "1.0",
    status: root.status === "verified" ? "verified" : "fallback",
    sources: (Array.isArray(root.sources) ? root.sources : []).map((item) => {
      const source = record(item);
      return {
        id: String(source.id ?? ""), title: String(source.title ?? "未命名来源"), url: String(source.url ?? ""), excerpt: String(source.excerpt ?? ""),
        sourceType: String(source.source_type ?? "unknown"), sourceLevel: String(source.source_level ?? "unknown"),
        publishedAt: typeof source.published_at === "string" ? source.published_at : undefined,
        retrievedAt: typeof source.retrieved_at === "string" ? source.retrieved_at : undefined,
        independenceGroup: String(source.independence_group ?? ""), materialId: typeof source.material_id === "string" ? source.material_id : undefined,
        qualityTier: (source.quality_tier === "A" || source.quality_tier === "B" || source.quality_tier === "C" || source.quality_tier === "D" ? source.quality_tier : "unknown") as "A" | "B" | "C" | "D" | "unknown",
        qualityReasons: strings(source.quality_reasons), canonicalUrl: String(source.canonical_url ?? ""), originalUrl: String(source.original_url ?? ""),
        contentFingerprint: String(source.content_fingerprint ?? ""), duplicateOf: typeof source.duplicate_of === "string" ? source.duplicate_of : undefined,
      };
    }).filter((item) => item.id),
    claims: (Array.isArray(root.claims) ? root.claims : []).map((item) => {
      const claim = record(item);
      return {
        id: String(claim.id ?? ""), text: String(claim.text ?? ""),
        claimType: (claim.claim_type === "fact" || claim.claim_type === "source_view" || claim.claim_type === "user_input" ? claim.claim_type : "inference") as "fact" | "source_view" | "inference" | "user_input",
        significance: (claim.significance === "supporting" ? "supporting" : "key") as "key" | "supporting",
        confidence: confidence(claim.confidence),
        confidenceReasons: phrases(claim.confidence_reasons), evidenceIds: strings(claim.evidence_ids), counterEvidenceIds: strings(claim.counter_evidence_ids),
        section: String(claim.section ?? ""), unsupported: Boolean(claim.unsupported),
      };
    }).filter((item) => item.id && item.text),
    nodes: (Array.isArray(root.nodes) ? root.nodes : []).map((item) => {
      const node = record(item);
      return {
        id: String(node.id ?? ""), label: String(node.label ?? ""), aliases: strings(node.aliases), role: String(node.role ?? ""),
        interests: strings(node.interests), stance: String(node.stance ?? ""), weight: Math.max(0, Math.min(1, Number(node.weight) || 0)),
        confidence: confidence(node.confidence), evidenceIds: strings(node.evidence_ids),
        firstSeen: typeof node.first_seen === "string" ? node.first_seen : undefined, lastSeen: typeof node.last_seen === "string" ? node.last_seen : undefined,
        stanceHistory: (Array.isArray(node.stance_history) ? node.stance_history : []).map((point) => { const value = record(point); return { at: String(value.at ?? ""), stance: String(value.stance ?? ""), evidenceIds: strings(value.evidence_ids) }; }).filter((point) => point.at && point.stance),
      };
    }).filter((item) => item.id && item.label),
    relations: (Array.isArray(root.relations) ? root.relations : []).map((item) => {
      const relation = record(item);
      return {
        id: String(relation.id ?? ""), sourceNode: String(relation.source_node ?? ""), targetNode: String(relation.target_node ?? ""), label: String(relation.label ?? "关联"),
        relationType: String(relation.relation_type ?? "unknown"), direction: String(relation.direction ?? "unknown"), polarity: String(relation.polarity ?? "unknown"),
        confidence: confidence(relation.confidence),
        evidenceIds: strings(relation.evidence_ids), claimId: typeof relation.claim_id === "string" ? relation.claim_id : undefined,
        status: (relation.status === "confirmed" || relation.status === "conflicted" ? relation.status : "inferred") as "confirmed" | "inferred" | "conflicted",
        strength: Math.max(1, Math.min(5, Number(relation.strength) || 1)), interestTypes: strings(relation.interest_types),
        validFrom: typeof relation.valid_from === "string" ? relation.valid_from : undefined, validTo: typeof relation.valid_to === "string" ? relation.valid_to : undefined,
        evidenceCount: Number(relation.evidence_count) || strings(relation.evidence_ids).length,
      };
    }).filter((item) => item.id && item.sourceNode && item.targetNode),
    timeline: (Array.isArray(root.timeline) ? root.timeline : []).map((item) => {
      const event = record(item);
      return {
        id: String(event.id ?? ""), date: typeof event.date === "string" ? event.date : undefined, title: String(event.title ?? ""), detail: String(event.detail ?? ""),
        eventType: String(event.event_type ?? "event"), actorIds: strings(event.actor_ids), claimIds: strings(event.claim_ids), evidenceIds: strings(event.evidence_ids),
        confidence: confidence(event.confidence), turningPoint: Boolean(event.turning_point),
      };
    }).filter((item) => item.id && item.title),
    gaps: (Array.isArray(root.gaps) ? root.gaps : []).map((item) => {
      const gap = record(item);
      return { id: String(gap.id ?? ""), question: String(gap.question ?? ""), reason: String(gap.reason ?? ""), impact: strings(gap.impact), recommendedMaterials: strings(gap.recommended_materials), priority: (gap.priority === "critical" || gap.priority === "high" || gap.priority === "low" ? gap.priority : "medium") as "critical" | "high" | "medium" | "low", materialType: String(gap.material_type ?? "unknown") };
    }).filter((item) => item.id && item.question),
    analogues: (Array.isArray(root.analogues) ? root.analogues : []).map((item) => {
      const analogue = record(item);
      return {
        id: String(analogue.id ?? ""), title: String(analogue.title ?? ""), summary: String(analogue.summary ?? ""),
        period: typeof analogue.period === "string" ? analogue.period : undefined, jurisdiction: String(analogue.jurisdiction ?? ""), domain: String(analogue.domain ?? ""),
        similarities: strings(analogue.similarities), differences: strings(analogue.differences), response: String(analogue.response ?? ""), outcome: String(analogue.outcome ?? ""),
        relevanceReason: String(analogue.relevance_reason ?? ""), evidenceIds: strings(analogue.evidence_ids), comparability: confidence(analogue.comparability),
        confidence: confidence(analogue.confidence), confidenceReasons: phrases(analogue.confidence_reasons),
      };
    }).filter((item) => item.id && item.title),
    counterfactuals: (Array.isArray(root.counterfactuals) ? root.counterfactuals : []).map((item) => {
      const counterfactual = record(item);
      return {
        id: String(counterfactual.id ?? ""), premise: String(counterfactual.premise ?? ""), changedCondition: String(counterfactual.changed_condition ?? ""),
        baselineOutcome: String(counterfactual.baseline_outcome ?? ""), alternativeOutcome: String(counterfactual.alternative_outcome ?? ""), causalChain: strings(counterfactual.causal_chain),
        supportingClaimIds: strings(counterfactual.supporting_claim_ids), evidenceIds: strings(counterfactual.evidence_ids), assumptions: strings(counterfactual.assumptions),
        invalidationSignals: strings(counterfactual.invalidation_signals), confidence: confidence(counterfactual.confidence), confidenceReasons: phrases(counterfactual.confidence_reasons),
        status: (counterfactual.status === "evidence_based" || counterfactual.status === "insufficient" ? counterfactual.status : "modelled") as "evidence_based" | "modelled" | "insufficient",
      };
    }).filter((item) => item.id && item.premise),
    quantitativeObservations: (Array.isArray(root.quantitative_observations) ? root.quantitative_observations : []).map((item) => {
      const observation = record(item);
      const rawValue = observation.value;
      return {
        id: String(observation.id ?? ""), metricName: String(observation.metric_name ?? ""), value: typeof rawValue === "number" || typeof rawValue === "string" ? rawValue : null,
        unit: String(observation.unit ?? ""), observedAt: typeof observation.observed_at === "string" ? observation.observed_at : undefined,
        periodStart: typeof observation.period_start === "string" ? observation.period_start : undefined, periodEnd: typeof observation.period_end === "string" ? observation.period_end : undefined,
        scope: String(observation.scope ?? ""), methodology: String(observation.methodology ?? ""), formula: String(observation.formula ?? ""),
        evidenceIds: strings(observation.evidence_ids), status: (observation.status === "observed" || observation.status === "derived" || observation.status === "conflicted" ? observation.status : "unknown") as "observed" | "derived" | "unknown" | "conflicted",
        caveats: phrases(observation.caveats), confidence: confidence(observation.confidence),
      };
    }).filter((item) => item.id && item.metricName),
    metrics: {
      sourceCount: Number(metrics.source_count) || 0, independentSourceGroupCount: Number(metrics.independent_source_group_count) || 0,
      keyClaimCount: Number(metrics.key_claim_count) || 0, keyClaimEvidenceCoverage: Number(metrics.key_claim_evidence_coverage) || 0,
      directFactCitationRate: Number(metrics.direct_fact_citation_rate) || 0, unsupportedInferenceCount: Number(metrics.unsupported_inference_count) || 0,
      conflictCount: Number(metrics.conflict_count) || 0, gapCount: Number(metrics.gap_count) || 0,
      duplicateSourceCount: Number(metrics.duplicate_source_count) || 0, highQualitySourceCount: Number(metrics.high_quality_source_count) || 0,
      relationEvidenceCoverage: Number(metrics.relation_evidence_coverage) || 0, temporalCompleteness: Number(metrics.temporal_completeness) || 0,
      sourceIndependenceRate: Number(metrics.source_independence_rate) || 0,
      analogueCount: Number(metrics.analogue_count) || 0, evidenceBackedAnalogueCount: Number(metrics.evidence_backed_analogue_count) || 0,
      counterfactualCount: Number(metrics.counterfactual_count) || 0, evidenceBackedCounterfactualCount: Number(metrics.evidence_backed_counterfactual_count) || 0,
      quantitativeObservationCount: Number(metrics.quantitative_observation_count) || 0, sourcedQuantitativeRate: Number(metrics.sourced_quantitative_rate) || 0,
      unknownQuantitativeCount: Number(metrics.unknown_quantitative_count) || 0,
    },
    warnings: strings(root.warnings),
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
    research: normalizeResearchBundle(value.research),
    researchStatus: normalizeResearchStatus(value.research_status),
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
