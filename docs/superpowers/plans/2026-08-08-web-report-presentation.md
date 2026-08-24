# 网页报告呈现层 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将正式报告页、任务预览与编辑器预览统一为分层、可读且可追溯的网页报告体验。

**Architecture:** 以纯函数将 Markdown 解析为 `ReportPresentationModel`，把正文、来源块和摘要分开。一个共享 `ReportPresentation` 组件按 `reader`、`preview`、`editor` 三种模式输出，现有页面只保留各自的业务动作与外壳。

**Tech Stack:** Next.js 15、React 19、TypeScript、react-markdown、Vitest、Testing Library。

## Global Constraints

- 仅修改 `frontend/` 与本次设计/计划文档。
- 不变更后端 API、分析内核、报告 Markdown 或 `DIAGRAM` 图谱协议。
- 摘要只能摘录原文；未命中可靠结构时回退正文，不能生成新判断。
- 原始来源和联网抓取材料必须可展开查看。

---

### Task 1: 建立无损报告呈现模型

**Files:**
- Create: `frontend/src/lib/report-presentation.ts`
- Test: `frontend/src/lib/report-presentation.test.ts`

**Interfaces:**
- Produces: `parseReportPresentation(markdown, fallbackTitle): ReportPresentationModel`
- Produces: `ReportSection`、`ReportSourceBlock`、`ReportPresentationModel`

- [ ] **Step 1: Write the failing test**

```ts
it("extracts a conclusion and keeps scraped material out of the default body", () => {
  const model = parseReportPresentation(
    "# 标题\n\n## 核心结论\n\n结论原文。\n\n[联网抓取素材]\n\nhttps://example.com\n\n抓取原文。",
    "回退标题",
  );
  expect(model.summary.text).toBe("结论原文。");
  expect(model.sections.flatMap((section) => section.markdown)).not.toContain("抓取原文。");
  expect(model.sourceBlocks[0]?.markdown).toContain("抓取原文。");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/report-presentation.test.ts`

- [ ] **Step 3: Write minimal implementation**

```ts
export function parseReportPresentation(markdown: string, fallbackTitle: string): ReportPresentationModel {
  // Split headings and source markers without transforming source text.
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/report-presentation.test.ts`

### Task 2: 增加共享阅读组件

**Files:**
- Create: `frontend/src/components/report-presentation.tsx`
- Create: `frontend/src/components/report-presentation.test.tsx`
- Modify: `frontend/src/app/globals.css`

**Interfaces:**
- Consumes: `ReportPresentationModel` from `@/lib/report-presentation`
- Produces: `<ReportPresentation markdown fallbackTitle mode />`

- [ ] **Step 1: Write the failing test**

```tsx
render(<ReportPresentation markdown={markdown} fallbackTitle="标题" mode="reader" />);
expect(screen.getByText("核心判断")).toBeInTheDocument();
expect(screen.queryByText("抓取原文")).not.toBeInTheDocument();
fireEvent.click(screen.getByRole("button", { name: "展开证据与来源" }));
expect(screen.getByText("抓取原文")).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/report-presentation.test.tsx`

- [ ] **Step 3: Implement the component and styles**

Use semantic `section`/`details` markup; keep Markdown rendering through existing `MarkdownReport`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/report-presentation.test.tsx`

### Task 3: 接入三处现有页面

**Files:**
- Modify: `frontend/src/components/report-reader.tsx`
- Modify: `frontend/src/components/task-report-preview.tsx`
- Modify: `frontend/src/components/report-editor.tsx`
- Modify: corresponding existing component tests

**Interfaces:**
- Consumes: `<ReportPresentation>` from Task 2

- [ ] **Step 1: Extend existing reader/editor tests**

Assert that reader and editor show the shared summary and task preview does not reveal source material until expanded.

- [ ] **Step 2: Run affected tests to verify failure**

Run: `npm test -- src/components/report-reader.test.tsx src/components/report-editor.test.tsx src/components/report-presentation.test.tsx`

- [ ] **Step 3: Replace raw Markdown previews**

Keep version, download, rollback, save and network-link callbacks unchanged; only replace content rendering.

- [ ] **Step 4: Run affected tests**

Run: `npm test -- src/components/report-reader.test.tsx src/components/report-editor.test.tsx src/components/report-presentation.test.tsx`

### Task 4: 回归验证

**Files:**
- Modify: no production files unless verification reveals a defect.

- [ ] **Step 1: Run full frontend test suite**

Run: `npm test`

- [ ] **Step 2: Run production build**

Run: `npm run build`

- [ ] **Step 3: Inspect a running report page**

Run the existing local workbench and verify default source folding, summary anchor and all three usage contexts in the browser.
