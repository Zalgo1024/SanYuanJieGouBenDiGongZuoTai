# Self-Running Report Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace one-shot freeform report generation with a resumable staged workflow while preserving the current frontend, API, renderer, and structured rule compatibility path.

**Architecture:** Add a focused `backend/app/report_workflow/` package for type specs, typed stage outputs, artifact checkpoints, prompt construction, orchestration, and minimum delivery validation. `ReportGenerator` remains the compatibility facade and delegates LLM generation to the staged runner.

**Tech Stack:** Python 3, Pydantic 2, FastAPI, SQLAlchemy, pytest, existing OpenAI-compatible `BaseLLM`, existing report engine.

## Global Constraints

- Do not modify `frontend/` or `theory_config.json`.
- Do not read sibling projects or make old reports runtime dependencies.
- Do not fall back from freeform LLM generation to the rule engine.
- Keep current API result fields and `CaseAnalysisEngine.export_from_text()`.
- Write a failing test before each production behavior.

---

### Task 1: Specs And Artifact Checkpoints

**Files:**
- Create: `backend/app/report_workflow/models.py`
- Create: `backend/app/report_workflow/specs.py`
- Create: `backend/app/report_workflow/artifacts.py`
- Create: `backend/app/report_workflow/specs/*.json`
- Test: `backend/tests/test_report_workflow_artifacts.py`

- [ ] Test that all five report specs load with unique required section ids.
- [ ] Test atomic JSON/text writes and completed-stage resume state.
- [ ] Implement typed specs and a task-scoped artifact store.
- [ ] Run the focused tests and commit only after they pass.

### Task 2: Fixed Staged Runner

**Files:**
- Create: `backend/app/report_workflow/prompts.py`
- Create: `backend/app/report_workflow/runner.py`
- Test: `backend/tests/test_report_workflow_runner.py`

- [ ] Test the complete stage sequence with a deterministic fake LLM.
- [ ] Test that section prompts receive evidence cards instead of the raw material bundle.
- [ ] Test resume skips completed stages and an unavailable model fails explicitly.
- [ ] Implement JSON response parsing with one format-repair attempt per structured stage.
- [ ] Implement scope, evidence, foundation, outline, section, edit, diagram, and validation stages.

### Task 3: Generator And Queue Compatibility

**Files:**
- Modify: `backend/app/generator.py`
- Modify: `backend/app/queue.py`
- Modify: `backend/app/report_quality.py`
- Test: `backend/tests/test_generator_split.py`
- Test: `backend/tests/test_progress_chain.py`

- [ ] Test that LLM `ReportGenerator` delegates to the new workflow and preserves response fields.
- [ ] Pass task-scoped work directory and phase callback from the queue.
- [ ] Keep the rule path and AI revision path compatible.
- [ ] Make only the minimum delivery errors blocking for staged reports.

### Task 4: Regression Verification

**Files:**
- Update documentation only where runtime truth changed.

- [ ] Run focused workflow, generator, queue, contract, and quality tests.
- [ ] Run all backend tests in normal order.
- [ ] Run root engine tests.
- [ ] Run frontend tests and production build without changing frontend files.
- [ ] Run `git diff --check` and review that unrelated user changes remain untouched.
