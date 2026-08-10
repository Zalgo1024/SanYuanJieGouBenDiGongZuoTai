# 具体工作计划 — 把「分析skill」改造成完整自包含项目（合并归位）

> 日期：2026-07-31 晚 ｜ 依据：requirements-2026-07-31-v2.md（R4：全部落在分析skill）
> 目标：前端源码 + 后端 + 一键启动全部进「分析skill」仓库，双击 start.bat 即用，测试全绿。
> 源（只读，不动）：`Web 分析模型` ｜ 目标（改）：`三元结构理论 分析skill脚本程序`

---

## 前提事实（侦察结论，动手前已确认）

| 项 | 事实 |
|---|---|
| 前端调后端方式 | `frontend/lib/api.ts:2` BASE = `http://127.0.0.1:8000` **直连**（无同源代理问题）；next.config.mjs 无 rewrite 不需要 |
| ENGINE_DIR | `backend/app/settings.py:16` **硬编码**指向本仓库旧路径 → 归位后改为相对自身 |
| start.bat | 路径全部 `%~dp0backend` / `%~dp0frontend` 相对自身 → 复制进分析skill 直接用 |
| 孤儿 backend/ | 1347 行（db.py/routes/run_worker/translator/kernel_adapter/e2e_test/graphs_test），与 `backend/` 目标名冲突 → 须让位归档 |
| frontend/ 残留 | 仅 .next/、日志、.npm-cache、.launcher（无源码）→ 归档 |
| 密钥 | 在 `Web 分析模型/backend/.env` 与 `data/app_config.json`（LLM 配置）→ 随 backend/data 迁移，.env 不入库 |
| 沙箱坑 | 引擎重渲被 safe-delete 拦 → `GENERATED_DIR=$TEMP/xxx`；前端构建 → `NODE_OPTIONS=--use-system-ca`（真机无此问题） |

---

## 阶段 0：全量备份（防丢，先做）

```bash
src="D:/360MoveData/Users/马格斯佩斯科夫/Desktop/理论/三元结构理论/程序"
dst="D:/360MoveData/Users/马格斯佩斯科夫/Desktop/ternary-merge-backup-20260731"
cp -r "$src/Web 分析模型" "$dst/Web分析模型"    # 源仓库整体备份
cp -r "$src/三元结构理论 分析skill脚本程序" "$dst/分析skill"   # 目标仓库整体备份
```
- 验证：`du -sh "$dst"/*` 两个目录大小非 0；抽查文件数。

## 阶段 1：归档孤儿（不删，移入 _archived/）

```bash
k="D:/360MoveData/Users/马格斯佩斯科夫/Desktop/理论/三元结构理论/程序/三元结构理论 分析skill脚本程序"
mkdir -p "$k/_archived"
mv "$k/backend"  "$k/_archived/backend_orphan"     # 旧适配器让位（git 历史保留）
mv "$k/frontend" "$k/_archived/frontend_stale"     # 编译残留让位
```
- 验证：`ls "$k/_archived"` 两项存在；根目录无 backend/、frontend/。
- 注：今天早上对孤儿 backend 的入库提交 `4867b06` 保留在 git 历史，可随时找回。

## 阶段 2：复制后端（Web 分析模型/backend → 分析skill/backend）

```bash
a="D:/360MoveData/Users/马格斯佩斯科夫/Desktop/理论/三元结构理论/程序/Web 分析模型/backend"
mkdir -p "$k/backend"
cp -r "$a/app"       "$k/backend/app"          # 主包（含 routers/）
cp -r "$a/tests"     "$k/backend/tests"
cp    "$a/requirements.txt" "$k/backend/requirements.txt"
cp    "$a/pytest.ini"       "$k/backend/pytest.ini"
cp -r "$a/data"      "$k/backend/data"         # app.db + app_config.json（LLM 配置）
```
- **排除**：`generated/`（产物，重建）、`.venv`、`*.log`、`__pycache__`。
- 验证：`ls "$k/backend/app"` 含 17 项（main.py/settings.py/queue.py/engine_bridge.py/search.py/materials.py/generator.py/prompt_builder.py/contract.py/llm_client.py/rule_engine.py/models.py/db.py/routers 等）；`wc -l` 约 7000+ 行。

## 阶段 3：复制前端源码（Web 分析模型/frontend → 分析skill/frontend）

```bash
f="D:/360MoveData/Users/马格斯佩斯科夫/Desktop/理论/三元结构理论/程序/Web 分析模型/frontend"
mkdir -p "$k/frontend"
cp -r "$f/app" "$f/components" "$f/lib"  "$k/frontend/"
cp "$f/package.json" "$f/package-lock.json" "$f/tsconfig.json" "$f/next.config.mjs" \
   "$f/postcss.config.mjs" "$f/tailwind.config.ts" "$f/vitest.config.ts" "$f/vitest.setup.ts" \
   "$f/next-env.d.ts"  "$k/frontend/"
```
- **排除**：`node_modules/`、`.next/`、`.npm-cache/`、`tsconfig.tsbuildinfo`、`.env*.local`。
- 验证：`ls "$k/frontend/app"` 含 17+ 路由（analysis/cases/dashboard/report/projects/…）；`ls "$k/frontend/lib"` 含 api.ts/network.ts/rules.ts/constants.ts。

## 阶段 4：路径适配（3 处小改，不碰逻辑）

