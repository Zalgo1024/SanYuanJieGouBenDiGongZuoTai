"""运行端点：POST /api/projects/{id}/generate、GET /api/runs/{run_id}。"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

import db
from run_worker import start_run_worker

router = APIRouter(prefix="/api", tags=["runs"])


class GenerateRequest(BaseModel):
    title: str = Field(..., min_length=1)
    markdown: str = Field(..., min_length=1)
    tone: str = Field("neutral")  # neutral / provocative


@router.post("/projects/{pid}/generate", status_code=202)
def generate(pid: int, payload: GenerateRequest) -> dict:
    project = db.get_project(pid)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    # 建一条 pending run 记录
    run = db.create_run(pid, payload.title, tone=payload.tone)
    run_id = run["id"]

    # 启动后台 worker
    start_run_worker(
        run_id=run_id,
        project_id=pid,
        title=payload.title,
        body=payload.markdown,
        tone=payload.tone,
    )

    return {"run_id": run_id, "status": "queued"}


@router.get("/runs/{run_id}")
def get_run(run_id: int) -> dict:
    run = db.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="运行不存在")
    # 对齐前端 RunView 字段
    return {
        "id": run["id"],
        "project_id": run["project_id"],
        "title": run["title"],
        "tone": run["tone"],
        "status": run["status"],
        "log": run["log"],
        "error": run.get("error"),
        "report_id": run.get("report_id"),
        "created_at": run["created_at"],
        "updated_at": run["updated_at"],
    }
