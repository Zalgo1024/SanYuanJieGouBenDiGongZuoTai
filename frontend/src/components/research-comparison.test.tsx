import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import type { ResearchBundle } from "@/lib/domain";
import { ResearchComparison } from "./research-comparison";
import { QuantitativeEvidence } from "./quantitative-evidence";

const research = {
  schemaVersion: "1.2", status: "verified", sources: [{ id: "s1", title: "公告", url: "https://example.com/a", excerpt: "", sourceType: "official", sourceLevel: "primary", independenceGroup: "a" }], claims: [], nodes: [], relations: [], timeline: [], gaps: [], warnings: [],
  metrics: { sourceCount: 1, independentSourceGroupCount: 1, keyClaimCount: 0, keyClaimEvidenceCoverage: 0, directFactCitationRate: 0, unsupportedInferenceCount: 0, conflictCount: 0, gapCount: 0 },
  analogues: [{ id: "a1", title: "历史案例", summary: "发生过类似调整", jurisdiction: "中国", domain: "平台治理", similarities: ["规则变化"], differences: ["规模不同"], response: "公开解释", outcome: "争议降温", relevanceReason: "机制相近", evidenceIds: ["s1"], comparability: "medium", confidence: "medium", confidenceReasons: [] }],
  counterfactuals: [{ id: "cf1", premise: "如果没有调整规则", changedCondition: "规则保持不变", baselineOutcome: "争议扩散", alternativeOutcome: "短期冲突减弱", causalChain: ["刺激减少"], supportingClaimIds: [], evidenceIds: ["s1"], assumptions: ["其他条件不变"], invalidationSignals: ["出现新的争议"], confidence: "low", confidenceReasons: [], status: "modelled" }],
  quantitativeObservations: [{ id: "q1", metricName: "支持率", value: null, unit: "%", scope: "公开讨论", methodology: "无可靠样本", formula: "", evidenceIds: [], status: "unknown", caveats: ["缺少可核验来源"], confidence: "low" }, { id: "system_actor_count", metricName: "主体数量", value: 3, unit: "个", scope: "研究账本", methodology: "节点去重", formula: "N = 3", evidenceIds: [], status: "derived", caveats: [], confidence: "high" }],
} satisfies ResearchBundle;

describe("P2 research panels", () => {
  it("shows analogous handling and counterfactual invalidation conditions", () => {
    render(<ResearchComparison research={research} />);
    expect(screen.getByText("历史案例")).toBeInTheDocument();
    expect(screen.getByText("公开解释")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /反事实/ }));
    expect(screen.getByText("如果没有调整规则")).toBeInTheDocument();
    expect(screen.getByText("出现新的争议")).toBeInTheDocument();
  });

  it("renders unknown rather than inventing a missing number and exposes formulas", () => {
    render(<QuantitativeEvidence research={research} />);
    expect(screen.getAllByText("未知").length).toBeGreaterThan(0);
    expect(screen.getByText("N = 3")).toBeInTheDocument();
    expect(screen.getByText("缺少可核验来源")).toBeInTheDocument();
  });
});
