# Fullstack Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing kernel, FastAPI backend, and Next.js frontend one tracked, documented, verifiable local full-stack baseline.

**Architecture:** Keep the existing three-layer layout without changing runtime behavior. Establish `AGENTS.md` and `docs/PROJECT_ARCHITECTURE.md` as the repository boundary truth, then track only frontend source/config/assets while keeping generated and secret files ignored.

**Tech Stack:** Python, FastAPI, SQLite, Next.js 15, React 19, TypeScript, Git, Windows batch.

## Global Constraints

- Do not modify analysis logic, backend API contracts, or frontend page behavior in this phase.
- Do not read, copy, or modify the neighboring “Web 分析模型 codex” project.
- Do not stage dependencies, build output, runtime databases, generated reports, virtual environments, or secrets.
- Preserve the current user-authored frontend and launcher changes.

---

### Task 1: Establish the repository truth

**Files:**
- Modify: `AGENTS.md`
- Create: `docs/PROJECT_ARCHITECTURE.md`
- Create: `docs/superpowers/specs/2026-08-02-fullstack-baseline-design.md`
- Create: `docs/superpowers/plans/2026-08-02-fullstack-baseline.md`

**Interfaces:**
- Consumes: current repository layout and runtime commands.
- Produces: one documented full-stack identity and explicit workspace boundary.

- [ ] Update `AGENTS.md` so the architecture and launcher sections include `frontend/`.
- [ ] State that runtime prompts currently use `analysis_prompt.md` and `theory_config.json`.
- [ ] Add a boundary rule that agents stay inside this repository unless the user explicitly requests migration.
- [ ] Add `docs/PROJECT_ARCHITECTURE.md` with component responsibilities, data flow, ports and known limitations.
- [ ] Search for stale “前端已移除” statements and remove current-state contradictions.

### Task 2: Track the frontend baseline safely

**Files:**
- Add: `frontend/.gitignore`
- Add: `frontend/package.json`
- Add: `frontend/package-lock.json`
- Add: `frontend/next.config.ts`
- Add: `frontend/tsconfig.json`
- Add: `frontend/vitest.config.ts`
- Add: `frontend/vitest.setup.ts`
- Add: `frontend/public/harbor-analysis-hero.png`
- Add: `frontend/src/**`
- Modify: `start.bat`

**Interfaces:**
- Consumes: the existing local Next.js frontend and dual launcher.
- Produces: a reproducible tracked frontend source tree.

- [ ] Run `git status --untracked-files=all` and review every candidate file.
- [ ] Scan frontend candidates for secrets and absolute references to neighboring projects.
- [ ] Stage `frontend/`, `start.bat`, `AGENTS.md` and `docs/`.
- [ ] Run `git diff --cached --name-only` and verify `.next/`, `node_modules/`, `.env*` and `next-env.d.ts` are absent.
- [ ] Run `git ls-files frontend` and verify source/config/assets are present.

### Task 3: Verify and commit the baseline

**Files:**
- Test: `tests/`
- Test: `backend/tests/`
- Build: `frontend/`

**Interfaces:**
- Consumes: staged full-stack baseline.
- Produces: one auditable local commit with verification evidence.

- [ ] Run `python -m pytest -q tests` and record the exact result.
- [ ] Run `backend/.venv/Scripts/python.exe -m pytest -q -c backend/pytest.ini backend/tests` and record the exact result.
- [ ] Run `npm run build` in `frontend/` and record the exact result.
- [ ] Run `npm test` in `frontend/` and record the expected current “No test files found” limitation.
- [ ] Commit the reviewed baseline with message `chore: restore tracked fullstack workspace baseline`.

### Task 4: Restore remote backup

**Files:**
- No source changes.

**Interfaces:**
- Consumes: the local baseline commit and configured `origin` URL.
- Produces: a pushed GitHub branch or a precise authentication blocker.

- [ ] Run `gh auth status` and `git remote -v`.
- [ ] Verify whether `Zalgo1024/SanYuanJieGouBenDiGongZuoTai` exists and is accessible.
- [ ] If authentication is valid, push `main` and set upstream.
- [ ] If authentication is invalid or the repository is unavailable, keep the local commit intact and report the exact command needed after reauthentication.
