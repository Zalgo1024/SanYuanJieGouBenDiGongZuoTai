# 分析生成管线稳定化设计

## 一、目标

本次整改解决五个互相依赖的问题：

1. 明确自由输入、结构化输入、规则引擎与 LLM 的产品边界，保证主入口不会创建必然失败的任务。
2. 消除报告初始版本与后续版本的并发写入竞态。
3. 把 `docs/report-writing-spec.md` 从提示词要求升级为可执行质量闸门。
4. 合并工作台与项目入口，移除材料库、报告和利益拆解的重复主导航。
5. 修复测试、整理当前工作区，并按可审查的逻辑提交保存。

本次不修改 `theory_config.json`，不访问相邻项目，不新增用户、收费或云端能力。

## 二、产品原则

### 2.1 输入方式与生成引擎必须分离

输入方式描述用户提供了什么，生成引擎描述系统用什么处理，两者不能继续共用一个含混的 `mode` 概念。

- `input_mode=freeform`：用户只提供问题、链接、自由文本或附件。
- `input_mode=structured`：用户明确提供事件事实、主体、关系、证据和分主体建议。
- `engine_mode=auto`：系统依据输入完整度和 LLM 可用性选择引擎。
- `engine_mode=llm`：明确使用 LLM。
- `engine_mode=rule`：明确使用规则引擎。

后端仍通过 `engine_used=llm|rule` 记录实际执行引擎，不能把请求意图当作执行结果。

### 2.2 自动路由矩阵

| 输入方式 | 引擎设置 | 前置条件 | 实际执行 | 不满足条件时 |
|---|---|---|---|---|
| `freeform` | `auto` | LLM 可用 | LLM | 创建任务前返回可读错误 |
| `freeform` | `llm` | LLM 可用 | LLM | 创建任务前返回可读错误 |
| `freeform` | `rule` | 无 | 不执行 | 提示切换结构化录入 |
| `structured` | `auto` | 结构校验通过 | 规则引擎 | 返回缺失字段清单 |
| `structured` | `rule` | 结构校验通过 | 规则引擎 | 返回缺失字段清单 |
| `structured` | `llm` | 结构校验通过且 LLM 可用 | LLM 增强 | LLM 不可用时允许规则引擎接管 |

默认设置从 `rule` 改为 `auto`。旧客户端未发送 `input_mode` 时，后端根据是否存在完整 `structured` 数据兼容推断：完整则为 `structured`，否则为 `freeform`。

### 2.3 降级边界

- 自由输入的 LLM 调用失败时，最多进行两次生成或契约修订，不得降级到只能得到题目和事件文本的规则引擎。
- 结构化输入的 LLM 调用失败时，允许用同一份 `StructuredInput` 降级到规则引擎。
- 搜索失败仍可降级为无联网材料分析，但必须在任务元数据中记录 `search_results.degraded`。
- 任何降级都必须记录 `degraded_from_llm` 和 `degrade_reason`，并在前端报告元数据中可见。

## 三、后端组件设计

### 3.1 生成路由器

新增独立的生成决策模块，避免路由、任务队列和 `ReportGenerator` 各自猜测模式。

建议文件：`backend/app/generation_routing.py`

核心接口：

```python
class GenerationDecision(BaseModel):
    input_mode: Literal["freeform", "structured"]
    requested_engine: Literal["auto", "llm", "rule"]
    selected_engine: Literal["llm", "rule"]
    may_fallback_to_rule: bool


def decide_generation_route(
    *,
    input_mode: str | None,
    requested_engine: str | None,
    structured: dict | None,
    llm_available: bool,
) -> GenerationDecision:
    ...
```

`POST /api/analyze` 在创建任务前调用该函数。决策失败返回 HTTP 422 和统一错误信封，不写入 Task，不启动后台线程。

任务落库时保存：

- `input_mode`
- `requested_engine`
- `selected_engine`
- `structured_input`

兼容期内保留旧 `mode` 字段读取，但新代码不再把它作为唯一真源。

### 3.2 规则引擎输入校验

`rule_engine.validate_structured_input()` 成为公开接口，返回结构化结果而不是只抛出字符串异常：

```python
class StructuredInputValidation(BaseModel):
    valid: bool
    missing_fields: list[str]
```

规则引擎必须继续坚持不猜主体、不猜关系、不猜证据。自由输入无法通过该校验是正常产品行为，不是后台任务阶段错误。

### 3.3 报告版本服务

新增 `backend/app/report_version_service.py`，报告路由和项目详情统一调用，不再自行写版本事务。

核心接口：

