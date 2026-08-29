"""Project monitoring endpoints for the local research workbench."""

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.db import SessionLocal
from app.models import ResearchMonitor
from app.monitoring import MonitorBusyError, configure_monitor, monitor_dict, trigger_monitor

router = APIRouter()


class MonitorUpdate(BaseModel):
    enabled: bool
    interval_hours: int = 24
    seed_task_id: str | None = None


@router.get("/api/projects/{project_id}/monitor")
def get_monitor(project_id: str):
    with SessionLocal() as db:
        monitor = db.query(ResearchMonitor).filter(ResearchMonitor.project_id == project_id).first()
        return monitor_dict(monitor, project_id)


@router.put("/api/projects/{project_id}/monitor")
def put_monitor(project_id: str, req: MonitorUpdate):
    try:
        result = configure_monitor(
            project_id,
            enabled=req.enabled,
            interval_hours=req.interval_hours,
            seed_task_id=req.seed_task_id,
        )
    except ValueError as exc:
        return JSONResponse({"error": "monitor_seed_unavailable", "message": str(exc)}, status_code=422)
    return result if result is not None else {"status": "not_found"}


@router.post("/api/projects/{project_id}/monitor/run")
def run_monitor(project_id: str):
    try:
        task_id = trigger_monitor(project_id)
    except MonitorBusyError as exc:
        return JSONResponse({"error": "monitor_busy", "message": str(exc)}, status_code=409)
    except ValueError as exc:
        return JSONResponse({"error": "monitor_seed_unavailable", "message": str(exc)}, status_code=422)
    if task_id is None:
        return {"status": "not_found"}
    return {"task_id": task_id}
