"""系统级接口：健康检查。"""
import logging

from fastapi import APIRouter

from app.llm_settings_store import public_settings
from app.settings import settings

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
def health():
    pdf = {}
    try:
        from app.engine_bridge import diagnose_pdf

        pdf = diagnose_pdf()
    except Exception:  # noqa: BLE001
        logger.warning("diagnose_pdf 失败（健康检查降级）", exc_info=True)
        pdf = {"error": "diagnose_failed"}
    return {
        "status": "ok",
        "engine_dir": settings.engine_dir,
        "llm_provider": settings.llm_provider,
        "use_real_llm": settings.use_real_llm,
        "generated_dir": settings.generated_dir,
        "host": settings.host,
        "db": "sqlite (backend/data/app.db, WAL)",
        "pdf_converters": pdf,
        "llm_settings": public_settings(),  # 脱敏概览（不含明文 key）
    }
