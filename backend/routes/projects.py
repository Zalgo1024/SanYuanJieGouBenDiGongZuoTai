"""项目端点：GET /api/projects、POST /api/projects、GET /api/projects/{id}。"""
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

import db

router = APIRouter(prefix="/api", tags=["projects"])


class ProjectCreate(BaseModel):
    title: str = Field(..., min_length=1)
    type: str = Field("case")  # case / policy / opinion / org
    tone: str = Field("neutral")  # neutral / provocative
    description: Optional[str] = None


def _serialize_project(p: dict) -> dict:
    """对齐前端 ProjectView 字段名。"""
    return {
        "id": p["id"],
        "title": p["title"],
        "type": p.get("type", "case"),
        "tone": p.get("tone", "neutral"),
        "status": p.get("status", "draft"),
        "description": p.get("description"),
        "cover_graph_url": None,  # MVP：项目级封面图暂不维护
        "created_at": p["created_at"],
        "updated_at": p["updated_at"],
    }


@router.get("/projects")
def list_projects() -> list[dict]:
    return [_serialize_project(p) for p in db.list_projects()]


@router.post("/projects", status_code=201)
def create_project(payload: ProjectCreate) -> dict:
    p = db.create_project(
        payload.title,
        type_=payload.type,
        tone=payload.tone,
        description=payload.description,
    )
    return _serialize_project(p)


@router.get("/projects/{pid}")
def get_project(pid: int) -> dict:
    p = db.get_project(pid)
    if not p:
        raise HTTPException(status_code=404, detail="项目不存在")
    proj = _serialize_project(p)
    # 详情附带最近 runs 与 materials 摘要（前端 manage 页用）
    proj["runs"] = [
        {
            "id": r["id"],
            "title": r["title"],
            "tone": r["tone"],
            "status": r["status"],
            "error": r.get("error"),
            "report_id": r.get("report_id"),
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
        }
        for r in db.list_runs_for_project(pid)
    ]
    return proj
