# 三元结构理论分析系统 — 工作手册

## 项目定位

三元结构理论社会事件/政策/组织/舆情结构化分析系统——**完整自包含项目**（内核渲染层 + 后端 API 层同仓；前端已整体移除，待重建）：

- **用户工作流**：丢关键词/链接 → AI 智能体读取本项目方法论 → **自动写完整报告 + 利益关系网络** → 内核排版 Word/PDF/交互式 HTML → 报告展览页（可下载/可编辑/版本留痕）。用户全程不手写成稿。
- **当前使用路径**：
  1. **命令行内核**：`cases/run_*.py` 脚本 + `engine.export_from_text()` 直出报告。
  2. **后端 API**：`start.bat` 启动 FastAPI 服务（127.0.0.1:8000，含交互文档 /docs），前端移除后可经 API 重新接界面。

**核心方法论**：三元结构理论（生存—繁衍—逆反—利益四维框架）
**覆盖四类分析**：政策分析（8段式）、事件/案例分析（5段式 / 深度8段式）、组织诊断（9段式）、舆情分析（7段式）＋组合（源序）
**著作权**：© 2026 李政恒，国作登字-2026-A-00048134
**代码许可**：GNU AGPL v3

---

## 项目架构

```
project_root/（本仓库 = 内核 + 后端 API 完整项目；前端已移除）
│
├── start.bat                    ← 一键启动后端（FastAPI 8000，绑 127.0.0.1）
│
├── backend/                     ← 后端 API（FastAPI，5244 行级）
│   ├── app/
│   │   ├── main.py              ← FastAPI 装配（CORS/启动/任务恢复）
│   │   ├── settings.py          ← ENGINE_DIR 默认指向本项目根（内核同仓）
│   │   ├── queue.py             ← 任务队列（数据库即队列 + 崩溃恢复 + WS 进度）
│   │   ├── search.py            ← 联网检索（BING→BRAVE→DuckDuckGo 零 Key 降级）
│   │   ├── materials.py         ← 素材组装 + 来源清单
│   │   ├── generator.py         ← AI 生成编排（web_mode / revise 再改）
│   │   ├── prompt_builder.py    ← 5 类型提示词 + 哨兵章节护栏（双轨一致性）
│   │   ├── contract.py          ← 生成后契约校验（type_mismatch 重试）
│   │   ├── engine_bridge.py     ← 内核黑盒门面（调 export_from_text）
│   │   ├── models.py / db.py    ← SQLite（Task/Project/ReportVersion 版本留痕）
│   │   └── routers/             ← analyze/tasks/search/cases/reports/…
│   └── tests/                   ← 67 个后端测试
│
├── engine.py                    ← 内核引擎（编排流程，唯一出口 export_from_text）
├── parser.py                    ← Markdown → 结构化数据（章节自动路由）
├── docx_renderer.py             ← Word 渲染器
├── pdf_converter.py             ← PDF 转换（LibreOffice）
├── viz_network.py               ← 利益关系网络图（network/org/flow 三态）
├── config.py / theory_config.json（理论配置，不动）
├── analysis_prompt.md           ← 分析提示词模板
├── cases/                       ← 命令行案例脚本（run_*.py，12 篇真实案例）
├── tests/                       ← 内核测试（章节编号等）
├── reports/                     ← 内核命令行产物（不入库）
├── _archived/                   ← 历史孤儿归档（旧 backend 适配器留档，不入库；旧 frontend 快照已随前端清理一并移除）
└── AGENTS.md                    ← 本文件（工作手册）
```

> **方法论 Skill 统一位置说明**：7 个方法论文档（`完整版` / `案例分析本体` / `利益分析`（含内嵌多主体扩展）/ `政策分析与推导` / `组织诊断` / `舆情分析` / `立场显影剂`）统一存放于兄弟目录 `../三元结构理论 本体/skill们/`（不在本 git 仓库内，仅本地）。Web 后端 `prompt_builder.py` 按这些方法论拼装系统提示词。
> - `立场显影剂`：个体立场穿透补丁，与舆情 / 利益 / 组织互补（不接引擎，作模块加载）。
> - `舆情分析`：已接引擎为第 4 类报告类型（7 段式）。
> - `多主体利益分析工作台` 已并入 `利益分析 Skill.md` 的「多主体利益分析扩展（高级）」章节，利益分析现为本技能唯一真源。

---

## 一键启动（后端 API）

```
双击 start.bat
```
- 后端 FastAPI :8000（绑 127.0.0.1，优先用 `backend/.venv`；缺失则回退系统 python），启动后自动打开 `http://127.0.0.1:8000/docs`
- 前端已移除（2026-08-01 清理），后续重建前端时再补充启动方式
- 数据全本机：SQLite `backend/data/app.db` + 产物 `backend/generated/`（不入库）
- LLM/搜索密钥：仅存 `backend/.env` 或 `backend/data/llm_settings.json`，绝不提交
- 手动启动（不双击）：`cd backend && .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000`

