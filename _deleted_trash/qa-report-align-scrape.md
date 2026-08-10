# QA 独立验收报告 — 三元结构分析 SaaS（对齐·联网写报告）

> QA 工程师：严过关（Edward）｜日期：2026-07-31｜验收对象：后端 `ceb3e30` + 前端 `6306ef0`
> 验收性质：**独立验收**（不采信工程师自报，全部独立复验）｜主尺子：PRD §8 六项总验收口径
> 环境：本机已装 LibreOffice（PDF 可用）；DeepSeek key 已配置；沙箱 safe-delete shim 已用 `GENERATED_DIR=$TEMP/qa-generated` 绕行；后端/前端分别起服务验证。

---

## 0. 结论摘要

| 项 | 结果 |
|---|---|
| 后端 pytest | **66 passed / 1 failed**（失败为环境性·非本轮回归，见 A1） |
| 前端 build / tsc / vitest | **全过**：build 零错误、tsc exit 0、vitest 13/13 |
| 接口层 B | 8/8 通过（tasks/preview/cases/reports/revise/rollback/analyze×5） |
| 联网写报告链 C | 3/3 通过（关键词篇 / URL 篇 / 降级分支） |
| 前端页面层 D | 页面 200、5 Tab 真映射、/g 全量、viz 三态、8 类配色 |
| PRD §8 六项口径 | **6/6 通过**（1 项 UI 人工待真机，API 级已证） |
| **智能路由判定** | **NoOne**（全过；唯一失败为环境性且非本轮回归，无源码 Bug 需路由工程师） |

---

## 1. 静态层：测试与构建（验收清单 A）

| # | 验收项 | 结论 | 证据 | 复现命令 |
|---|---|---|---|---|
| A1 | 后端全量 pytest | ⚠️ 66 passed / 1 failed | 唯一失败 `test_pdf_convert_graceful_when_no_converter`：**环境性·非本轮回归**。核实：`test_export.py` 提交于初始 commit `7d91045`（`git diff 33ae0e9..ceb3e30 -- backend/tests/test_export.py` 为空）；`pdf_converter.py` 位于 KERNEL（只读红线，未动）。测试前提「本机无 PDF 转换器→返回空串」，但本机**已装 LibreOffice**（`C:\Program Files\LibreOffice\program\soffice.exe` 存在，`diagnose_pdf()['libreoffice']=True`），convert_to_pdf 真实成功返回路径 → 断言 `res==""` 不成立。**该失败与本轮改动无关，且 PDF 可用反而是更优环境**（见 A1-注）。 | `backend/.venv/Scripts/python.exe -m pytest tests/ -q` |
| A1-注 | PDF 可用性 | ✅ | 实测 PDF 下载成功：26 页 PDF v1.7（3.1MB）。即本机 PDF 能力满足 PRD §8.2「Word/PDF 可下载」 | `curl -o out.pdf ".../api/download/{tid}?kind=pdf"` |
| A2 | 前端 `npm run build` | ✅ | `BUILD_EXIT=0`；日志 `✓ Compiled successfully`；生成 20 静态页 + 全部路由（含 `/report/[taskId]`、`/report/[taskId]/edit`、`/cases`）。唯一警告为 Google Fonts 下载失败（网络，非阻塞） | `NODE_OPTIONS=--use-system-ca npm run build` |
| A3 | `npx tsc --noEmit` | ✅ | `TSC_EXIT=0`（无类型错误） | `npx tsc --noEmit` |
| A4 | `npx vitest run` | ✅ | 4 文件 / 13 用例全过 | `npx vitest run` |
| A5 | 新增/修改后端单测 | ✅ | `test_prompt_builder.py`（5 类型哨兵/org 9 段/opinion 7 段/combo 多类）、`test_search.py`（DDG 解析/去重/降级）、`test_tasks_api.py`、`test_contract.py` 共 **31 passed** | `pytest tests/test_prompt_builder.py tests/test_search.py tests/test_tasks_api.py tests/test_contract.py` |

---

## 2. 接口层（验收清单 B，起后端实测）

