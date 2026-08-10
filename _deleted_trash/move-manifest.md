# 搬迁清单 — Web 分析模型 → 分析skill（2026-07-31）

> 原则：Web 分析模型 **只读**（成果来源）；所有写入只发生在分析skill。
> 迁移方式：物理复制（排除构建产物/运行时数据/日志），归档旧孤儿（不删）。

## 前端：Web分析模型/frontend → 分析skill/frontend（要搬的源码）
- app/（全部页面源码）
- components/（组件）
- lib/（api.ts / network.ts / rules.ts / constants.ts 等）
- next.config.mjs / next-env.d.ts / postcss.config.mjs / tailwind.config.ts / tsconfig.json
- package.json / package-lock.json
- vitest.config.ts / vitest.setup.ts

**排除**：node_modules/、.next/、.npm-cache/、*.log、tsconfig.tsbuildinfo

## 后端：Web分析模型/backend → 分析skill/backend（要搬的源码）
- app/（主包：routers/ search.py materials.py generator.py prompt_builder.py contract.py engine_bridge.py queue.py db.py models.py settings.py main.py 等）
- tests/（test_search.py test_prompt_builder.py test_tasks_api.py 等）
- requirements.txt / pytest.ini
- data/（含 llm_settings.json 本机 LLM 配置 + app.db 数据；搬但 gitignore 不入库）

**排除**：.venv/、generated/、*.log、concurrency_check.py（开发临时脚本）

## 启动脚本
- start.bat → 分析skill/start.bat（%~dp0 自适应目录，内容基本不用改；保留沙箱绕行变量，真机无害）

## 配置改动（搬入后）
- 分析skill/backend/app/settings.py：DEFAULT_ENGINE_DIR 由硬编码绝对路径 → 相对自身 `Path(__file__).resolve().parents[2]`（即分析skill 项目根，内核就在同仓）
- CORS：保持 127.0.0.1:3000 / localhost:3000

## 归档（分析skill 内，不删）
- backend/（旧孤儿 1347 行）→ _archived/backend_orphan/
- frontend/（.next 残留快照）→ _archived/frontend_stale/
- _archived/ 加入 .gitignore