## 已有案例清单

| 脚本文件 | 案例名称 | 创建时间 | 备注 |
|---|---|---|---|
| `cases/run_report.py` | 模板脚本（空白模板） | 2026-06-18 | 新建案例时复制此文件 |
| `cases/run_trademark_law_2026.py` | 第七十七号主席令的政策逻辑——《商标法》修订（2026）分析 | 2026-06-27 | 政策分析（8段式模板） |
| `cases/run_government_work_report_2026.py` | 4.5%与4%的双重约束——2026年政府工作报告的政策逻辑 | 2026-07-14 | 政策分析（8段式） |
| `cases/run_one_person_company_gd.py` | 一人公司的制度突围——广东自贸区一人公司试点政策分析 | 2026-07-14 | 政策分析（8段式） |
| `cases/run_psychological_trauma.py` | 不被爱的幸存者：结构性创伤与防御性攻击的心理机制分析 | 2026-07-14 | 案例分析（5段式） |
| `cases/run_fat_cat.py` | 一场死亡的舆论分裂——胖猫事件的五主体叙事博弈分析 | 2026-07-14 | 案例分析（5段式），由 docx+html 反推补回 |
| `cases/run_paper_diaper.py` | 符合国标的有毒纸尿裤——甲酰胺事件的多主体制度博弈分析 | 2026-07-14 | 案例分析（5段式），由 docx+html 反推补回 |
| `cases/run_one_person_company_huizhou.py` | 一人公司的政策时差——惠州数字产业与惠城惠企奖补里的个体创业落点 | 2026-07-26 | 政策分析（8段式），基于惠市工信〔2024〕240号 + 惠城科工信一本通 |
| `cases/run_love_and_producer_lingxiao.py` | 被收回的新男主：恋与制作人凌肖七年维权与情感契约的单边改写 | 2026-07-26 | 深度事件分析（8段式：事实摘要/框架/利益主体识别/利益动线与转化/三元结构正文/制度与叙事作用/结论/附录），对标政策分析粒度 |
| `cases/run_mixue_org.py` | 平价帝国的暗线：蜜雪冰城组织诊断（总部、加盟商与品控的三元张力） | 2026-07-26 | 组织诊断（9段式），含 3 张 DIAGRAM（组织架构图 org + 资金流程图 flow + 利益关系网络 network） |
| `cases/run_fanquan_gender_mobilization_org.py` | 从饭圈到性别动员：一种平台动员能力迁移假说的结构评估 | 2026-07-27 | 组织诊断（9段式），将知乎回答降格为迁移假说评估，重点拆解证据边界、替代解释、协同操控识别与平台治理窗口，含 3 张 DIAGRAM |
| `cases/run_public_opinion_demo.py` | 一场平台算法限流争议的舆情七段式拆解（示例/模板） | 2026-07-27 | 舆情分析（7段式）模板与自测：演示七段结构，正文为占位示例；真实使用时替换 BODY 即可，引擎自动路由为舆情报告 |
| `cases/run_fang_xinghai_investigation_org_policy_opinion.py` | 方星海被查事件：任期政策取向与量化交易支持逻辑评估 | 2026-07-27 | 组合分析（舆情 + 组织 + 政策），区分调查事实、公开政策取向、制度性推断与未证实个人利益，含职务关系、利益网络与量化支持逻辑 |

**规则**：
- 新案例脚本统一存放在 `cases/` 目录，不要放在项目根目录
- 脚本为一次性产物，用完即弃；报告文件在 `reports/` 中持久保留
- 新增案例后立即更新此清单
- **任何报告必须先有 `cases/` 脚本再跑 engine，禁止临时脚本直出报告**（已发生胖猫/甲酰胺绕过事件）
- **正式交付用 `export_from_text(..., overwrite=True)`**，避免 reports/ 反复堆积同名多份

### 报告类型自动识别（无需传参）

引擎**不接收 `analysis_type` 参数**，而是根据 `parser.py` 解析出的章节 ID 自动选择章节顺序与渲染分支：