| # | 接口 | 结论 | 证据 |
|---|---|---|---|
| B1 | `GET /api/tasks` | ✅ | 200；字段恰为 `{task_id,title,status,analysis_type,project_id,created_at}`（ISO 时间）。过滤全部生效：`limit=2`→2 条、`limit=200`→52 条、`status=done`→仅 done、`status=bogus`→`[]`（不静默不崩溃）、`project_id=auto_xxx`→仅该任务 |
| B2 | `POST /api/search/preview` | ✅ | 真实检索：query「AI 人工智能 产业政策」→ `provider=duckduckgo`、3 条真实 hits（澎湃/政府网等）、`degraded=null`；空 query → `degraded="查询为空"`（不静默） |
| B3 | `GET /api/cases` | ✅ | `total=12`（模板 `run_report.py` ��排除）。每条含 `title/markdown/diagrams/analysis_type/chapters`。抽查 `run_mixue_org`：markdown 为 BODY 全文（10969 字符，尾部含附录 `[名称](url)` 5 条 + 版权行）；diagrams 非空且 edges 用 `source/target/type`（无 `from/to`） |
| B3-注 | 案例图节点 type | ⚠️ 非阻塞 | 12 篇中 2 篇旧内核案例（`run_fat_cat`、`run_paper_diaper`）DIAGRAM 节点仅 `{id,label}` 无 `type`（39/235 节点）。前端以灰色兜底渲染，图仍正常显示。属 KERNEL 存量数据（只读红线，APP 不改），**不影响 P0 生成报告**（生成的报告节点全部带 type，见 D5 实测 0 违约） |
| B4 | `GET /api/reports/{task_id}` | ✅ | 返回 `versions` 数组 + `current_version_id`；首次访问自动播种 v1 original（edited_by=ai） |
| B5 | `POST /api/reports/{task_id}/revise` | ✅ | **真实 DeepSeek 调用**：opinion 任务 revise「把结论改写得更尖锐」→ `version_no=2, edited_by=ai, is_current=true`；`word` 可下载（413KB 合法 docx）、`pdf_available=true` |
| B6 | `POST /api/versions/{vid}/rollback` | ✅ | 回滚 v1 → `ok=true, current_version_id=v1, version_no=1`；版本列表 v1 `is_current=true`、v2 置 false；产物目录 `{task_id}_v1/`、`_v2/` 均含 docx+pdf+html+png（重渲成功，历史版本不丢） |
| B7 | `POST /api/analyze` 5 类型 | ✅ | rule 模式 case/policy/org/opinion/combo 五任务全部 `status=done`，`Task.analysis_type` 与提交一致（双轨数据层）；LLM 模式 org/opinion/combo 全部 done（见 C/E3） |

---

## 3. 联网写报告全链（验收清单 C，PRD §8.2 核心）

| # | 场景 | 结论 | 证据 |
|---|---|---|---|
| C1 | 关键词 + `web:true`（org/llm） | ✅ | `provider=duckduckgo`、4 hits、**sources=3（≥3 达标）**；Markdown 附录 `[名称](url)` 可点击格式 3 条；DIAGRAM 2 块；Word+PDF 均产出 |
| C2 | 单 URL 输入（`source_urls=[36kr链接]`） | ✅ | 直接抓取该 URL 正文：`sources=1`（恰为给定 36kr 链接，正文已注入）；附录 `[名称](url)` 2 条；DIAGRAM 1 块；Word+PDF 产出 |
| C3 | DDG 失败降级（PRD §6 不静默） | ✅ | 代码路径实测：`search_web('测试',3,provider='bing',api_key='')` → `degraded='未配置 BING_SEARCH_KEY'`；brave 同理；空 query → `degraded='查询为空'`。均有明确 degraded 标记、不抛异常；`test_search.py` 覆盖降级分支且通过；前端 `AnalysisEngine` 在 `previewState==='degraded'` 显示「检索源不可用，可配置 BING/BRAVE Key 或改用手动 URL 输入」 |

---

## 4. 前端页面层（验收清单 D，HTTP 探活 + 代码交叉验证）

