"""设置类接口：LLM 设置 / 搜索设置 / 通用应用配置。

安全铁律：密钥只在后端（data/llm_settings.json 或 .env），前端永不持有明文 key。
"""
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config_store import load_app_config, save_app_config
from app.llm_settings_store import (
    delete_profile_settings,
    public_profile_settings,
    public_settings,
    save_profile_settings,
)
from app.settings import settings

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================ LLM 设置（密钥只在后端，永不写入前端） ============================


class LlmSettingsIn(BaseModel):
    provider: str | None = None  # deepseek | openai
    api_key: str | None = None  # 仅在保存时传入，GET 不返回明文
    base_url: str | None = None
    model: str | None = None
    temperature: float | None = None
    prompt_version: str | None = None


@router.get("/api/settings/llm")
def get_llm_settings():
    """脱敏概览：是否配置、模型、脱敏地址、提示词版本。绝不返回明文 key。"""
    return public_settings()


@router.post("/api/settings/llm")
def post_llm_settings(req: LlmSettingsIn):
    """旧的全局写入口已停用，避免公共用户覆盖服务器管理员配置。"""
    raise HTTPException(
        status_code=410,
        detail="全局 AI 配置入口已停用，请使用当前浏览器的个人 AI 连接。",
    )


@router.get("/api/settings/llm/profiles/{profile_id}")
def get_llm_profile(profile_id: str):
    """读取当前浏览器连接的脱敏状态，不读取服务器管理员密钥。"""
    try:
        return public_profile_settings(profile_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/api/settings/llm/profiles/{profile_id}")
def post_llm_profile(profile_id: str, req: LlmSettingsIn):
    """保存浏览器级 BYOK 配置；空 api_key 不会覆盖已保存密钥。"""
    try:
        return save_profile_settings(profile_id, req.model_dump(exclude_none=True))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.delete("/api/settings/llm/profiles/{profile_id}")
def delete_llm_profile(profile_id: str):
    """彻底移除当前浏览器连接及其 API Key。"""
    try:
        return delete_profile_settings(profile_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


# ============================ 搜索设置（可选插件 / 可灰度） ============================


@router.get("/api/settings/search")
def get_search_settings():
    """搜索特性运行态（脱敏）：是否对用户开放、是否已配置 API、当前提供方。

    - available：灰度总开关（SEARCH_ENABLED != off）。
    - configured：是否已配置搜索 API Key（实际能发起搜索的前提）。
    - provider：当前提供方（serper / tavily / mock）。
    前端据此决定是否展示「联网搜索」开关及提示「需配置 API」。
    """
    return {
        "available": settings.search_available,
        "configured": settings.search_configured,
        "provider": settings.search_provider,
        "enabled_mode": settings.search_enabled,
    }


# ============================ 通用应用配置（设置页：开关/偏好落后端，不再是纯前端） ============================


class AppConfigIn(BaseModel):
    engine_mode: str | None = None
    default_analysis_level: str | None = None
    default_weight_system: str | None = None
    default_depth: str | None = None
    report_language: str | None = None
    chart_palette: str | None = None
    notify_on_done: bool | None = None
    weekly_digest: bool | None = None


@router.get("/api/settings/config")
def get_app_config():
    """返回合并默认值后的完整应用配置（前端设置页初始化用）。"""
    return load_app_config()


@router.post("/api/settings/config")
def post_app_config(req: AppConfigIn):
    """部分更新应用配置（仅白名单字段落盘），返回更新后的完整配置。"""
    return save_app_config(req.model_dump(exclude_none=True))
