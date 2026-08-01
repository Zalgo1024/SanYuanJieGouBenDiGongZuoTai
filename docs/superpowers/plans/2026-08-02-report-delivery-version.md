# Report Delivery And Version Implementation Plan

**Goal:** Complete the frontend report delivery loop with faithful Markdown rendering, backend-authoritative version history, rollback, and real Word/PDF downloads.

**Architecture:** A typed delivery adapter owns report-version and artifact API behavior. A shared Markdown renderer owns report presentation. A dedicated report reader composes history, preview, rollback and downloads while the editor reuses the same renderer and continues to save immutable revisions.

**Tech Stack:** Next.js 15, React 19, TypeScript, Vitest, Testing Library, react-markdown, remark-gfm.

## Global Constraints

- Modify frontend code and frontend documentation only.
- Use existing backend contracts exactly; do not add analysis or persistence logic.
- Keep the current backend version authoritative after save and rollback.
- Do not render raw `DIAGRAM` payloads in report prose.
- Preserve the current restrained local-workbench design system.

### Task 1: Version And Artifact Adapter

**Files:**
- Modify: `frontend/src/lib/domain.ts`
- Modify: `frontend/src/lib/workspace-api.ts`
- Create: `frontend/src/lib/report-delivery.ts`
- Create: `frontend/src/lib/report-delivery.test.ts`
- Modify: `frontend/src/lib/workspace-api.test.ts`
- Modify: report fixtures as required by the typed domain model

- [ ] Write failing tests for complete version metadata, current-version hydration, historical content loading, rollback request and Word/PDF binary errors.
- [ ] Add `ReportVersionSummary`, `currentVersionId` and `versions` to the domain model.
- [ ] Implement typed adapter functions and connect `fetchCurrentReport` to the normalized version index.
- [ ] Run focused adapter tests until green.

### Task 2: Shared Report Markdown Renderer

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Replace: `frontend/src/lib/markdown.tsx`
- Create: `frontend/src/lib/markdown.test.tsx`

- [ ] Install `react-markdown` and `remark-gfm`.
- [ ] Write failing tests for headings, stable outline anchors, tables, external links, lists and hidden `DIAGRAM` blocks.
- [ ] Implement normalization, outline extraction and accessible rendering without raw HTML execution.
- [ ] Reuse the renderer in task report preview.
- [ ] Run focused renderer tests until green.

### Task 3: Reader Delivery And Version History

**Files:**
- Create: `frontend/src/components/report-reader.tsx`
- Create: `frontend/src/components/report-reader.test.tsx`
- Modify: `frontend/src/components/app-screens.tsx`
- Modify: `frontend/src/app/globals.css`

- [ ] Write failing interaction tests for loading version history, historical preview, returning to current, rollback confirmation, and Word/PDF/Markdown download actions.
- [ ] Move report-reader behavior out of the large screen registry.
- [ ] Implement the real outline, version rail, historical banner, rollback flow and artifact actions.
- [ ] Keep request races and errors local to the relevant controls.
- [ ] Add responsive desktop/mobile layout and complete focus/loading/disabled states.
- [ ] Run focused reader tests until green.

### Task 4: Editor Integration And Verification

**Files:**
- Modify: `frontend/src/components/report-editor.tsx`
- Modify: `frontend/src/app/globals.css`
- Modify: `docs/PROJECT_ARCHITECTURE.md`
- Create or modify editor tests as needed

- [ ] Reuse the shared Markdown renderer in preview.
- [ ] Add a version-note field and unsaved-change state; save remains append-only through the existing endpoint.
- [ ] Run all frontend tests and TypeScript checking.
- [ ] Run the Next.js production build.
- [ ] Verify a real multi-version report and download error handling in desktop and mobile browser viewports.
- [ ] Request an independent code review, fix important findings, commit, and push `main`.