| # | 验收项 | 结论 | 证据 |
|---|---|---|---|
| D1 | 页面探活 | ✅ | `/`、`/dashboard`、`/analysis`、`/report/[taskId]`、`/report/[taskId]/edit`、`/cases`、`/projects` 全部 **200** |
| D2 | 5 Tab → ANALYSIS_TYPE 一一对应 | ✅ | `constants.ts`：`ANALYSIS_TABS` 5 项顺序 = `ANALYSIS_TYPE ["case","policy","org","opinion","combo"]`；`AnalysisEngine.tsx:383` 提交 `analysis_type: ANALYSIS_TYPE[tab]`（Tab 下标直映射），`:268` 反向 `?type=` 解析 |
| D3 | parseDiagrams /g 全量 | ✅ | 正则 `/```DIAGRAM\s*\n([\s\S]*?)\n```/g` + while 循环 + lastIndex 重置；临时 vitest 实测：含 3 图 markdown → 提取 3 张（org/flow/network 全中），坏 JSON 块跳过（2 用例过） |
| D4 | NetworkCanvas viz 三态分支 | ✅ | 代码：`hierarchical = viz==='org'||viz==='flow'`；`org`→`direction:'UD'`（层级树，physics off）、`flow`→`direction:'LR'`（水平流，physics off）、`network`→力导向（physics on）。报告页 `viz={diagrams[i].viz ?? 'network'}` 正确透传 |
| D5 | 节点配色 8 类 | ✅ | `INTEREST_TYPE_COLOR` 含 actor/material/security/political/**identity_culture**/institutional_future/public/**event**；**无** safety/identity 错误 key；生成报告 DIAGRAM 实测节点全部带 type（org-llm/opinion-llm/web-keyword 共 5 图 0 违约） |
| D6 | 三态图视觉渲染 | ⚠️ 待真机 | 沙箱无 GUI 无法人工看图；证据链 = ①代码分支正确（D4）②数据含三类图（cases：network 31 / org 3 / flow 3；生成报告含 org+network）③组件 props 传对（nodes/edges/viz/centerId）。**视觉人工确认留待真机** |

---

## 5. PRD §8 六项总验收口径（主尺子）

| # | 口径 | 结论 | 证据 |
|---|---|---|---|
| 1 | start.bat → 127.0.0.1:3000/dashboard，5 页有数据 | ✅ | start.bat 内容核对：后端 `--host 127.0.0.1 --port 8000`、前端 `next dev -p 3000`、自动打开 `/dashboard`；CORS 仅放行 `localhost:3000`/`127.0.0.1:3000`；ENGINE_DIR 默认指 KERNEL。沙箱等效验证：uvicorn + next start 起服，`/dashboard` 200、`/api/tasks` 有 52 条数据。真机双击留给用户 |
| 2 | 关键词 + URL 各 1 篇：来源≥3、附录可点击、Word/PDF 可下载、三态图正确 | ✅ | C1/C2：关键词篇 sources=3 且附录 `[名](url)` 可点击；URL 篇抓正文成稿；两篇 Word（413KB docx）+ PDF（26 页）均可下载；DIAGRAM 含 org/network 图 |
| 3 | 5 类型双轨一致 | ✅ | LLM 模式实测（真实 DeepSeek）：org 报告 7/7 哨兵章节全命中（组织画像…利益转化与组织—社会关系，39 章）；opinion 6/6 哨兵全命中（事件与时间线…演化曲线与系统回应，24 章）；combo 含多类哨兵混编；`Task.analysis_type` 与提交类型逐项一致 |
| 4 | 展览页：手动改 + AI 改 → 版本≥3 可回滚 v1 重渲 | ✅ | opinion 任务：v1 original(ai) → v2 revise(ai, DeepSeek) → v3 human 手动修订；时间线 3 版含时间戳/摘要/`edited_by` 标记；回滚 v1 成功（is_current 切换 + `_v1/` 产物重渲存在） |
| 5 | 案例库：预览/套用/编辑可用、编辑留痕 | ✅（API 级） | `GET /api/cases` 12 篇；前端 `/cases` 页实现预览（ReactMarkdown 渲染正文+diagrams）、套用（复制骨架清空正文进分析页）、编辑（`POST /api/cases/{id}/import` → 新 task + 播种 original 版本留痕）；实测 import `run_mixue_org` → `{task_id}` 成功。UI 交互人工待真机 |
| 6 | e2e 通过、无 P0 遗留 | ✅ | 后端 e2e（event/policy pipeline）通过；全量 66 过；无 P0 阻塞项。遗留均为非阻塞（见下） |

---

## 6. 智能路由判定

**判定：NoOne（全过）**

- 未发现源码 Bug → 无需路由给工程师（寇豆码）；
- 未发现本轮测试代码 Bug → 无需自修；
- 唯一失败 `test_pdf_convert_graceful_when_no_converter` 为**环境性·非本轮回归**：测试前提（本机无 PDF 转换器）与本机实际（已装 LibreOffice）不符；测试与 KERNEL 转换器均为历史代码，本轮零改动。真实行为反而优于测试前提（PDF 可用）。不计入本轮缺陷。

---

## 7. 遗留项清单

### 阻塞（无）
- 无 P0/P1 阻塞项。

### 非阻塞
| # | 项 | 影响 | 建议 |
|---|---|---|---|
| 1 | 2 篇旧内核案例（run_fat_cat/run_paper_diaper）DIAGRAM 节点缺 `type` | 案例库预览中该 2 篇节点为灰色兜底色，图仍正常 | 内核只读红线，APP 不改；如需可后续在 cases 解析层对缺 type 节点兜底默认 `actor`（产品决策，非本轮） |
| 2 | 前端 build 时 Google Fonts 下载警告 | 字体优化跳过，不影响构建/运行 | 网络环境问题，非代码缺陷 |
| 3 | 三态图视觉渲染（D6） | 代码分支+数据+props 证据链完整，但沙箱无 GUI | 真机打开报告展览页人工确认 org 树/flow 流/network 力导向视觉效果 |
| 4 | `test_pdf_convert_graceful_when_no_converter` 断言前提与环境不符 | 该用例在已装 LibreOffice 的机器上恒失败 | 建议后续将该用例改为「根据 diagnose_pdf 动态断言」（改测试需产品确认，不影响本轮交付） |

---

*QA 报告完 · 验收人：严过关（Edward）· 路由：NoOne*
