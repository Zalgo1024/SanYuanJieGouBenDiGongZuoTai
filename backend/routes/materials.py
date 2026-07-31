"""素材端点：GET/POST /api/projects/{id}/materials。"""
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

import db

router = APIRouter(prefix="/api/projects", tags=["materials"])


class MaterialCreate(BaseModel):
    name: str = Field(..., min_length=1)
    url: str = Field(..., min_length=1)
    note: Optional[str] = None


def _serialize_material(m: dict) -> dict:
    return {
        "id": m["id"],
        "project_id": m["project_id"],
        "name": m["name"],
        "url": m["url"],
        "note": m.get("note"),
        "created_at": m["created_at"],
    }


@router.get("/{pid}/materials")
def list_materials(pid: int) -> list[dict]:
    if not db.get_project(pid):
        raise HTTPException(status_code=404, detail="项目不存在")
    return [_serialize_material(m) for m in db.list_materials(pid)]


@router.post("/{pid}/materials", status_code=201)
def add_material(pid: int, payload: MaterialCreate) -> dict:
    if not db.get_project(pid):
        raise HTTPException(status_code=404, detail="项目不存在")
    m = db.add_material(pid, payload.name, payload.url, note=payload.note)
    return _serialize_material(m)
