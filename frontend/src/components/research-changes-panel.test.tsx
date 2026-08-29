import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import type { ResearchChangeSet } from "@/lib/domain";
import { ResearchChangesPanel } from "./research-changes-panel";

const changes: ResearchChangeSet = {
  status: "ready", hasChanges: true, summary: ["发现 1 个新主体", "1 项旧判断被新证据推翻"],
  addedNodes: [{ id: "n2", label: "新主体" }], removedNodes: [], stanceChanges: [{ nodeId: "n1", label: "机构A", before: "支持", after: "反对" }],
  addedRelations: [], removedRelations: [{ id: "r1", label: "合作" }], changedRelations: [],
  addedClaims: [], removedClaims: [], changedClaims: [{ id: "c1", text: "旧判断" }], addedSources: [{ id: "s2" }], newGaps: [], resolvedGaps: [],
};

describe("ResearchChangesPanel", () => {
  it("explains what was added, removed and overturned between versions", () => {
    render(<ResearchChangesPanel changes={changes} fromLabel="v1" toLabel="v2" />);
    expect(screen.getByRole("heading", { name: "v1 到 v2 发生了什么" })).toBeInTheDocument();
    expect(screen.getByText("发现 1 个新主体")).toBeInTheDocument();
    expect(screen.getByText("机构A：").parentElement).toHaveTextContent(/机构A：支持\s+反对/);
    expect(screen.getByText("被移除关系")).toBeInTheDocument();
    expect(screen.getByText("被修正判断")).toBeInTheDocument();
  });
});
