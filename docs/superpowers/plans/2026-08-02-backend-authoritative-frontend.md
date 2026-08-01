# Backend-Authoritative Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the browser workbench display only backend-owned projects, tasks, materials and current report versions, with explicit offline and demo modes.

**Architecture:** Add a typed workspace API adapter that maps backend DTOs into frontend domain objects. Keep only user settings in local storage; the store owns connection state and refresh operations, while WebSocket completion triggers a report refresh.

**Tech Stack:** Next.js 15, React 19, TypeScript, Vitest, Testing Library, FastAPI REST/WebSocket contracts.

## Global Constraints

- The backend is the sole authority for project, task, material, report and version data.
- Demo data loads only when `NEXT_PUBLIC_DEMO_MODE=1`.
- Do not implement the interactive DIAGRAM graph in this phase.
- Write a failing test before every production behavior change.

---

### Task 1: Typed backend workspace adapter

**Files:**
- Create: `frontend/src/lib/workspace-api.test.ts`
- Create: `frontend/src/lib/workspace-api.ts`

**Interfaces:**
- Produces: `fetchWorkspaceSnapshot(request)`, `fetchCurrentReport(task, request)` and exported backend DTO types.

- [ ] Test that a report is built from the backend current version, not task fallback Markdown.
- [ ] Test that an empty current version returns no report.
- [ ] Test task, project and material DTO mappings preserve backend IDs and timestamps.
- [ ] Run the focused test and confirm it fails because the adapter does not exist.
- [ ] Implement the minimal typed adapter and rerun the focused test to green.

### Task 2: Settings-only persistence and connection state

**Files:**
- Create: `frontend/src/lib/store.test.tsx`
- Modify: `frontend/src/lib/store.tsx`
- Modify: `frontend/src/lib/domain.ts`

**Interfaces:**
- Produces: `connection`, `connectionError`, `refreshWorkspace()`, `loadTask()`, `loadReport()` in `AppStoreValue`.

- [ ] Test that missing or malformed local storage creates an empty normal workspace.
- [ ] Test that persisted business arrays are ignored while valid settings are restored.
- [ ] Test that failed hydration sets `connection=offline` without loading seed data.
- [ ] Run focused tests and verify expected failures.
- [ ] Implement empty normal state, explicit demo state, settings-only persistence and backend hydration.
- [ ] Rerun focused tests to green.

### Task 3: Real task completion and report navigation

**Files:**
- Create: `frontend/src/lib/realtime.test.tsx`
- Modify: `frontend/src/lib/realtime.ts`
- Modify: `frontend/src/components/task-workbench.tsx`
- Modify: `frontend/src/components/task-report-preview.tsx`

**Interfaces:**
- Consumes: `loadReport(taskId)` from the store.
- Produces: immediate current-report synchronization when WebSocket status becomes `done`.

- [ ] Test that a `done` WebSocket message updates progress and calls `loadReport(taskId)`.
- [ ] Verify the test fails before implementation.
- [ ] Trigger report synchronization from the WebSocket hook.
- [ ] Replace canned diagnosis, actor and evidence panels with backend task status and real report actions.
- [ ] Rerun focused tests to green.

### Task 4: Real report, material and offline screens

**Files:**
- Create: `frontend/src/components/app-shell.test.tsx`
- Modify: `frontend/src/components/app-shell.tsx`
- Modify: `frontend/src/components/app-screens.tsx`
- Modify: `frontend/src/components/report-editor.tsx`
- Modify: `frontend/src/components/analysis-page.tsx`

**Interfaces:**
- Consumes: store connection state and refresh/load methods.
- Produces: explicit offline banner, real material refresh and backend-current report editing.

- [ ] Test that offline mode renders an explicit backend connection warning.
- [ ] Verify the test fails before implementation.
- [ ] Add the connection banner and retry action.
- [ ] Refresh materials from the backend after uploads instead of adding local placeholders.
- [ ] Save a report version, then reload the current backend version before navigation.
- [ ] Remove UI claims based on `report.nodes.length` until structured graph data exists.
- [ ] Rerun focused tests to green.

### Task 5: Full verification and delivery

**Files:**
- Modify: `docs/PROJECT_ARCHITECTURE.md`

**Interfaces:**
- Produces: verified frontend behavior and updated architectural truth.

- [ ] Run `npm test` in `frontend/` and require all tests to pass.
- [ ] Run `npm run build` in `frontend/` and require production build success.
- [ ] Run root and backend pytest suites.
- [ ] Review `git diff --check`, staged file list and secret exclusions.
- [ ] Commit with `feat: make frontend use backend report truth` and push `main`.
