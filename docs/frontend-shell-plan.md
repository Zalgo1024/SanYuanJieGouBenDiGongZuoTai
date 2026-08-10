# 具体构建方案：实用写报告分析引擎 + 漂亮前端

> 用户原话：「只想把工作流打包成一个有漂亮前端的、实用的写报告用的分析引擎。」
> 核心认知：**原来的 CLI 工作流已经能稳定出报告 + 利益关系网络**，后来堆的 AI/引擎/路由/后校验全是没要的复杂度，也是不稳定的根。本方案只做"壳 + 内核"，剔除其余。

## 一、已经能用的（保留，一个字不改）
- `engine.py` → `export_from_text(markdown, output_dir)`：**确定性核心**。同一份 Markdown 永远出同一份 docx/pdf/HTML。
- `parser.py` / `docx_renderer.py` / `viz_network.py`：排版 + **交互式利益关系网络 HTML**（vis.js 已内联，离线可开）。
- 证据：方星海、胖猫、甲酰胺等历史报告——结构稳定 + 带网络图。这就是产品本身。

## 二、你从没要过、现在全删的（instability 来源）
- `generation_routing.py`（rule/llm/auto 引擎模式）
- `generator.py` + `web_mode`（LLM 代写报告）
- `prompt_builder.py` / `contract.py` / `report_quality.py`（AI 护栏 / 后校验链）
- `llm_client.py` + 设置里的 LLM key 依赖
- `materials` 联网抓取管线、异步 decompose/fetch/generate 任务流水线、task_materials
- 前端里所有"引擎切换 / AI 助手 / 联网素材"开关
> 这些就是"一大堆没说过的需求和复杂条件"。从请求路径里整段移除。codex 加的 XML 控制字符清洗保留（便宜的保险）。

## 三、你要的产品：单页报告工作台
- **左栏 · 编辑器**：干净的 Markdown 编辑器（直接写/粘贴分析正文）。可选"结构化表单"模式（填 主体/利益/关系 → 自动拼合规 Markdown），给不爱写长文的人。
- **生成按钮**：「生成报告」。
- **右栏 · 结果**：Word + PDF 下载；**交互式利益关系网络 HTML 内嵌预览**（你的招牌功能，大方展示）。
- **报告库标签页**：历史报告卡片（标题 + 日期 + 下载 + 重新打开进编辑器）。

**漂亮前端方向**（ Senior Developer 视角）：克制、专业。用你的六类利益配色（物金/安绿/政紫/身份橙/制度蓝/公共青）做侧栏/页眉设计语言；清晰字号阶梯；浅/深色；留白从容。**禁** emoji 图标、禁紫粉渐变、禁 Welcome 占位——按你之前定的 UI 红线。

## 四、最小后端契约（只加必要的）
- `POST /api/render { title, markdown }` → 调 `export_from_text(markdown, output_dir="runtime/reports/{slug}")` → 返回 `{ docx, pdf, html, run_id }`
- `GET /api/reports` → 列出历史 runs
- 就这两个。无引擎、无 LLM、无联网、无异步任务。断网无 key 也能出报告。

## 五、具体构建步骤（小步，每步可验证）
1. **后端瘦身**：保留 FastAPI + `/api/render` + `/api/reports`；把第二节列出的模块从请求路径摘除（文件可暂留 `_deleted_trash` 不删，先不用）。
2. **前端：编辑器 + 生成 + 下载**（Next.js）：Markdown 编辑 → 调 `/api/render` → 显示下载链接。先跑通最小闭环，用一份示例 Markdown 验证端到端出 docx/pdf。
3. **前端：利益网络预览**：把生成的离线 HTML（vis.js 内联）用 iframe/预览面板内嵌展示。这是 wow 点。
4. **前端：报告库**：读 `runtime/reports`，卡片列表 + 下载 + 重新打开。
5. **前端打磨（漂亮）**：六利益色做设计语言、字号阶梯、浅/深色、留白。移除所有引擎/AI 开关 UI。
6. **回归测试**：固定 Markdown → 断言 docx+pdf+html 存在且 HTML 含网络图。守护稳定核心。

## 六、明确不做
- 不做 AI 报告生成（默认或可选），除非你将来主动要。
- 不做多引擎路由 / contract 后校验链 / 联网抓取管线。
- 不加任何你没提过的"需求"。

## 七、验收（你的原话落地）
打开工作台 → 写/粘贴分析 → 点生成 → 拿到**稳定的 Word + PDF + 交互式利益关系网络报告** → 在报告库看到它。这就是"有漂亮前端的实用写报告分析引擎"。

## 八、与我之前方案的区别
此前 v1/v2 仍在"怎么让 AI 写出合规报告"里绕。本方案承认：**内容由你写（或你审过的草稿），机器只排版渲染 + 画网络图**。前端是录入+触发+展示的壳，不是生成器。所有没被你点名要的 AI 复杂度一律剔除。
