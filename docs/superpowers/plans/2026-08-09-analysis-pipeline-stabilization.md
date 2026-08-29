# Analysis Pipeline Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make freeform analysis reliable, make report versioning concurrency-safe, enforce the report-writing standard, consolidate navigation, and leave the repository fully tested and logically committed.

**Architecture:** Add one backend decision boundary for input/engine routing, one transactional service for report versions, and one deterministic report-quality evaluator shared by LLM and rule paths. Keep report content generation in the existing generator and core engine; the frontend only submits intent and displays backend-authoritative state.

**Tech Stack:** FastAPI, Pydantic, SQLAlchemy, SQLite, pytest, Next.js 15, React 19, TypeScript, Vitest.

## Global Constraints

- Do not modify `theory_config.json`.
- Do not read or depend on sibling projects.
- Do not invent facts, actors, relationships, evidence, or recommendations.
- Preserve old API fields and routes during the compatibility period.
- Use TDD for each behavioral change.
- Do not push or rewrite Git history.

---

### Task 1: Generation Route Decision

**Files:**
- Create: `backend/app/generation_routing.py`
- Modify: `backend/app/routers/analyze.py`
- Modify: `backend/app/models.py`
- Modify: `backend/app/db.py`
- Modify: `backend/app/queue.py`
- Modify: `backend/app/generator.py`
- Modify: `backend/app/config_store.py`
- Test: `backend/tests/test_generation_routing.py`
- Test: `backend/tests/test_progress_chain.py`

**Interfaces:**
- Produces: `GenerationDecision`, `GenerationRouteError`, `decide_generation_route()`.
- Consumes: `rule_engine.StructuredInput`, backend LLM availability state.

- [ ] Write table-driven failing tests for all six routing matrix rows.
- [ ] Run `python -m pytest backend/tests/test_generation_routing.py -q` and confirm failures.
- [ ] Implement `input_mode=freeform|structured` and `requested_engine=auto|llm|rule` decision logic.
- [ ] Validate routing before `Task` creation and return HTTP 422 on invalid combinations.
- [ ] Persist input mode, requested engine, and selected engine with backward-compatible migration.
- [ ] Remove freeform LLM-to-rule fallback; retain structured LLM-to-rule fallback.
- [ ] Rewrite progress tests so freeform uses a fake LLM and structured rule input covers the deterministic path.
- [ ] Run routing, progress, API, generator, and rule-engine tests.
- [ ] Commit with `fix: stabilize freeform and structured generation routing`.

### Task 2: Concurrency-Safe Report Versions

**Files:**
- Create: `backend/app/report_version_service.py`
- Modify: `backend/app/routers/reports.py`
- Modify: `backend/app/routers/cases.py`
- Modify: `backend/app/db.py`
- Test: `backend/tests/test_report_versions.py`

**Interfaces:**
- Produces: `ensure_original_version(db, task)` and `create_report_version(...)`.
- Consumes: `Task`, `ReportVersion`, existing `(task_id, version_no)` unique index.

- [ ] Write a real temporary-SQLite concurrent seed test that triggers two readers simultaneously.
- [ ] Verify the test fails through an autoflush or unique-constraint error.
- [ ] Implement atomic v1 insert with SQLite `ON CONFLICT DO NOTHING` and winner readback.
- [ ] Move revised-version allocation and current-version switching into the service transaction.
- [ ] Add concurrent revised-version tests for unique version numbers and one current row.
- [ ] Replace router and case-import direct writes with service calls.
- [ ] Run report-version, report API, project-detail, and quality-fixes tests.
- [ ] Commit with `fix: make report version creation concurrency safe`.

### Task 3: Executable Report Quality Gate

**Files:**
- Create: `backend/app/report_quality.py`
- Modify: `backend/app/contract.py`
- Modify: `backend/app/generator.py`
- Modify: `backend/app/queue.py`
- Modify: `backend/app/models.py`
- Modify: `backend/app/db.py`
- Modify: `backend/app/routers/analyze.py`
- Test: `backend/tests/test_report_quality.py`
- Test: `backend/tests/test_report_writing_standard.py`

**Interfaces:**
- Produces: `QualityIssue`, `ReportQualityResult`, `evaluate_report_quality()`.
- Consumes: Markdown, analysis type, web-source flag.

- [ ] Write one failing test for every hard error and warning defined in the design spec.
- [ ] Implement section extraction, list counting, banned-placeholder detection, appendix link detection, DIAGRAM validation, conclusion checks, action-section checks, and figure-reference checks.
- [ ] Return score, issues, and valid flag without mutating Markdown.
- [ ] Integrate quality evaluation after structural contract validation for both engines.
- [ ] Add at most two targeted LLM revision attempts using quality issue messages.
- [ ] Fail rule output immediately when the shared gate rejects it.
- [ ] Persist and expose quality result in task/report metadata.
- [ ] Run contract, quality, generator, queue, and report API tests.
- [ ] Commit with `feat: enforce executable report quality checks`.

