"""FastAPI 主入口 — 三元结构理论本地分析工作台后端。

启动：
    cd backend
    .venv/Scripts/python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from settings import CORS_ALLOW_ORIGINS, HOST, PORT
from db import init_db
from routes import projects, runs, reports, materials

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("backend")


def create_app() -> FastAPI:
    app = FastAPI(
        title="三元结构理论本地分析工作台",
        version="1.0.0",
        description="FastAPI 后端适配层：把 Codex 的 Next.js 前端接到现有 Python 内核上。",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ALLOW_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 注册 9 个端点 + 文件下载
    app.include_router(projects.router)
    app.include_router(materials.router)
    app.include_router(runs.router)
    app.include_router(reports.router)

    @app.get("/api/health", tags=["meta"])
    def health() -> dict:
        return {"status": "ok"}

    @app.get("/", tags=["meta"])
    def root() -> dict:
        return {"name": "三元结构理论本地分析工作台后端", "version": "1.0.0"}

    # research / LLM 端点留桩（MVP 不实现）
    @app.post("/api/research", status_code=501, tags=["stub"])
    def research_stub() -> dict:
        return {"detail": "research 端点未在 MVP 实现"}

    @app.post("/api/llm", status_code=501, tags=["stub"])
    def llm_stub() -> dict:
        return {"detail": "llm 端点未在 MVP 实现"}

    return app


app = create_app()


@app.on_event("startup")
def _startup() -> None:
    init_db()
    logger.info("SQLite 已初始化：%s", "runtime/app.db")
    logger.info("CORS 放行：%s", CORS_ALLOW_ORIGINS)
    logger.info("服务即将监听 http://%s:%d", HOST, PORT)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=False)
