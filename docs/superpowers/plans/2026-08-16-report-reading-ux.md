# Report Reading UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化报告摘要和滚动目录，隐藏内部定量分类标签，并在报告正文中展示任意数量的真实关系图。

**Architecture:** 保持报告 Markdown 和研究快照为唯一数据来源。新增两个聚焦组件：`ReportOutline` 负责滚动定位，`ReportInlineGraphs` 负责解析并切换现有 DIAGRAM；`ReportPresentation` 仅负责编排。

**Tech Stack:** Next.js 15、React、TypeScript、Vitest、Testing Library、vis-network。

## Global Constraints

- 只修改 `frontend/` 与本计划文档，不修改后端和分析内核。
- 不补造图谱，解析失败的 DIAGRAM 继续跳过。
- 观测/派生分类只从界面隐藏，不删除研究数据。
- 所有行为先写失败测试再实现。

---

### Task 1: 报告摘要与滚动目录

**Files:**
- Create: `frontend/src/components/report-outline.tsx`
- Create: `frontend/src/components/report-outline.test.tsx`
- Modify: `frontend/src/components/report-reader.tsx`
- Modify: `frontend/src/components/report-presentation.test.tsx`
- Modify: `frontend/src/app/globals.css`

**Interfaces:**
- Consumes: `sections: Array<{ id: string; label: string }>`
- Produces: `ReportOutline({ sections })`

- [ ] **Step 1: Write the failing tests**

验证摘要 DOM 顺序、目录初始 `aria-current`，并通过模拟 `IntersectionObserver` 回调验证滚动后当前章节变化。

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/components/report-outline.test.tsx src/components/report-presentation.test.tsx`

Expected: FAIL，因为 `ReportOutline` 尚不存在且摘要布局类尚未提供。

- [ ] **Step 3: Implement minimal behavior**

使用 `IntersectionObserver({ rootMargin: "-18% 0px -68% 0px" })` 监听 `section.id`；目录项通过 `aria-current="location"` 暴露状态。CSS 使用两行 grid 和桌面 sticky。

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/components/report-outline.test.tsx src/components/report-presentation.test.tsx src/components/report-reader.test.tsx`

Expected: PASS。

### Task 2: 定量标签收敛

**Files:**
- Modify: `frontend/src/components/quantitative-evidence.tsx`
- Create: `frontend/src/components/quantitative-evidence.test.tsx`
- Modify: `frontend/src/app/globals.css`

**Interfaces:**
- Consumes: `ResearchBundle.quantitativeObservations`
- Produces: 仅对 `conflicted`、`unknown` 渲染 `.quantitative-status`。

- [ ] **Step 1: Write the failing test**

构造 observed、derived、conflicted、unknown 四项数据，断言前两种标签不可见、后两种风险标签可见，四个指标仍存在。

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/quantitative-evidence.test.tsx`

Expected: FAIL，当前组件仍显示全部状态标签。

- [ ] **Step 3: Implement minimal behavior**

把状态标签映射限制为 `{ conflicted: "来源冲突", unknown: "未知" }`，并更新说明文案。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/quantitative-evidence.test.tsx`

Expected: PASS。

### Task 3: 报告内多图谱

**Files:**
- Create: `frontend/src/components/report-inline-graphs.tsx`
- Create: `frontend/src/components/report-inline-graphs.test.tsx`
- Modify: `frontend/src/components/report-presentation.tsx`
- Modify: `frontend/src/components/report-presentation.test.tsx`
- Modify: `frontend/src/components/report-reader.tsx`
- Modify: `frontend/src/app/globals.css`

**Interfaces:**
- Consumes: `markdown: string`, `research?: ResearchBundle`, `relationHref?: string`
- Produces: `ReportInlineGraphs`，按 `parseReportGraphs(markdown).diagrams` 的实际长度渲染。

- [ ] **Step 1: Write the failing tests**

模拟 `GraphCanvas`，用含三段 DIAGRAM 的 Markdown 验证三个图谱标签、默认第一张和点击切换后的标题；验证无图时不渲染区域。

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/components/report-inline-graphs.test.tsx src/components/report-presentation.test.tsx`

Expected: FAIL，因为内嵌图谱组件尚不存在。

- [ ] **Step 3: Implement minimal behavior**

解析全部合法图，使用 `GraphCanvas` 显示活动图，提供图名标签、节点/关系数量、适应视口按钮和完整图谱链接。`ReportPresentation` 只在 reader 模式挂载组件。

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/components/report-inline-graphs.test.tsx src/components/report-presentation.test.tsx src/components/report-reader.test.tsx`

Expected: PASS。

### Task 4: 回归与视觉验收

**Files:**
- Verify: `frontend/src/app/globals.css`
- Verify: `frontend/src/components/report-reader.tsx`

- [ ] **Step 1: Run the complete frontend suite**

Run: `npm test -- --run`

Expected: 全部前端测试通过。

- [ ] **Step 2: Build production frontend**

Run: `npm run build`

Expected: Next.js build exit code 0。

- [ ] **Step 3: Run repository health check**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-all.ps1`

Expected: 内核、后端、前端和构建全部通过。

- [ ] **Step 4: Browser verification**

在现有报告页检查桌面与窄屏：摘要无大块空白，目录 sticky 且滚动高亮，内部分类标签隐藏，所有合法图谱可切换且画布非空。
