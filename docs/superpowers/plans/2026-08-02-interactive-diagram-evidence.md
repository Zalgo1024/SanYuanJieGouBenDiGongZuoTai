# Interactive Diagram And Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render every valid `DIAGRAM` block from the backend current report as an interactive network, organization chart, or flow chart, alongside an honest report-level evidence inventory.

**Architecture:** A pure parser converts Markdown into normalized diagram and evidence records. A client-only `vis-network` adapter owns canvas lifecycle and interaction, while `AnalysisNetwork` composes selectors, tools, inspector and evidence panels without changing backend contracts.

**Tech Stack:** Next.js 15, React 19, TypeScript, Vitest, Testing Library, vis-network.

## Global Constraints

- Modify frontend code only; do not add backend endpoints or analysis logic.
- All graph facts must come from the backend current report Markdown.
- Evidence must be labeled as report citations or task-linked materials; do not infer claim-level proof links.
- Support `network`, `org`, and `flow`; unknown `viz` values fall back to `network`.
- Preserve the existing restrained research-workbench visual language and responsive behavior.

---

### Task 1: DIAGRAM And Evidence Parser

**Files:**
- Create: `frontend/src/lib/report-graph.ts`
- Create: `frontend/src/lib/report-graph.test.ts`

**Interfaces:**
- Produces: `parseReportGraphs(markdown: string): GraphParseResult`
- Produces: `collectReportEvidence(markdown: string, materials: MaterialRecord[]): EvidenceItem[]`
- Produces types `DiagramDocument`, `DiagramNode`, `DiagramEdge`, `EvidenceItem`, `GraphParseWarning`.

- [ ] **Step 1: Write failing parser tests**

```ts
expect(parseReportGraphs(markdown).diagrams).toHaveLength(3);
expect(parseReportGraphs(badMarkdown).warnings).toHaveLength(2);
expect(collectReportEvidence(markdown, materials)).toEqual(expect.arrayContaining([
  expect.objectContaining({ kind: "citation", url: "https://example.com/source" }),
  expect.objectContaining({ kind: "material", materialId: "material-1" }),
]));
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- --run src/lib/report-graph.test.ts`

Expected: FAIL because `report-graph.ts` does not exist.

- [ ] **Step 3: Implement strict normalization**

```ts
export function parseReportGraphs(markdown: string): GraphParseResult {
  const diagrams: DiagramDocument[] = [];
  const warnings: GraphParseWarning[] = [];
  for (const [index, raw] of diagramBlocks(markdown).entries()) {
    const normalized = normalizeDiagram(raw, index, warnings);
    if (normalized) diagrams.push(normalized);
  }
  return { diagrams, warnings };
}
```

Normalize node IDs and labels, accept only edges whose endpoints exist, generate stable edge IDs, and deduplicate citations by URL and materials by ID.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npm test -- --run src/lib/report-graph.test.ts`

Expected: all parser and evidence tests pass.

---

### Task 2: vis-network Canvas Adapter

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Create: `frontend/src/components/graph-canvas.tsx`
- Create: `frontend/src/components/graph-canvas.test.tsx`

**Interfaces:**
- Consumes: `DiagramDocument` from `@/lib/report-graph`.
- Produces: `GraphSelection = { kind: "node"; id: string } | { kind: "edge"; id: string } | null`.
- Produces imperative actions through `GraphCanvasHandle`: `fit()`, `zoomIn()`, `zoomOut()`, `focusNode(id)`.

- [ ] **Step 1: Install the proven graph runtime**

Run: `npm install vis-network@^9.1.9`

Expected: package and lockfile include `vis-network`.

- [ ] **Step 2: Write failing lifecycle and option tests**

Mock `vis-network/standalone` and assert that `network` uses physics, `org` uses hierarchical `UD`, `flow` uses hierarchical `LR`, selection callbacks are forwarded, and destroy runs on unmount.

- [ ] **Step 3: Implement the client canvas**

```tsx
export const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(
  function GraphCanvas({ diagram, onSelectionChange }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const networkRef = useRef<Network | null>(null);
    // Create Network from normalized nodes/edges, bind selectNode/selectEdge,
    // expose fit/moveTo/selectNodes, and destroy on dependency change.
    return <div ref={containerRef} className="graph-canvas" aria-label={diagram.title} />;
  },
);
```

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npm test -- --run src/components/graph-canvas.test.tsx`