| 报告类型 | 触发章节（命中其一即路由） | 章节顺序模板 |
|---|---|---|
| 政策分析 | 含 `policy_portrait` / `case_portrait` 等 8 段式章节 | 8 段式 |
| 事件/案例分析 | 含 `event_portrait` 等事件章节 | 5 段式 / 深度 8 段式 |
| 组织诊断 | 含 `org_portrait` / `org_structure` / `org_survival` / `org_reproduction` / `org_interest_network` / `org_reverse` / `org_transformation` 任一项 | 9 段式 |
| 舆情分析 | 含 `opinion_event` / `opinion_actors` / `opinion_narrative` / `opinion_trilife` / `opinion_reverse` / `opinion_evolution` 任一项 | 7 段式（事件与时间线 → 利益主体与沉默方 → 叙事竞争矩阵 → 三元生命维度 → 逆反性质与层级 → 演化曲线与系统回应 → 核心判断 → 附录） |
| **组合（源序）** | 同时命中 ≥2 种模式的哨兵（如 `opinion_event`+`case_portrait`+`org_portrait`+`policy_portrait`） | 按作者书写**源序**依次渲染各模式章节——命名空间互不重叠者直接拼；政策+事件共享「事实摘要/分析框架/三元结构分析正文」三件套，写一次=共享引言、写两次=各成一段，不再静默覆盖。单模式仍走上方 canonical 序（零回归）。详见 `组合报告模式_L2设计.md` |

新增分析维度时，只需同步改三处：`parser._SECTION_IDS`（章节映射）、`docx_renderer.render_docx`（section_order 分支）、`analysis_prompt.md`（提示词模板），引擎无需改。舆情分析引入「三元生命维度」：把舆论当活体，以**生存（定义权+解释权）/繁衍（话语权+叙事）/逆反（防御+反噬）**三层拆解其生命机制（详见 `../三元结构理论 本体/skill们/三元结构理论 舆情分析 Skill.md` 与 `analysis_prompt.md` 的七段式模板）。

### 章节序号统一规则

所有正式报告的一级章节序号由 `docx_renderer.py` 按该报告模式的渲染顺序统一生成，使用中文序号（如“一、”“二、”）。案例脚本可以写有序号，也可以不写；渲染器会先清理已有的中文或阿拉伯数字前缀，再按实际章节位置补齐，避免重复编号。政策、事件、组织等所有模式均适用，`三元结构分析正文` 也计入并显示为正式章节，保证目录和正文连续一致。

### DIAGRAM 可视化图表（三类）

引擎的 `viz_network.py` 支持 **三种图表布局**，通过 DIAGRAM JSON 的 `"viz"` 字段选择：

| viz | 名称 | 布局算法 | 适用场景 |
|---|---|---|---|
| `network`（默认） | 利益关系网络图 | 力导向（spring_layout） | 多主体复杂关系、利益流向全景、无固定层级 |
| `org` | 组织架构图 | 自上而下树形层级（BFS 分层） | 控制链/股权结构/组织版图；边标注控制权与资金流向；节点按利益集团角色着色 |
| `flow` | 流程图 | 自左向右分层流程（BFS 分层 LR） | 资金流转、决策链路、扩张路径等时序/因果过程 |

三种图共用六类节点颜色（利益角色）和四类边样式（经济/权力/文化/法律），区别仅在布局。组织诊断建议至少配 **org 架构图 + network 利益关系网络** 两张，可选配 **flow 流程图**。

**HTML 自包含（离线可开）**：交互式 HTML 已内联 vis-network 库（项目 `libs/vis-network.min.js`，689KB），不再依赖 unpkg CDN。生成前需保证 `libs/vis-network.min.js` 存在（缺失时回退 CDN）。

---

## 工作规范

1. **复用不重造** — 做任何事之前，先检查是否已有现成的工具/脚本能做到
2. **不要绕过 engine 生成报告** — 所有报告必须通过 `CaseAnalysisEngine.export_from_text()` 产出
3. **不要修改 theory_config.json** — 除非用户明确要求修改理论定义
4. **写新脚本时复制 run_report.py 模板**，不要另起炉灶
5. **未知时先问** — 不理解需求时先提问，不要猜测
6. **数据来源可溯源** — 附录中每条来源必须标注具体出处名称 + `[链接](url)`，禁止"综合网络信息"等笼统写法。确保每条来源在 Word 和 PDF 中均可点击打开

### 命名规范

| 类型 | 格式 | 示例 |
|---|---|---|
| 案例脚本 | `run_报告名.py` | `run_datong_an.py` |
| 报告输出目录 | `reports/报告名_YYYYMMDD_HHMMSS/` | `reports/datong_an_20260618_143000/` |
| 变量/函数 | snake_case 英文 | `export_from_text()` |
| 核心类 | PascalCase | `CaseAnalysisEngine` |

### 分析写作铁律

- **案例先行**：每节先讲案例事实，再引入概念解释
- **概念限额**：最多选 3 个概念（特殊 ≤ 4），跨维度自由组合
- **事实驱动**：每一句分析必须有案例中的具体事实支撑
- **冲突式标题**：标题要引人入胜
- **禁止分层列举**：不用"第一层…第二层…第三层…"
- **可传播金句必写**：最后 1-2 句让人记住的核心观点
- **价值中立**：只描述机制，不做道德评价