1. **`backend/app/settings.py:16`** DEFAULT_ENGINE_DIR 改为相对自身（引擎已同仓）：
   ```python
   DEFAULT_ENGINE_DIR = str(Path(__file__).resolve().parent.parent.parent)  # backend/app/settings.py → 项目根
   ```
2. **`backend/app/engine_bridge.py`**：核对 sys.path 注入逻辑——若按 ENGINE_DIR 插入则无需改（settings 已指向根）；若硬编码路径则同步改相对。
3. **`start.bat` / `stop.bat`**：从 Web 分析模型 复制，`%~dp0` 相对路径天然适配，无需改；确认 `set CODEBUDDY_SAFE_DELETE_SANDBOX=0` 等沙箱中和行保留（真机无害）。
   ```bash
   cp "$src/Web 分析模型/start.bat" "$src/Web 分析模型/stop.bat" "$k/"
   ```

## 阶段 5：依赖安装（分析skill 内新建环境）

```bash
cd "$k"
# 后端：新建 .venv，同环境装两套依赖（引擎 + backend，因 engine_bridge 同环境调内核）
"E:\Python\python.exe" -m venv .venv
".venv/Scripts/python.exe" -m pip install -r requirements.txt -r backend/requirements.txt
# 前端
cd "$k/frontend" && npm install
```
- 验证：`".venv/Scripts/python.exe" -c "import fastapi, docx, trafilatura; print('ok')"`；`npm ls --depth=0` 关键包在。

## 阶段 6：补任务恢复机制（Codex 戳中的真问题，只在 backend/app/queue.py + main.py）

- `main.py` 增加 lifespan/startup 钩子：启动时 `queue.recover_interrupted_tasks()`。
- `queue.py` 新增 `recover_interrupted_tasks()`：把 `status in (pending, running)` 的存量任务 → `status=interrupted`，前端时间线可见；可选"自动重新入队"（本轮先标记不自动重跑，避免 LLM 重复计费）。
- 验证：造一条 running 任务 → 重启后端 → `GET /api/tasks` 该任务 status=interrupted。

## 阶段 7：修测试（目标：全绿）

1. **内核 `tests/test_heading_numbering.py`（1 failed）**：跑 `pytest tests/test_heading_numbering.py -x` 看失败断言 → 定位：若是测试断言与渲染器编号逻辑不符（内核既有 bug），**先向用户确认是否动 docx_renderer.py 这一处**（红线例外，只动编号一处）；若测试自身写错则改测试。
2. **孤儿 e2e_test.py / graphs_test.py**：随 `_archived/backend_orphan/` 归档，不再进测试收集（backend/pytest.ini testpaths=tests 只收新 backend/tests）。
3. **backend/tests 全量**：`".venv/Scripts/python.exe" -m pytest backend/tests/` 应全绿（已知环境性失败 test_export.py 与本机 LibreOffice 有关，非回归，标注）。

## 阶段 8：构建 + 联调验证（沙箱内等效验证）

```bash
# 后端（沙箱：GENERATED_DIR 绕 safe-delete）
cd "$k/backend" && GENERATED_DIR="$TEMP/merge-gen" ".venv/Scripts/python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
# 前端构建（沙箱：NODE_OPTIONS 绕 preload）
cd "$k/frontend" && NODE_OPTIONS=--use-system-ca npx next build && NODE_OPTIONS=--use-system-ca npx next start -p 3000
```
- 验证清单（curl/HTTP）：
  - `GET /api/tasks` 200 且 TaskDTO 字段全
  - `POST /api/search/preview` 有 hits 或明确 degraded
  - `GET /api/cases` total=12
  - `POST /api/analyze` 5 类型（case/policy/org/opinion/combo）逐一 done，analysis_type 往返一致
  - `POST /api/reports/{id}/revise` + `POST /api/versions/{vid}/rollback` 版本 +1/回滚重渲
  - 页面 200：`/dashboard` `/analysis` `/report/[tid]` `/cases`
  - `npm run build` 零错误、`npx tsc --noEmit` 0、`npx vitest run` 全过

## 阶段 9：文档 + git 提交

- `.gitignore` 补：`.venv/`、`backend/generated/`、`backend/runtime/`、`frontend/node_modules/`、`frontend/.next/`、`.env`、`_archived/*/`（保留目录结构不追踪产物）。
- `AGENTS.md` 重写第 1-2 节：说明"本仓库 = 内核 + 应用合仓"新结构、start.bat 用法、backend/app 职责。
- git：`git add -A && git commit`（中文信息："feat: 应用层归位，分析skill 成为自包含完整项目"），报告 hash。

## 阶段 10：真机验收（用户执行）

双击 `分析skill脚本程序\start.bat` → 按 requirements v2 §五 六项验收（关键词 1 篇/链接 1 篇/5 类型/展览页改 2 次回滚/案例库/测试全绿）。

---

## 风险与待确认（≤3）

1. **内核编号测试**（阶段 7.1）：若根因在 docx_renderer.py 编号逻辑，需用户点头动内核这一处（其余内核保持零改动）。
2. **data/app_config.json 与 app.db**：带运行数据过去（历史任务/项目保留）；若想干净起步可删除让系统重建，默认保留。
3. **Web 分析模型** 归位后冻结为只读备份，不再双维护（git 历史仍在）。

## 执行方式

由主理人带队执行（文件搬运/路径适配属机械活，不需 PRD/架构评审）；阶段 6/7 如需写代码，拉工程师按此计划实现；阶段 8 联调后由 QA 复核关键验收项。
