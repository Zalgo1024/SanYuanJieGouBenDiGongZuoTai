# P1 Research Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the local report system with source quality control, analytical graph attributes, temporal change comparison, local monitoring, evidence-focused report modes, and explainable reliability metrics.

**Architecture:** Extend the versioned research ledger as the authoritative analytical snapshot. Add deterministic source intelligence and ledger comparison services, then reuse the existing SQLite queue for scheduled monitoring. The Next.js frontend renders only persisted or deterministically derived fields and remains backward compatible with legacy reports.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, SQLite, Next.js 15, React, TypeScript, vis-network, pytest, Vitest.

## Global Constraints

- Do not modify `theory_config.json` or bypass `CaseAnalysisEngine.export_from_text()`.
- All data remains local; monitoring is disabled by default.
- No scalar public-facing quality score.
- Missing evidence must remain unknown, inferred, or unavailable.
- Existing reports and SQLite databases must migrate idempotently.

---

### Task 1: Research ledger 1.1 and source intelligence

**Files:**
- Modify: `backend/app/research_ledger.py`
- Modify: `backend/app/generator.py`
- Test: `backend/tests/test_research_ledger.py`
- Test: `backend/tests/test_generator_split.py`

**Interfaces:**
- Produces: `ResearchNode`, `ResearchTimelineEvent`, extended `ResearchSource`, `ResearchRelation`, `ResearchGap`, `ResearchMetrics`.
- Produces: `classify_and_dedupe_sources(sources) -> list[ResearchSource]`.

- [ ] Add failing tests for source classification, canonical publisher groups, duplicate fingerprints, node weights, relation strengths, timeline validation, ranked gaps and metric calculation.
- [ ] Run the focused tests and confirm failures are caused by missing 1.1 fields.
- [ ] Implement deterministic source enrichment and ledger normalization.
- [ ] Extend the bounded research extraction prompt with nodes, timeline and 1.1 fields.
- [ ] Run focused tests until green.

### Task 2: Snapshot comparison and report change API

**Files:**
- Create: `backend/app/research_changes.py`
- Modify: `backend/app/routers/reports.py`
- Test: `backend/tests/test_research_changes.py`
- Test: `backend/tests/test_report_research_api.py`

**Interfaces:**
- Produces: `compare_research_ledgers(before, after) -> ResearchChangeSet`.
- Produces: `GET /api/reports/{task_id}/changes?from_version_id=...&to_version_id=...`.

- [ ] Add failing tests for added/removed nodes and relations, relation attribute changes, stance changes, claim confidence changes and missing snapshots.
- [ ] Implement deterministic comparison with stable IDs and semantic fallbacks.
- [ ] Add the version change endpoint and validation.
- [ ] Run focused tests until green.

### Task 3: Local project monitoring

**Files:**
- Modify: `backend/app/models.py`
- Modify: `backend/app/db.py`
- Create: `backend/app/monitoring.py`
- Create: `backend/app/routers/monitoring.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/queue.py`
- Test: `backend/tests/test_monitoring.py`

**Interfaces:**
- Produces: `ResearchMonitor` model and `run_due_monitors(now=None)`.
- Produces: `GET/PUT /api/projects/{project_id}/monitor` and `POST /api/projects/{project_id}/monitor/run`.

- [ ] Add failing tests for create/update, due scheduling, duplicate-run prevention, seed task cloning and completion comparison.
- [ ] Add idempotent SQLite migration and monitor model.
- [ ] Implement monitor service and API.
- [ ] Start one lightweight scheduler loop on FastAPI startup and connect task completion recording.
- [ ] Run focused tests until green.

### Task 4: Frontend domain and API contracts

**Files:**
- Modify: `frontend/src/lib/domain.ts`
- Modify: `frontend/src/lib/report-delivery.ts`
- Modify: `frontend/src/lib/workspace-api.ts`
- Create: `frontend/src/lib/research-changes.ts`
- Test: matching `*.test.ts` files.

**Interfaces:**
- Produces camelCase mappings for ledger 1.1, change sets and monitor state.
- Produces `fetchReportChanges`, `fetchProjectMonitor`, `updateProjectMonitor`, `runProjectMonitor`.

- [ ] Add failing mapping and API tests.
- [ ] Implement backward-compatible normalizers.
- [ ] Run frontend library tests until green.

### Task 5: Analytical graph and source diagnostics UI

**Files:**
- Modify: `frontend/src/lib/report-graph.ts`
- Modify: `frontend/src/components/graph-canvas.tsx`
- Modify: `frontend/src/components/analysis-network.tsx`
- Modify: `frontend/src/components/research-ledger.tsx`
- Modify: `frontend/src/app/globals.css`
- Test: graph, network and ledger component tests.

- [ ] Add failing tests for weighted nodes, strong/weak and inferred edges, node profiles, full relationship explanation, source ratings and five prioritized gaps.
- [ ] Enrich graph rendering from the research ledger.
- [ ] Add node dossier and relationship reasoning panels.
- [ ] Add source quality, conflict and gap diagnostics.
- [ ] Run component tests until green.

### Task 6: Timeline, version change and report reading modes

**Files:**
- Create: `frontend/src/components/research-timeline.tsx`
- Create: `frontend/src/components/research-changes-panel.tsx`
- Modify: `frontend/src/components/report-reader.tsx`
- Modify: `frontend/src/components/report-presentation.tsx`
- Modify: `frontend/src/app/globals.css`
- Test: report reader and presentation tests.

- [ ] Add failing tests for timeline ordering, turning points, version changes and quick/standard/research modes.
- [ ] Implement timeline and change panels.
- [ ] Implement three reading modes without rewriting stored Markdown.
- [ ] Run component tests until green.

### Task 7: Project monitoring UI and explainable reliability

**Files:**
- Modify: `frontend/src/components/app-screens.tsx`
- Modify: `frontend/src/components/task-workbench.tsx`
- Modify: `frontend/src/app/globals.css`
- Test: app screen and task workbench tests.

- [ ] Add failing tests for monitor toggle, interval, manual run, latest change and removal of scalar quality copy.
- [ ] Implement the project tracking panel and recent change summary.
- [ ] Replace “质量分” with named reliability checks and issue counts.
- [ ] Run focused tests until green.

### Task 8: Full verification and browser acceptance

- [ ] Run new backend focused tests.
- [ ] Run all frontend Vitest tests.
- [ ] Run `scripts/verify-all.ps1`.
- [ ] Restart the local workbench.
- [ ] Verify desktop and mobile report, graph and project monitoring pages with no overflow or console errors.
