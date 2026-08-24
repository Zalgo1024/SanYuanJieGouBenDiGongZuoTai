# Analysis Input Help Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add concise, contextual guidance for LLM temperature and the new-analysis composer without changing analysis behavior.

**Architecture:** Keep all behavior in focused frontend components. Export pure helpers for temperature bands and analysis examples so UI copy can be tested independently, then render the guidance through native disclosure and existing form controls.

**Tech Stack:** Next.js 15, React 19, TypeScript, Vitest, Testing Library, existing CSS tokens and Lucide icons.

## Global Constraints

- No backend or API contract changes.
- Default temperature remains `0.3`; recommended report range is `0.2-0.4`.
- The tutorial is optional, inline and replayable; no modal or forced walkthrough.
- Existing analysis submission, attachments and web-search controls remain unchanged.

---

### Task 1: Temperature guidance

**Files:**
- Modify: `frontend/src/components/llm-connection-settings.tsx`
- Modify: `frontend/src/app/globals.css`
- Test: `frontend/src/components/llm-connection-settings.test.tsx`

**Interfaces:**
- Produces: `temperatureGuidance(value: number): { label: string; detail: string }`.

- [ ] Write a failing test asserting `0.2` is “严谨稳定”, `0.3` is “均衡分析”, and the UI says temperature is not analysis depth.
- [ ] Run `npm test -- llm-connection-settings.test.tsx` and confirm the missing helper/content failure.
- [ ] Implement the pure mapping helper and persistent helper text below the numeric input.
- [ ] Add compact responsive styling using existing surface, ink and semantic tokens.
- [ ] Re-run the targeted test and confirm it passes.

### Task 2: Progressive analysis-input tutorial

**Files:**
- Modify: `frontend/src/components/analysis-creation.tsx`
- Modify: `frontend/src/app/globals.css`
- Test: `frontend/src/components/analysis-creation.test.tsx`

**Interfaces:**
- Produces: `analysisInputExamples: Record<AnalysisType, { title: string; prompt: string }>`.

- [ ] Write failing tests that open “查看输入教程”, verify the event-analysis example, switch to policy analysis, and fill the matching example into the textarea.
- [ ] Run `npm test -- analysis-creation.test.tsx` and confirm failure because the tutorial does not exist.
- [ ] Add native `<details>` disclosure, minimum-input guidance, dynamic example copy and “填入示例”.
- [ ] Replace the desktop aside copy with a concise submit checklist while retaining existing system behavior information.
- [ ] Add desktop/mobile styles and visible focus states; keep the mobile tutorial available even when the aside is hidden.
- [ ] Re-run the targeted test and confirm it passes.

### Task 3: Verification

**Files:**
- Verify only; no new production files.

- [ ] Run all frontend Vitest tests.
- [ ] Run `scripts/verify-all.ps1` and confirm kernel, backend, frontend and production build pass.
- [ ] Restart the local workbench.
- [ ] Inspect `/settings` and `/analysis` at desktop and mobile widths, including tutorial expansion, example insertion and text wrapping.
