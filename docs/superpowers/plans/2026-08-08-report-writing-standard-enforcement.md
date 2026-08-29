# 报告写作标准执行 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让报告写作规格成为生成、校验和导出的实际门槛，而不是孤立文档。

**Architecture:** 后端使用短事实池代替抓取原文，提示词规定内部研究过程和干净交付格式，质量契约拒绝占位与结构缺失。内核新增共享章节标识，确保所有合格内容进入 Word/PDF/网页。

**Tech Stack:** Python、FastAPI 后端、Pydantic、pytest、现有 Markdown 内核。

## Global Constraints

- 不改 `theory_config.json`，不读取兄弟项目。
- 不批量重写历史报告。
- 事实不足时拒绝伪完整交付，绝不写占位说明或编造来源。

### Task 1: 事实池素材上下文

**Files:**
- Modify: `backend/app/materials.py`
- Test: `backend/tests/test_materials.py`

- [ ] Add `extract_fact_candidates(text, limit=5)` that splits cleaned text into short, unique sentence candidates and caps each source at five items.
- [ ] Change `format_materials_context` to send source title, URL and candidates, marked internal-only; remove raw body injection.
- [ ] Test that a long source yields at most five candidates and that output contains no full raw paragraph.

### Task 2: 共享交付章节路由

**Files:**
- Modify: `parser.py`
- Modify: `docx_renderer.py`
- Test: `tests/test_parser.py`, `tests/test_docx_renderer.py`

- [ ] Add canonical IDs for overview, evidence, core conflicts and recommendations.
- [ ] Add those IDs to each single-mode `MODULES` rendering order.
- [ ] Test that a case report retains all shared sections in `section_seq` and rendered document order.

### Task 3: 规则引擎无占位交付

**Files:**
- Modify: `backend/app/rule_engine.py`
- Test: `backend/tests/test_rule_engine.py`

- [ ] Replace all placeholder prose with structured, input-derived output or a validation error before report generation.
- [ ] Emit an overview, compact facts, four-column actor table, 3–5 conflict entries, confluence, forecasts, action blocks and source appendix only when corresponding input exists.
- [ ] Test that a complete structured fixture produces none of the prohibited placeholder phrases.

### Task 4: LLM prompt and quality contract

**Files:**
- Create: `backend/app/report_quality.py`
- Modify: `backend/app/prompt_builder.py`
- Modify: `backend/app/contract.py`
- Modify: `backend/app/generator.py`
- Test: `backend/tests/test_report_quality.py`, `backend/tests/test_contract.py`, `backend/tests/test_generator_split.py`

- [ ] Add pure quality checks for raw material markers, placeholders, common required parts, appendix links and diagram references.
- [ ] Add concise report-writing rules to the system prompt and a corrective rewrite prompt based on exact failed checks.
- [ ] Remove automatic placeholder section and placeholder diagram insertion; contract failure remains explicit.
- [ ] Test first-pass rejection and one rework pass, with no false valid contract.

### Task 5: Regression verification

- [ ] Run affected backend and core tests.
- [ ] Run full backend and frontend test suites, then build the frontend.