### Task 4: Frontend Auto Mode and Error UX

**Files:**
- Modify: `frontend/src/lib/domain.ts`
- Modify: `frontend/src/lib/store.tsx`
- Modify: `frontend/src/lib/workspace-api.ts`
- Modify: `frontend/src/components/analysis-page.tsx`
- Modify: `frontend/src/components/analysis-creation.tsx`
- Modify: `frontend/src/components/task-workbench.tsx`
- Test: `frontend/src/components/analysis-creation.test.tsx`
- Test: `frontend/src/lib/workspace-api.test.ts`

**Interfaces:**
- Consumes: backend `input_mode`, `requested_engine`, quality metadata, unified 422 error.
- Produces: `EngineMode = auto|llm|rule`, explicit freeform submissions, readable setup/structured-input actions.

- [ ] Add failing tests for default auto mode and freeform request payload.
- [ ] Extend domain types and persisted settings migration to `auto`.
- [ ] Submit `input_mode=freeform` and `requested_engine` from the current conversation composer.
- [ ] Display backend input-validation and quality-gate errors without creating frontend placeholder reports.
- [ ] Keep existing report and realtime flows compatible.
- [ ] Run frontend unit tests and TypeScript build checks.

### Task 5: Consolidated Navigation

**Files:**
- Modify: `frontend/src/components/app-shell.tsx`
- Modify: `frontend/src/components/platform-home.tsx`
- Modify: `frontend/src/components/app-screens.tsx`
- Modify: `frontend/src/app/(app)/dashboard/page.tsx`
- Modify or create redirect pages under `frontend/src/app/(app)/projects`, `materials`, `reports`, and `interest-analysis`.
- Test: `frontend/src/components/app-shell.test.tsx`
- Test: `frontend/src/components/app-screens.test.tsx`

**Interfaces:**
- Produces: three-item primary navigation and compatible legacy routes.
- Consumes: existing backend-authoritative workspace store.

- [ ] Write failing navigation tests that require only 工作台、新建分析、设置.
- [ ] Remove duplicate primary navigation entries.
- [ ] Fold project filtering/listing and recent report/task content into dashboard.
- [ ] Keep project detail, report detail, and graph detail routes usable.
- [ ] Redirect legacy list routes without breaking deep links.
- [ ] Run navigation, screen, report-reader, graph, and full frontend tests.
- [ ] Commit Tasks 4 and 5 with `refactor: consolidate workspace navigation` after both are green.

### Task 6: Runtime and Test Isolation

**Files:**
- Modify: `backend/tests/conftest.py`
- Modify: `backend/tests/test_quality_fixes.py`
- Modify: `scripts/tests/runtime-controller.static.tests.ps1`
- Modify tests affected by new engine/quality contracts.

**Interfaces:**
- Produces: order-independent backend tests and current launcher contract tests.

- [ ] Reproduce the order-dependent version editor failure with a grouped test run.
- [ ] Isolate database and mutable settings per test.
- [ ] Update launcher static assertion to verify `Start-Process $frontendUrl`.
- [ ] Run backend tests in normal and reversed file order.
- [ ] Run all three PowerShell runtime tests.
- [ ] Commit with `test: restore full pipeline regression coverage`.

### Task 7: Full Verification and Existing Change Organization

**Files:**
- Review every remaining modified and untracked file.
- Update: `AGENTS.md` and `docs/PROJECT_ARCHITECTURE.md` only where runtime truth changed.

**Interfaces:**
- Produces: clean working tree with traceable commits.

- [ ] Run root tests: `python -m pytest tests -q`.
- [ ] Run backend tests: `python -m pytest backend/tests -o addopts=`.
- [ ] Run frontend tests: `npm.cmd test -- --run` from `frontend`.
- [ ] Run frontend production build: `npm.cmd run build` from `frontend`.
- [ ] Run runtime PowerShell tests.
- [ ] Run `git diff --check`.
- [ ] Start the workbench and verify `/`, `/analysis`, `/dashboard`, and `/health` return 200.
- [ ] Smoke-test freeform LLM and structured rule flows, report graph, and version save.
- [ ] Group remaining existing changes by core export, backend delivery, frontend presentation, case content, runtime, and documentation.
- [ ] Commit each coherent group without staging runtime data or generated reports.
- [ ] Confirm `git status --short` is clean and summarize every commit.