```python
def ensure_original_version(db: Session, task: Task) -> ReportVersion:
    ...


def create_report_version(
    db: Session,
    *,
    task: Task,
    markdown: str,
    html: str | None,
    kind: str,
    edited_by: str,
    editor: str,
    summary: str,
) -> ReportVersion:
    ...
```

初始版本使用 SQLite 原子插入：

```sql
INSERT INTO report_versions (..., task_id, version_no, ...)
VALUES (..., :task_id, 1, ...)
ON CONFLICT(task_id, version_no) DO NOTHING;
```

插入后查询 `(task_id, version_no=1)` 并返回现存记录。初始播种不得先把其它版本全部设为非当前，也不得依靠捕获 `commit()` 异常处理在 `autoflush` 阶段发生的冲突。

新版本创建遵循以下事务顺序：

1. 进入受控事务。
2. 读取当前最大版本号。
3. 插入新版本并显式 `flush()`。
4. 成功后把同任务其它版本设为非当前。
5. 把新版本设为当前并提交。
6. 唯一约束冲突时回滚、重新读取版本号，最多重试三次。

测试必须使用临时 SQLite 数据库和真实并发请求，不能只使用模拟 `commit()` 异常。

### 3.4 报告质量闸门

新增 `backend/app/report_quality.py`，统一校验 LLM 与规则引擎产物。

```python
class QualityIssue(BaseModel):
    code: str
    severity: Literal["error", "warning"]
    message: str
    section: str | None = None


class ReportQualityResult(BaseModel):
    valid: bool
    score: int
    issues: list[QualityIssue]


def evaluate_report_quality(
    markdown: str,
    *,
    analysis_type: str,
    used_web_sources: bool,
) -> ReportQualityResult:
    ...
```

#### 硬性错误

出现任一硬性错误时 `valid=false`：

1. 缺少对应报告模式的必要章节或章节顺序错误。
2. 出现“未提供”“未标注”“建议补充”“结构占位”“依据不足”等占位失败句。
3. 残留 `【联网抓取素材】`、`【内部研究材料】`、`[素材]` 等素材标签。
4. 缺少合法 DIAGRAM，或者 DIAGRAM 没有有效节点。
5. “核心冲突点”不是 3 至 5 条。
6. 结论缺少“汇流段、核心判断、博弈终局预判”要求的子结构。
7. 缺少按主体分块的行动建议。
8. 使用联网来源却没有附录 Markdown 链接。
9. 报告没有任何“图 N”正文引用。

#### 质量警告

警告不阻止交付，但进入元数据并在前端显示：

1. 事实摘要数量不在 3 至 6 条。
2. 情况概述不是 2 至 4 个自然段。
3. 主体名称全部为“相关方、有关部门、平台”等泛化词。
4. 结论没有出现至少两个已识别的具体主体名。
5. 博弈终局预判缺少触发条件表达。

质量分初始为 100，每项硬性错误扣 20 分，每项警告扣 5 分，最低为 0。`valid` 只由硬性错误决定，分数仅用于展示和回归比较。

### 3.5 质量修订循环

LLM 路径：

1. 生成 Markdown。
2. 运行现有结构契约校验。
3. 运行质量闸门。
4. 如果有硬性错误，把错误代码与消息作为定向修订指令，要求 LLM 返回完整修订稿。
5. 最多修订两次。
6. 仍不合格则任务以 `quality_gate` 阶段失败，不保存正式报告版本。

规则引擎路径：

1. 生成 Markdown。
2. 运行同一质量闸门。
3. 不允许调用 LLM 修补。
4. 不合格视为规则模板或结构化输入缺陷，任务失败并暴露精确问题。

契约层只修复版权、边类型等非分析性格式问题，不得自动补造章节、主体、关系或建议。

## 四、前端信息架构

### 4.1 主导航

主导航只保留：

1. 工作台 `/dashboard`
2. 新建分析 `/analysis`
3. 设置 `/settings`

移除“项目、材料库、报告、利益拆解”四个独立主导航项。

### 4.2 工作台与项目合并

`/dashboard` 同时承担：

- 项目列表与筛选。
- 最近分析任务。
- 最近报告。
- 失败任务与需要处理的质量问题。

`/projects` 作为兼容路由跳转到 `/dashboard`；`/projects/[id]` 保留为项目详情页。

### 4.3 嵌套入口

- 材料：在新建分析和项目详情中管理。
- 报告：从项目详情、任务工作台和最近报告进入。
- 关系网络：成为任务工作台与报告阅读器的标签页或明确操作按钮。
- 旧 `/materials`、`/reports`、`/interest-analysis` 列表路由在兼容期保留跳转，不作为导航入口。
- 报告详情和关系图详情原有深链接继续可用。

### 4.4 创建分析体验

自由输入仍是默认首屏，不增加强迫用户填写主体和关系的复杂表单。

