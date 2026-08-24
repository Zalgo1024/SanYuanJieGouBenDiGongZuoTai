import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import type { ResearchBundle } from "@/lib/domain";
import { ResearchTimeline } from "./research-timeline";

const research = {
  schemaVersion: "1.1", status: "verified", sources: [], claims: [], relations: [], gaps: [], warnings: [],
  nodes: [{ id: "n1", label: "机构A", aliases: [], role: "监管者", interests: [], stance: "限制", weight: 0.8, confidence: "high", evidenceIds: [], firstSeen: "2026-01-01", lastSeen: "2026-05-01", stanceHistory: [{ at: "2026-01-01", stance: "观察", evidenceIds: [] }, { at: "2026-05-01", stance: "限制", evidenceIds: [] }] }],
  timeline: [{ id: "t1", date: "2026-05-01", title: "监管口径变化", detail: "从观察转向限制。", eventType: "stance_change", actorIds: ["n1"], claimIds: [], evidenceIds: [], confidence: "high", turningPoint: true }],
  metrics: { sourceCount: 0, independentSourceGroupCount: 0, keyClaimCount: 0, keyClaimEvidenceCoverage: 0, directFactCitationRate: 0, unsupportedInferenceCount: 0, conflictCount: 0, gapCount: 0 },
} satisfies ResearchBundle;

describe("ResearchTimeline", () => {
  it("shows turning points and actor stance changes as a temporal analysis", () => {
    render(<ResearchTimeline research={research} />);
    expect(screen.getByRole("heading", { name: "事件与立场变化" })).toBeInTheDocument();
    expect(screen.getByText("关键转折点")).toBeInTheDocument();
    expect(screen.getByText("监管口径变化")).toBeInTheDocument();
    expect(screen.getByText("观察 → 限制")).toBeInTheDocument();
  });
});
