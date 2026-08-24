import { afterEach, describe, expect, it, vi } from "vitest";
import {
  downloadReportArtifact,
  fetchReportVersion,
  fetchReportVersions,
  rollbackReportVersion,
  normalizeResearchBundle,
} from "./report-delivery";

describe("report delivery adapter", () => {
  afterEach(() => vi.restoreAllMocks());

  it("normalizes the complete version index without inventing metadata", async () => {
    const request = vi.fn(async () => ({
      task_id: "task-1",
      title: "结构报告",
      current_version_id: "version-2",
      versions: [
        {
          id: "version-1",
          version_no: 1,
          kind: "original",
          edited_by: "ai",
          summary: "初始生成",
          note: null,
          editor: null,
          created_at: "2026-08-01T10:00:00",
          is_current: false,
        },
        {
          id: "version-2",
          version_no: 2,
          kind: "revised",
          edited_by: "human",
          summary: "补充证据边界",
          note: "补充证据边界",
          editor: "林知远",
          created_at: "2026-08-02T10:00:00",
          is_current: true,
        },
      ],
    }));

    await expect(fetchReportVersions("task-1", request)).resolves.toEqual({
      taskId: "task-1",
      title: "结构报告",
      currentVersionId: "version-2",
      versions: [
        expect.objectContaining({ id: "version-1", version: 1, kind: "original", isCurrent: false }),
        expect.objectContaining({ id: "version-2", version: 2, kind: "revised", editedBy: "human", editor: "林知远", isCurrent: true }),
      ],
    });
  });

  it("loads a requested historical version with its content", async () => {
    const request = vi.fn(async () => ({
      id: "version-1",
      version_no: 1,
      kind: "original",
      edited_by: "ai",
      summary: "初始生成",
      note: null,
      editor: null,
      created_at: "2026-08-01T10:00:00",
      is_current: false,
      content_markdown: "# 第一版\n\n## 一、结论\n\n原始内容",
      content_html: null,
      research_status: "verified",
      research: {
        schema_version: "1.0",
        status: "verified",
        sources: [{ id: "s1", title: "公告", url: "https://example.com/a" }],
        claims: [{ id: "c1", text: "原始结论", claim_type: "fact", confidence: "high", evidence_ids: ["s1"] }],
        relations: [],
        gaps: [],
        metrics: {},
      },
    }));

    const version = await fetchReportVersion("task-1", "version-1", request);

    expect(request).toHaveBeenCalledWith("/api/reports/task-1/versions/version-1");
    expect(version).toMatchObject({
      id: "version-1",
      version: 1,
      markdown: expect.stringContaining("原始内容"),
      researchStatus: "verified",
      research: { claims: [{ id: "c1", evidenceIds: ["s1"] }] },
    });
  });

  it("rejects incomplete version metadata instead of inventing history", async () => {
    const request = vi.fn(async () => ({
      task_id: "task-1",
      current_version_id: "version-1",
      versions: [{ id: "version-1", created_at: null }],
    }));

    await expect(fetchReportVersions("task-1", request)).rejects.toThrow("版本元数据不完整");
  });

  it("posts rollback to the selected version", async () => {
    const request = vi.fn(async () => ({ ok: true, current_version_id: "version-1", version_no: 1 }));

    await expect(rollbackReportVersion("version-1", request)).resolves.toMatchObject({ currentVersionId: "version-1", version: 1 });
    expect(request).toHaveBeenCalledWith("/api/versions/version-1/rollback", { method: "POST" });
  });

  it("downloads a binary artifact using the response filename", async () => {
    const click = vi.fn();
    vi.spyOn(document, "createElement").mockReturnValue({ click } as unknown as HTMLAnchorElement);
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:report") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    const response = new Response(new Blob(["word"]), {
      status: 200,
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "content-disposition": "attachment; filename*=UTF-8''%E7%BB%93%E6%9E%84%E6%8A%A5%E5%91%8A.docx",
      },
    });
    const fetcher = vi.fn(async () => response);

    await expect(downloadReportArtifact("task-1", "word", "version-2", fetcher)).resolves.toBe("结构报告.docx");
    expect(fetcher).toHaveBeenCalledWith("http://127.0.0.1:8000/api/download/task-1?kind=word&version=version-2");
    expect(click).toHaveBeenCalledOnce();
  });

  it("turns both HTTP errors and 200 JSON error payloads into useful failures", async () => {
    const unavailable = vi.fn(async () => new Response(JSON.stringify({ error: "pdf_unavailable", message: "PDF 暂不可用。可下载 Word 版本。" }), {
      status: 409,
      headers: { "content-type": "application/json" },
    }));
    const missing = vi.fn(async () => new Response(JSON.stringify({ error: "file_missing" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    await expect(downloadReportArtifact("task-1", "pdf", "version-2", unavailable)).rejects.toThrow("PDF 暂不可用");
    await expect(downloadReportArtifact("task-1", "word", "version-2", missing)).rejects.toThrow("报告文件不存在");
  });

  it("normalizes research snapshot 1.1 analytical and source-quality fields", () => {
    const research = normalizeResearchBundle({
      schema_version: "1.1",
      status: "verified",
      sources: [{ id: "s1", title: "政策文件", url: "https://gov.cn/a", quality_tier: "A", quality_reasons: ["官方发布"], canonical_url: "https://gov.cn/a", content_fingerprint: "abc", duplicate_of: null }],
      claims: [{ id: "c1", text: "政策发生变化", claim_type: "fact", confidence: "high", confidence_reasons: ["直", "接", "来", "源", "可", "核", "验"], evidence_ids: ["s1"] }],
      nodes: [{ id: "n1", label: "主管部门", role: "规则制定者", interests: ["执行"], stance: "支持", weight: 0.9, confidence: "high", evidence_ids: ["s1"], stance_history: [{ at: "2026-08-01", stance: "支持", evidence_ids: ["s1"] }] }],
      relations: [{ id: "r1", source_node: "n1", target_node: "n2", label: "监管", strength: 5, interest_types: ["power", "legal"], direction: "directed", polarity: "mixed", confidence: "high", evidence_ids: ["s1"], evidence_count: 1, status: "confirmed", valid_from: "2026-08-01" }],
      timeline: [{ id: "t1", date: "2026-08-01", title: "政策发布", actor_ids: ["n1"], claim_ids: ["c1"], evidence_ids: ["s1"], confidence: "high", turning_point: true }],
      gaps: [{ id: "g1", question: "执行数据未知", priority: "high", material_type: "operational_data" }],
      metrics: { duplicate_source_count: 2, high_quality_source_count: 1, relation_evidence_coverage: 0.8, temporal_completeness: 0.75, source_independence_rate: 0.5 },
    });

    expect(research).toMatchObject({
      schemaVersion: "1.1",
      sources: [{ qualityTier: "A", contentFingerprint: "abc" }],
      claims: [{ confidenceReasons: ["直接来源可核验"] }],
      nodes: [{ id: "n1", weight: 0.9, stanceHistory: [{ stance: "支持" }] }],
      relations: [{ strength: 5, interestTypes: ["power", "legal"], evidenceCount: 1 }],
      timeline: [{ id: "t1", turningPoint: true }],
      gaps: [{ priority: "high", materialType: "operational_data" }],
      metrics: { duplicateSourceCount: 2, relationEvidenceCoverage: 0.8, temporalCompleteness: 0.75 },
    });
  });

  it("normalizes P2 analogues, counterfactuals and auditable quantities", () => {
    const research = normalizeResearchBundle({
      schema_version: "1.2", status: "verified",
      sources: [{ id: "s1", title: "历史公告", url: "https://example.com/a" }],
      analogues: [{ id: "a1", title: "历史案例", similarities: ["规则变更"], differences: ["规模不同"], response: "公开说明", outcome: "争议降温", evidence_ids: ["s1"], comparability: "medium", confidence: "medium" }],
      counterfactuals: [{ id: "cf1", premise: "如果没有发布新规", changed_condition: "新规未发布", baseline_outcome: "争议扩散", alternative_outcome: "冲突减弱", causal_chain: ["刺激减少"], assumptions: ["其他条件不变"], invalidation_signals: ["出现其他事件"], status: "modelled", confidence: "low" }],
      quantitative_observations: [{ id: "q1", metric_name: "互动量", value: null, unit: "次", status: "unknown", caveats: ["缺少来源"] }, { id: "system_actor_count", metric_name: "主体数量", value: 3, unit: "个", status: "derived", formula: "N = 3" }],
      metrics: { analogue_count: 1, counterfactual_count: 1, quantitative_observation_count: 2, sourced_quantitative_rate: 0.5, unknown_quantitative_count: 1 },
    });

    expect(research).toMatchObject({
      schemaVersion: "1.2",
      analogues: [{ id: "a1", comparability: "medium", evidenceIds: ["s1"] }],
      counterfactuals: [{ id: "cf1", status: "modelled", assumptions: ["其他条件不变"] }],
      quantitativeObservations: [{ id: "q1", value: null, status: "unknown" }, { id: "system_actor_count", value: 3, formula: "N = 3" }],
      metrics: { analogueCount: 1, counterfactualCount: 1, quantitativeObservationCount: 2, unknownQuantitativeCount: 1 },
    });
  });
});