Expected: graph lifecycle, layouts and selection tests pass.

---

### Task 3: Interactive Relationship Workbench

**Files:**
- Replace: `frontend/src/components/analysis-network.tsx`
- Create: `frontend/src/components/analysis-network.test.tsx`
- Modify: `frontend/src/app/globals.css`

**Interfaces:**
- Consumes: `taskId`, optional current `markdown`, optional `materials`.
- Uses: `parseReportGraphs`, `collectReportEvidence`, `GraphCanvas`.
- Produces: multi-diagram selector, graph toolbar, inspector, legend, warnings and evidence inventory.

- [ ] **Step 1: Write failing interaction tests**

Mock `GraphCanvas`; render two diagrams and assert tab switching, node search, warning display, evidence citation and linked material counts, plus an explicit empty state for reports without valid diagrams.

- [ ] **Step 2: Implement page composition**

```tsx
const parsed = useMemo(() => parseReportGraphs(markdown), [markdown]);
const evidence = useMemo(() => collectReportEvidence(markdown, materials), [markdown, materials]);
const [activeDiagramId, setActiveDiagramId] = useState(parsed.diagrams[0]?.id ?? "");
const [selection, setSelection] = useState<GraphSelection>(null);
```

Use icon buttons for fit/zoom, a search field for nodes, tabs for diagrams, and an inspector derived only from selected normalized node/edge data.

- [ ] **Step 3: Add stable responsive styling**

Desktop uses `minmax(0, 1fr) 300px`; mobile uses one column. Canvas uses a fixed responsive height and cannot resize when labels or selections change. Use existing design tokens plus differentiated node and edge colors.

- [ ] **Step 4: Run component tests and confirm GREEN**

Run: `npm test -- --run src/components/analysis-network.test.tsx`

Expected: all interaction and empty-state tests pass.

---

### Task 4: Page Integration And Real Data Verification

**Files:**
- Modify: `frontend/src/components/app-screens.tsx`
- Modify: `frontend/src/components/task-workbench.tsx`
- Modify: `docs/PROJECT_ARCHITECTURE.md`

**Interfaces:**
- Interest detail passes the current report Markdown and task-linked `MaterialRecord[]`.
- Task workbench passes the same current report and materials, so both routes show identical graphs and evidence.

- [ ] **Step 1: Pass task-linked materials into both graph entry points**

```tsx
const materials = state.materials.filter((item) => task?.materialIds.includes(item.id));
<AnalysisNetwork taskId={report.taskId} markdown={report.markdown} materials={materials} />
```

- [ ] **Step 2: Run all automated verification**

Run: `npm test -- --run`

Expected: all tests pass.

Run: `npm run build`

Expected: Next.js production build completes with all routes generated.

- [ ] **Step 3: Verify real diagrams in the browser**

Use current backend reports containing `network`, `org`, and `flow`. Confirm each canvas contains rendered pixels/nodes, tab switching changes layout, search focuses a node, inspector updates on selection, and evidence links/materials match report/task data.

- [ ] **Step 4: Verify responsive layout**

Check desktop and mobile viewports. Confirm the canvas is nonblank and framed, toolbar text fits, inspector moves below the graph, and no controls overlap.

- [ ] **Step 5: Independent review, commit and push**

Request a code review against the phase baseline, fix all blocking/important findings, then commit implementation as `feat: add interactive report graphs` and push `main`.
