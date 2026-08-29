import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import type { ResearchBundle } from "@/lib/domain";
import { ResearchLedger } from "./research-ledger";

const research: ResearchBundle = {
  schemaVersion: "1.0",
  status: "verified",
  sources: [
    { id: "s1", title: "监管公告", url: "https://example.com/a", excerpt: "公告确认该措施已经实施。", sourceType: "official", sourceLevel: "primary", independenceGroup: "a", qualityTier: "A", qualityReasons: ["政府主管部门原始发布"] },
    { id: "s2", title: "行业访谈", url: "https://example.com/b", excerpt: "受访者对实际效果持保留意见。", sourceType: "mainstream_media", sourceLevel: "secondary", independenceGroup: "b", qualityTier: "B", qualityReasons: ["主流媒体独立采访"] },
    { id: "s3", title: "公告转载", url: "https://example.com/c", excerpt: "转载公告。", sourceType: "self_media", sourceLevel: "secondary", independenceGroup: "a", qualityTier: "C", duplicateOf: "s1", qualityReasons: ["内容与原始公告重复"] },
  ],
  claims: [
    { id: "c1", text: "该措施已经实施", claimType: "fact", significance: "key", confidence: "high", confidenceReasons: ["存在原始公告"], evidenceIds: ["s1"], counterEvidenceIds: [], section: "事实摘要", unsupported: false },
    { id: "c2", text: "该措施的长期效果仍不确定", claimType: "inference", significance: "key", confidence: "low", confidenceReasons: ["缺乏长期数据"], evidenceIds: ["s1"], counterEvidenceIds: ["s2"], section: "结论", unsupported: false },
  ],
  relations: [],
  gaps: [{ id: "g1", question: "长期效果是否持续？", reason: "缺少连续数据", impact: ["政策效果判断"], recommendedMaterials: ["季度统计数据"], priority: "critical", materialType: "连续统计" }],
  metrics: { sourceCount: 3, independentSourceGroupCount: 2, keyClaimCount: 2, keyClaimEvidenceCoverage: 1, directFactCitationRate: 1, unsupportedInferenceCount: 0, conflictCount: 1, gapCount: 1, duplicateSourceCount: 1, highQualitySourceCount: 2, relationEvidenceCoverage: 0.5, temporalCompleteness: 0.4, sourceIndependenceRate: 0.67 },
  warnings: [],
};

describe("ResearchLedger", () => {
  it("shows claim type, confidence and source evidence on demand", () => {
    render(<ResearchLedger research={research} status="verified" />);

    expect(screen.getByRole("heading", { name: "关键判断与证据" })).toBeInTheDocument();
    expect(screen.getByText("该措施已经实施")).toBeInTheDocument();
    expect(screen.getByText("高置信度")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /监管公告/ })).toHaveAttribute("href", "https://example.com/a");

    fireEvent.click(screen.getByRole("button", { name: /该措施的长期效果仍不确定/ }));
    expect(screen.getByText("低置信度")).toBeInTheDocument();
    expect(screen.getByText("缺乏长期数据")).toBeInTheDocument();
    expect(screen.getByText("反向或冲突证据")).toBeInTheDocument();
    expect(screen.getByText("长期效果是否持续？")).toBeInTheDocument();
    expect(screen.getByText("A级来源")).toBeInTheDocument();
    expect(screen.getByText("政府主管部门原始发布")).toBeInTheDocument();
    expect(screen.getByText("最高优先级")).toBeInTheDocument();
    expect(screen.getByText("连续统计")).toBeInTheDocument();
  });

  it("shows explainable reliability dimensions instead of a synthetic total score", () => {
    render(<ResearchLedger research={research} status="verified" />);

    expect(screen.getByText("事实引用率")).toBeInTheDocument();
    expect(screen.getByText("关系证据覆盖")).toBeInTheDocument();
    expect(screen.getByText("时间完整度")).toBeInTheDocument();
    expect(screen.getByText("重复来源")).toBeInTheDocument();
    expect(screen.queryByText(/质量分/)).not.toBeInTheDocument();
  });

  it("warns when a version inherited stale bindings", () => {
    render(<ResearchLedger research={research} status="stale" />);
    expect(screen.getByRole("status")).toHaveTextContent("正文已经修改");
  });

  it("keeps legacy reports readable without pretending evidence exists", () => {
    const onEnrich = vi.fn();
    render(<ResearchLedger status="unavailable" onEnrich={onEnrich} />);
    expect(screen.getByText("这个历史报告还没有逐条证据绑定")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "补充信息与证据" }));
    expect(onEnrich).toHaveBeenCalledOnce();
  });
});