- 默认 `engine_mode=auto`。
- LLM 可用时直接创建自由输入任务。
- LLM 不可用时，输入框下方显示可执行选择：“前往设置配置模型”或“切换结构化录入”。
- 选择规则引擎时自动切换结构化录入，不创建后台失败任务。
- 高级设置中可以明确选择 `auto/llm/rule`，主界面不暴露内部降级细节。

## 五、错误处理与可观察性

统一错误阶段：

- `input_validation`：创建任务前输入不满足引擎要求。
- `search`：联网检索失败，可降级。
- `generation`：LLM 或规则引擎生成失败。
- `quality_gate`：报告生成但未达到正式交付标准。
- `output`：Word、PDF 或图表导出失败。
- `versioning`：报告版本保存失败。

任务错误响应必须包含：

```json
{
  "error": {
    "code": "freeform_requires_llm",
    "message": "自由输入需要可用的语言模型，或切换为结构化录入。",
    "phase": "input_validation",
    "details": []
  }
}
```

日志不得输出密钥、完整 LLM 请求或绝对路径。用户可读错误与内部堆栈分离。

## 六、数据迁移与兼容

1. Task 表新增字段通过现有轻量迁移机制加入，旧任务字段为空时按旧数据推断。
2. 旧 `mode=rule|llm` 映射到 `requested_engine`。
3. 旧报告版本保留，不重新编号、不删除。
4. 唯一索引 `(task_id, version_no)` 保留。
5. 旧路由至少保留一个版本周期的跳转兼容。
6. 历史失败任务不自动重跑，前端继续显示原始失败原因。

## 七、测试策略

### 7.1 后端

- 生成路由矩阵逐项测试。
- 自由输入无 LLM 时确认不创建 Task。
- 自由输入规则模式确认返回 `freeform_requires_structured_input`。
- 结构化规则模式完成六阶段流程。
- 自由输入 LLM 失败时确认不伪降级。
- 结构化 LLM 失败时确认可以降级规则引擎。
- 临时 SQLite 下并发读取报告，只产生一个 v1。
- 并发保存多个修订版本，版本号唯一且仅一个 current。
- 每条硬性质量规则都有独立失败测试。
- 每条质量警告都有独立测试。
- 测试数据库与 settings 每项隔离，执行顺序不得影响结果。

### 7.2 前端

- 主导航只出现工作台、新建分析和设置。
- `/projects`、`/materials`、`/reports`、`/interest-analysis` 兼容跳转正确。
- 无 LLM 时自由输入显示设置与结构化录入选择。
- 规则模式不会发送自由输入任务。
- 质量错误与警告展示正确。
- 报告、关系图和版本保存主流程继续可用。

### 7.3 启动与端到端

- 修正启动器静态测试，使其验证 `$frontendUrl` 变量调用而非硬编码同行 URL。
- 启动后检查 `/`、`/analysis`、`/dashboard` 和 `/health`。
- 完成“自由输入 -> LLM -> 质量闸门 -> 报告 -> 关系图 -> 保存新版本”的真实冒烟测试。
- 完成“结构化输入 -> 规则引擎 -> 报告”的真实冒烟测试。

## 八、验收标准

1. 默认自由输入不再进入规则引擎失败。
2. 不满足前置条件的请求不会创建失败任务。
3. 并发打开报告不会产生 500 或重复 v1。
4. 不符合写作标准的报告不能进入正式报告版本。
5. 主导航只保留三个入口，原有深链接仍可使用。
6. 后端、内核、前端、启动器测试全部通过。
7. Next.js 生产构建通过。
8. `git diff --check` 通过。
9. 工作区变更按逻辑拆分提交，最终工作区干净。

## 九、Git 整理策略

实施分支为 `codex/stabilize-analysis-pipeline`。不把现有变更压成一个不可审查的大提交，也不推送远程。

目标提交序列：

1. `docs: define analysis routing and report quality contract`
2. `fix: stabilize freeform and structured generation routing`
3. `fix: make report version creation concurrency safe`
4. `feat: enforce executable report quality checks`
5. `refactor: consolidate workspace navigation`
6. `test: restore full pipeline regression coverage`
7. `chore: organize existing report and runtime changes`

实际整理时按文件职责和依赖关系调整顺序，但每个提交必须满足：范围明确、对应测试通过、不包含运行时数据、不混入隔壁项目资产。

## 十、明确不做

- 不把规则引擎改成事实推理器。
- 不让前端自行生成主体、关系或报告内容。
- 不为通过质量闸门而自动填充虚假章节。
- 不删除历史报告或失败任务。
- 不重写 Git 历史，不强推远程。
- 不新增登录、收费、云同步和多用户权限。
