"""服务端 LLM 设置存储 — 保证 API Key 永不写入前端。

设计（满足「API Key 不写入前端」）：
- 用户在前端设置面板输入一次 key，存到 backend/data/llm_settings.json（已 gitignore）；
- GET /api/settings/llm 只返回脱敏概览（has_key / 模型 / 脱敏地址 / 提示词版本），
  绝不返回明文 key；前端无法读取或持有密钥。
- 后续 /api/analyze 的 llm_config 仅携带模型/温度/提示词版本，**不含 api_key**；
  真正调 LLM 时由 resolve_config() 在后端合并：
    1) 本文件存储的用户设置（store api_key）
    2) backend/.env 的环境变量（DEEPSEEK_API_KEY / OPENAI_API_KEY）
    3) 都没有 → 回退 Mock（不调用真实 LLM）
"""
from pathlib import Path

from app.settings import settings

_STORE_PATH = Path(__file__).resolve().parent.parent / "data" / "llm_settings.json"
_MASK = "****"


def _mask_key(key: str) -> str:
    if not key:
        return ""
    if len(key) <= 8:
        return _MASK
    return key[:4] + _MASK + key[-4:]


def load_settings() -> dict:
    if not _STORE_PATH.exists():
        return {}
    try:
        with open(_STORE_PATH, encoding="utf-8") as f:
            return __import__("json").load(f)
    except Exception:
        return {}


def save_settings(data: dict) -> dict:
    """保存用户 LLM 设置（含 api_key）。返回脱敏后的概览。"""
    _STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    # 仅保留白名单字段，避免任意字段落盘
    def _num(v):
        try:
            return float(v) if v not in (None, "") else None
        except (TypeError, ValueError):
            return None

    clean = {
        "provider": (data.get("provider") or "deepseek").strip() or "deepseek",
        "api_key": (data.get("api_key") or "").strip(),
        "base_url": (data.get("base_url") or "").strip(),
        "model": (data.get("model") or "").strip(),
        "temperature": _num(data.get("temperature")),
        "prompt_version": (data.get("prompt_version") or "").strip(),
    }
    with open(_STORE_PATH, "w", encoding="utf-8") as f:
        __import__("json").dump(clean, f, ensure_ascii=False, indent=2)
    return public_settings()


def public_settings() -> dict:
    """脱敏概览，给前端展示用（绝不返回明文 key）。

    注意：密钥来源有两条——用户通过 UI 存入的 data/llm_settings.json（store），
    以及 backend/.env 的环境变量（DEEPSEEK_API_KEY / OPENAI_API_KEY）。
    has_key 必须同时反映两者（resolve_config 也是这么合并的），否则即便 .env 已配好
    key，前端探测仍会得到 has_key=false，从而错误地退回规则引擎。
    """
    import json

    s = load_settings()
    provider = (s.get("provider") or "deepseek").strip() or "deepseek"
    env_key = (
        settings.deepseek_api_key if provider == "deepseek" else settings.openai_api_key
    )
    has_key = bool(s.get("api_key")) or bool(env_key)
    return {
        "has_settings": bool(s),
        "has_key": has_key,
        "provider": provider,
        "model": s.get("model") or "",
        "base_url_masked": _mask_key(s.get("base_url", "")) if s.get("base_url") else "",
        "prompt_version": s.get("prompt_version") or "",
        "temperature": s.get("temperature"),
    }


def resolve_config(request_cfg: dict | None = None) -> dict:
    """把每请求配置（不含量钥）与后端存储/环境变量合并，得到完整客户端参数。

    返回 {api_key, base_url, model, temperature, prompt_version, source}。
    source ∈ {store, env, none}，标记 key 的真实来源，便于诊断。
    """
    import json

    s = load_settings()
    provider = (s.get("provider") or "deepseek").strip() or "deepseek"
    store_key = (s.get("api_key") or "").strip()
    env_key = (
        settings.deepseek_api_key if provider == "deepseek" else settings.openai_api_key
    )
    api_key = store_key or env_key
    source = "store" if store_key else ("env" if env_key else "none")

    # base_url：store > env(按 provider) > None
    env_base = (
        settings.deepseek_base_url if provider == "deepseek" else settings.openai_base_url
    )
    base_url = (s.get("base_url") or "").strip() or env_base or None

    # model：请求 > store > env(按 provider) > 默认
    req = request_cfg or {}
    model = (
        (req.get("model") or "").strip()
        or (s.get("model") or "").strip()
        or (settings.deepseek_model if provider == "deepseek" else settings.openai_model)
    )

    # temperature：请求 > store > 默认 0.7
    try:
        temp = float(req["temperature"]) if req.get("temperature") is not None else None
    except (TypeError, ValueError):
        temp = None
    if temp is None:
        temp = s.get("temperature") if s.get("temperature") is not None else 0.7

    # prompt_version：请求 > store > 默认（由 prompt_builder 注入）
    from app.prompt_builder import PROMPT_VERSION

    prompt_version = (
        (req.get("prompt_version") or "").strip()
        or (s.get("prompt_version") or "").strip()
        or PROMPT_VERSION
    )
    return {
        "api_key": api_key,
        "base_url": base_url,
        "model": model,
        "temperature": temp,
        "prompt_version": prompt_version,
        "source": source,
    }
