# Local Runtime Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide safe one-click start, stop and status commands for the local FastAPI and Next.js workbench.

**Architecture:** Keep batch files as thin Windows entry points and centralize process decisions in a PowerShell runtime controller. Separate pure decision helpers from operating-system side effects so ownership, build freshness and conflict behavior can be tested before process-control code is added.

**Tech Stack:** Windows batch, Windows PowerShell 5.1, Python/FastAPI/Uvicorn, Node.js, Next.js 15, Vitest.

## Global Constraints

- Do not modify analysis logic, backend business APIs, database models or report methodology.
- Bind both services to `127.0.0.1` only.
- Never stop a process unless its live command line belongs to this repository.
- Never silently choose alternate ports.
- Do not auto-install dependencies or expose the app to the LAN.
- Runtime logs and PID/state data belong in ignored `.runtime/`.

---

### Task 1: Testable runtime decisions

**Files:**
- Create: `scripts/runtime-lib.ps1`
- Create: `scripts/tests/runtime-lib.tests.ps1`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `Test-WorkspaceCommand`, `Get-PortDecision`, and `Test-FrontendBuildFresh`.

- [ ] Write tests proving repository paths match case-insensitively, unrelated commands do not match, port decisions are `free` / `reuse` / `conflict`, and stale sources invalidate a build.
- [ ] Run the test script and verify it fails because the helper library is absent.
- [ ] Implement the three pure helper functions without process side effects.
- [ ] Run the test script and verify every assertion passes.
- [ ] Ignore `.runtime/` in Git.

### Task 2: Runtime controller

**Files:**
- Create: `scripts/local-workbench.ps1`
- Create: `scripts/tests/runtime-controller.static.tests.ps1`

**Interfaces:**
- Consumes: pure helpers from `scripts/runtime-lib.ps1`.
- Produces: `-Action start`, `-Action stop`, and `-Action status` command modes.

- [ ] Write static contract tests for loopback binding, existing `/health` use, guarded process termination, production Next.js mode and `.runtime` logs.
- [ ] Run the static tests and verify they fail before the controller exists.
- [ ] Implement dependency resolution, live listener inspection, build freshness checking, service startup, health polling, JSON state, guarded stop and status output.
- [ ] Run helper and controller tests and verify they pass.

### Task 3: One-click entry points

**Files:**
- Modify: `start.bat`
- Create: `stop.bat`
- Create: `status.bat`
- Modify: `frontend/package.json`

**Interfaces:**
- Consumes: `scripts/local-workbench.ps1` action modes.
- Produces: user-facing double-click commands.

- [ ] Add static tests requiring each batch file to call the controller with the correct action.
- [ ] Run tests and verify they fail before the new entry points exist.
- [ ] Replace the development launcher with a thin production controller entry point.
- [ ] Add guarded stop and readable status entry points.
- [ ] Remove the stale `dev:local` package script that references a nonexistent file.
- [ ] Run all runtime tests.

### Task 4: Live acceptance and repository audit

**Files:**
- Modify: `docs/PROJECT_ARCHITECTURE.md`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: the completed runtime controller and existing project tests.
- Produces: an auditable stable local runtime and final plain-language project assessment.

- [ ] Stop the currently running development frontend after confirming ownership.
- [ ] Run the new start action and verify backend `/health` and frontend `/` return HTTP success.
- [ ] Run start again and verify listener PIDs do not change.
- [ ] Run status and verify both services are reported healthy.
- [ ] Run stop and verify ports 3000 and 8000 are released, then start once more for the user.
- [ ] Run runtime tests, all frontend tests, TypeScript checking, production build, kernel tests and backend tests.
- [ ] Audit Git status, ignored runtime files, absolute external paths, stale frontend-removal language and tracked generated artifacts.
- [ ] Update architecture and operator documentation with the stable commands and known limitations.
- [ ] Commit and push all reviewed changes; if GitHub is unreachable, retain the local commit and report the exact state.

