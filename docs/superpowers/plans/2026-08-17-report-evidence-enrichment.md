# Report Evidence Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shorten evidence-search work and let every report create safe, traceable AI evidence-enrichment versions from materials, web search, or both.

**Architecture:** Reuse the existing Task queue for background enrichment jobs and the existing ReportVersion ledger for immutable outputs. Add bounded concurrency and evidence-aware fast paths at the search/generator seams, then expose one report-level enrichment dialog that creates jobs and follows existing task progress.

**Tech Stack:** FastAPI, SQLAlchemy/SQLite, Python concurrent futures, Next.js 15, React, TypeScript, Vitest, Pytest.

## Global Constraints

- Existing report versions are immutable and must never be overwritten.
- No server administrator LLM key fallback; enrichment uses the browser profile selected by the user.
- No fabricated sources; zero usable evidence creates no report version.
- Existing report writing quality gates and export engine remain authoritative.
- No new runtime dependency.

---

### Task 1: Evidence-aware search performance

**Files:**
- Modify: `backend/app/search.py`
- Modify: `backend/app/queue.py`
- Modify: `backend/app/generator.py`
- Test: `backend/tests/test_search.py`
- Test: `backend/tests/test_generator_split.py`

**Interfaces:**
- Produces: `search_pair(primary_query, analogue_query, max_results) -> tuple[SearchResult, SearchResult | None]`
- Produces: `fetch_and_clean(urls, max_chars=8000, max_workers=4) -> list[dict]`
- Produces: task result `timings: dict[str, float]`

- [ ] Write failing tests proving failed primary search skips the analogue call, fetch ordering survives parallel completion, and an empty source catalog performs zero research-LLM calls.
- [ ] Run `backend/.venv/Scripts/python.exe -m pytest backend/tests/test_search.py backend/tests/test_generator_split.py -q` and confirm failures are caused by missing behavior.
- [ ] Add bounded search/fetch concurrency and the empty-catalog fallback.
- [ ] Add monotonic stage timing without changing report output.
- [ ] Re-run the targeted tests and confirm they pass.

### Task 2: Background enrichment job and version safety

**Files:**
- Modify: `backend/app/models.py`
- Modify: `backend/app/db.py`
- Modify: `backend/app/queue.py`
- Modify: `backend/app/report_version_service.py`
- Modify: `backend/app/routers/reports.py`
- Test: `backend/tests/test_report_versions.py`
- Create: `backend/tests/test_report_enrichment.py`

**Interfaces:**
- Endpoint: `POST /api/reports/{task_id}/enrichments`
- Request: `{instruction, material_ids, web, llm_config}`
- Response: `{job_task_id, target_task_id, base_version_id}`
- Task fields: `operation`, `target_task_id`, `base_version_id`

- [ ] Write failing API tests for material, web, hybrid, no-evidence and stale-base outcomes.
- [ ] Run the tests and verify each fails at the missing endpoint or behavior.
- [ ] Add the additive SQLite migration and request validation.
- [ ] Implement enrichment processing using the current version as immutable input.
- [ ] Create kind=`enriched` versions only when usable evidence exists; use `make_current=False` on stale bases.
- [ ] Re-run backend enrichment/version tests and confirm they pass.

### Task 3: Report-level enrichment UI

**Files:**
- Create: `frontend/src/components/report-evidence-enrichment.tsx`
- Create: `frontend/src/components/report-evidence-enrichment.test.tsx`
- Modify: `frontend/src/components/report-reader.tsx`
- Modify: `frontend/src/lib/workspace-api.ts`
- Modify: `frontend/src/lib/domain.ts`
- Modify: `frontend/src/app/globals.css`

**Interfaces:**
- Produces: `createReportEnrichment(taskId, input) -> Promise<ReportEnrichmentJob>`
- Consumes: existing material upload API, LLM profile id, task progress route and report reload callback.

- [ ] Write failing component/API tests for opening the dialog, selecting material/web sources, validation and job submission.
- [ ] Run targeted Vitest files and confirm expected failures.
- [ ] Implement the API adapter and accessible enrichment dialog.
- [ ] Add the header action and the evidence-warning entry point through a shared callback.
- [ ] Show background job acknowledgement and link to `/analysis/{job_task_id}`.
- [ ] Re-run targeted frontend tests and confirm they pass.

### Task 4: Verification and measured comparison

**Files:**
- Modify: `docs/PROJECT_ARCHITECTURE.md`

- [ ] Run targeted backend and frontend tests.
- [ ] Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-all.ps1`.
- [ ] Restart the workbench with `scripts/local-workbench.ps1 -Action stop|start`.
- [ ] Verify the report dialog and responsive layout in the local browser.
- [ ] Run a deterministic timing harness proving parallel fetch duration approaches the slowest fetch rather than the sum.
- [ ] Record the new enrichment route, version semantics and timing metadata in architecture documentation.
