# 证据—判断账本实施计划

> 本计划只实施第一条 P0 纵切，不重写报告内核、不增加一级菜单、不修改 `theory_config.json`。

**目标：** 让一次分析从来源材料开始，生成经过确定性校验的研究账本，并随报告版本通过 API 送达报告页与关系图谱页。

**架构：** 在现有 Markdown 生成之后增加结构化研究提取器；使用 Pydantic 契约和纯函数校验；当前账本保存于 `Task.result`，版本快照保存于 `ReportVersion`；前端按版本读取并提供判断与关系边的证据检查。

## 一、建立后端研究契约与校验器

**文件：**
- 新建 `backend/app/research_ledger.py`
- 新建 `backend/tests/test_research_ledger.py`

1. 先写失败测试，覆盖合法账本、悬空证据 ID、无证据事实降级、同源证据去重、关系边降级和指标计算。
2. 实现 Pydantic 模型、JSON 提取、规范化和降级账本。
3. 运行 `pytest backend/tests/test_research_ledger.py -q`。

## 二、把账本接入报告生成结果

**文件：**
- 修改 `backend/app/generator.py`
- 修改或新建 `backend/tests/test_generator_research.py`

1. 先写失败测试，固定 LLM 返回和材料清单，断言最终结果含 `research`。
2. 增加结构化提取提示和一次 JSON 修复机会；规则模式走确定性降级提取。
3. 保证提取失败不影响原报告导出。
4. 运行相关生成器测试。

## 三、让研究快照与报告版本一致

**文件：**
- 修改 `backend/app/models.py`
- 修改 `backend/app/db.py`
- 修改 `backend/app/report_version_service.py`
- 修改 `backend/app/routers/reports.py`
- 修改 `backend/tests/test_report_version_service.py` 与报告路由测试

1. 先写失败测试，验证原始版本复制当前账本、修订版标记 `stale`、并发版本号不回归、回滚恢复对应研究快照。
2. 添加 `research_snapshot` 和 `research_status` 的幂等 SQLite 迁移。
3. 扩展版本服务参数，但保持旧调用兼容。
4. 新增研究读取接口并在版本详情中返回研究快照。
5. 运行版本与路由测试。

## 四、接入前端领域模型和 API

**文件：**
- 修改 `frontend/src/lib/domain.ts`
- 修改 `frontend/src/lib/report-delivery.ts`
- 修改 `frontend/src/lib/workspace-api.ts`
- 修改对应 Vitest 测试

1. 先写映射失败测试，覆盖完整账本、历史版本和无账本兼容。
2. 增加 ResearchSource、ResearchClaim、ResearchRelation、ResearchGap、ResearchBundle 类型。
3. 报告读取与版本切换都携带对应研究快照。
4. 运行前端数据层测试。

## 五、实现报告页判断溯源

**文件：**
- 新建 `frontend/src/components/research-ledger.tsx`
- 修改 `frontend/src/components/report-reader.tsx`
- 修改前端样式文件
- 新建组件测试

1. 先写组件测试，覆盖关键判断列表、置信度、不确定性、来源摘录、反对证据、过期快照和资料缺口。
2. 实现紧凑判断区与证据详情面板，保持现有布局和视觉语言。
3. 历史版本切换时同步切换研究快照。
4. 运行组件测试。

## 六、实现关系边证据解释

**文件：**
- 修改 `frontend/src/lib/report-graph.ts`
- 修改 `frontend/src/components/analysis-network.tsx`
- 修改对应测试

1. 先写失败测试，覆盖 relation ID / claim ID 匹配和旧报告回退。
2. 扩展 DIAGRAM 可选元数据解析，不破坏旧格式。
3. 选中关系边时显示证据、置信度、状态和不确定性；没有边级绑定时保留报告级来源提示。
4. 运行图谱相关测试。

## 七、全量验证

1. 运行后端新增测试和受影响核心测试。
2. 运行前端 Vitest。
3. 运行前端 build。
4. 运行 `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-all.ps1`。
5. 启动本地工作台，在报告页和关系图谱页做真实浏览器检查，确认桌面布局、历史版本和无账本历史报告均可用。

## 八、工作区约束

当前仓库尚无提交且已有大量暂存文件。本轮不执行提交、重置或清理暂存区，只添加和修改本计划明确列出的文件；验证结果与未完成项在最终汇报中如实说明。
