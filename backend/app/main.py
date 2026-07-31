"""FastAPI 应用 — 后端（内部使用，仅监听 127.0.0.1）。

启动（在 backend/ 目录下，已配置 .env）：
    python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

路由已拆分为 app/routers/ 下的模块化路由（analyze / settings / projects /
reports / materials / system）。本文件只负责装配 app、CORS、startup 与统一异常处理。

安全说明：本服务仅供本地前端联调，仅监听 127.0.0.1，不对外开放；无公网鉴权。
认证采用「本地单用户模式」：前端用本地身份标识进入工作台（数据仅存本机及本地后端），
会员系统（注册/多用户隔离）按用户要求仅预留、未启用（见 app/models.py）。
"""
import logging

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app import queue as taskq
from app.db import init_db, seed_projects
from app.routers import analyze, cases, materials, projects, reports, search, settings, system, tasks

logger = logging.getLogger("app")

app = FastAPI(title="三元结构分析平台 - 后端（内部使用）")

# 仅允许本地前端跨域，不外放。localhost 与 127.0.0.1 都放行
# （预览面板可能以 127.0.0.1:3000 访问）。
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================ 统一异常处理（P1·异常处理不统一） ============================
# 未捕获异常统一返回 JSON 错误信封（不泄露堆栈），并保持 HTTPException /
# 请求校验错误的状态码可读。注意：显式返回 {"status": "not_found"}（HTTP 200）的
# 接口属既有契约，不会被此处理器拦截（它们不是异常）。


@app.exception_handler(StarletteHTTPException)
async def _http_exception_handler(request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": "http_error", "message": str(exc.detail)},
    )


@app.exception_handler(RequestValidationError)
async def _validation_exception_handler(request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"error": "validation_error", "detail": exc.errors()},
    )


@app.exception_handler(Exception)
async def _unhandled_exception_handler(request, exc: Exception):
    logger.exception("未捕获异常：%s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"error": "internal_error", "message": "服务器内部错误，请稍后重试。"},
    )


# ============================ 路由装配 ============================

app.include_router(system.router)
app.include_router(settings.router)
app.include_router(analyze.router)
app.include_router(projects.router)
app.include_router(reports.router)
app.include_router(materials.router)
app.include_router(tasks.router)
app.include_router(search.router)
app.include_router(cases.router)


@app.on_event("startup")
async def _startup() -> None:
    # 1) 建表  2) 种子项目  3) 恢复中断任务  4) 启动工人池
    init_db()
    seed_projects()
    taskq.recover_interrupted()
    taskq.start_workers()
