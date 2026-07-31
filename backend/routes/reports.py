"""报告端点：GET /api/reports/{id}、GET /api/reports/{id}/graphs、/files/{rid}/{filename}。"""
import os
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

import db
from settings import PROJECTS_DIR

router = APIRouter(prefix="/api", tags=["reports"])


def _serialize_report(r: dict) -> dict:
    """对齐前端 ReportView 字段。"""
    artifacts = r.get("artifacts") or {}
    return {
        "id": r["id"],
        "run_id": r["run_id"],
        "project_id": r["project_id"],
        "title": r["title"],
        "tone": r["tone"],
        "pdf_ok": r["pdf_ok"],
        "sections": r.get("sections") or [],
        "artifacts": artifacts,
        "cover_graph_url": r.get("cover_graph_url"),
        "created_at": r["created_at"],
        "updated_at": r["updated_at"],
    }


@router.get("/reports/{report_id}")
def get_report(report_id: int) -> dict:
    r = db.get_report(report_id)
    if not r:
        raise HTTPException(status_code=404, detail="报告不存在")
    return _serialize_report(r)


@router.get("/reports/{report_id}/graphs")
def get_graphs(report_id: int) -> dict:
    r = db.get_report(report_id)
    if not r:
        raise HTTPException(status_code=404, detail="报告不存在")
    graphs = r.get("graphs") or {}
    # 保证三个键都存在（缺失补 null）
    return {
        "network": graphs.get("network"),
        "org": graphs.get("org"),
        "flow": graphs.get("flow"),
    }


# ── 文件下载 ───────────────────────────────────────────────
# /files/{run_id}/{filename} → 返回 FileResponse
# 内核产物落在 runtime/projects/{pid}/runs/{rid}/{safe_name}_{rid}/ 下
# 我们遍历该 run 目录树找到匹配 filename 的文件


def _find_run_file(run_id: int, filename: str) -> Optional[str]:
    """在 runtime/projects/*/runs/{run_id}/ 下递归找 filename。"""
    # run_id 对应的 run 目录可能在任意 project 下，扫一遍
    projects_root = str(PROJECTS_DIR)
    if not os.path.isdir(projects_root):
        return None
    for pid_name in os.listdir(projects_root):
        run_dir = os.path.join(projects_root, pid_name, "runs", str(run_id))
        if not os.path.isdir(run_dir):
            continue
        # 内核在 run_dir 下建 {safe_name}_{run_id}/ 子目录
        for root, _dirs, files in os.walk(run_dir):
            if filename in files:
                return os.path.join(root, filename)
    return None


@router.get("/files/{run_id}/{filename:path}")
def download_file(run_id: int, filename: str) -> Any:
    # 防路径穿越：filename 不能含 .. 
    if ".." in filename:
        raise HTTPException(status_code=400, detail="非法文件名")
    # Starlette 已对 path 参数做 URL 解码
    path = _find_run_file(run_id, filename)
    if not path or not os.path.isfile(path):
        raise HTTPException(status_code=404, detail=f"文件不存在: {filename}")
    return FileResponse(path)
