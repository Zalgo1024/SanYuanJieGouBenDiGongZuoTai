import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import type { QuantitativeObservation, ResearchBundle } from "@/lib/domain";
import { QuantitativeEvidence } from "./quantitative-evidence";

function observation(id: string, metricName: string, status: QuantitativeObservation["status"]): QuantitativeObservation {
  return { id, metricName, value: 8, unit: "个", scope: "当前版本", methodology: "研究账本", formula: "", evidenceIds: [], status, caveats: [], confidence: "medium" };
}

const research: ResearchBundle = {
  schemaVersion: "1.2",
  status: "verified",
  sources: [],
  claims: [],
  relations: [],
  gaps: [],
  quantitativeObservations: [
    observation("observed", "公开数量", "observed"),
    observation("system_derived", "主体数量", "derived"),
    observation("conflicted", "冲突数量", "conflicted"),
    observation("unknown", "未知数量", "unknown"),
  ],
  metrics: { sourceCount: 0, independentSourceGroupCount: 0, keyClaimCount: 0, keyClaimEvidenceCoverage: 0, directFactCitationRate: 0, unsupportedInferenceCount: 0, conflictCount: 1, gapCount: 0 },
  warnings: [],
};

describe("QuantitativeEvidence", () => {
  it("hides internal observed and derived labels while retaining risk labels and values", () => {
    render(<QuantitativeEvidence research={research} />);

    expect(screen.queryByText("观测值")).not.toBeInTheDocument();
    expect(screen.queryByText("派生值")).not.toBeInTheDocument();
    expect(screen.getByText("来源冲突")).toBeInTheDocument();
    expect(screen.getByText("未知")).toBeInTheDocument();
    expect(screen.getByText("公开数量")).toBeInTheDocument();
    expect(screen.getByText("主体数量")).toBeInTheDocument();
  });
});
