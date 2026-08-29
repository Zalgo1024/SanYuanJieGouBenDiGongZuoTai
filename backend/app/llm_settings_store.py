"""服务端 LLM 设置存储。

浏览器工作台使用 profile_id 隔离 BYOK 配置；任务只保存 profile_id，密钥只落在
backend/data/llm_profiles（已 gitignore），且读取接口绝不返回明文。旧的单机全局配置
与 .env 仅保留给内部兼容入口，公共分析路由不会自动使用它们。
"""
import hashlib
import json
from pathlib import Path

from app.settings import settings

_STORE_PATH = Path(__file__).resolve().parent.parent / "data" / "llm_settings.json"
_PROFILES_DIR = Path(__file__).resolve().parent.parent / "data" / "llm_profiles"
_MASK = "****"

# 支持的接口类型（全部走 OpenAI 兼容协议，provider 仅决定预设 base_url 与默认模型）。
PROVIDERS = {
    "deepseek",      # DeepSeek
    "openai",        # OpenAI
    "zhipu",         # 智谱 GLM
    "qwen",          # 通义千问（DashScope 兼容模式）
    "kimi",          # Kimi（月之暗面）
    "siliconflow",   # 硅基流动
    "openrouter",    # OpenRouter
    "ollama",        # 本地 Ollama
    "compatible",    # 自定义 OpenAI 兼容端点
}


def public_mode() -> bool:
    """公共部署模式：开启后服务器密钥（.env / 全局 store）一律不再回退使用。"""
    return bool(getattr(settings, "public_mode", False))


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
            return json.load(f)
    except Exception:
        return {}


def _profile_path(profile_id: str) -> Path:
    """用标识摘要作为文件名，避免浏览器输入参与路径拼接。"""
    value = (profile_id or "").strip()
    if len(value) < 20 or len(value) > 160:
        raise ValueError("无效的 AI 连接标识")
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()
    return _PROFILES_DIR / f"{digest}.json"


def load_profile_settings(profile_id: str) -> dict:
    path = _profile_path(profile_id)
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _number(value):
    try:
        return float(value) if value not in (None, "") else None
    except (TypeError, ValueError):
        return None


def save_profile_settings(profile_id: str, data: dict) -> dict:
    """保存一个浏览器的 BYOK 配置；空 key 表示保留原密钥。"""
    path = _profile_path(profile_id)
    current = load_profile_settings(profile_id)
    supplied_key = (data.get("api_key") or "").strip()
    provider = (data.get("provider") or current.get("provider") or "deepseek").strip()
    if provider not in PROVIDERS:
        provider = "compatible"
    clean = {
        "provider": provider,
        "api_key": supplied_key or (current.get("api_key") or "").strip(),
        "base_url": (data.get("base_url") or current.get("base_url") or "").strip(),
        "model": (data.get("model") or current.get("model") or "").strip(),
        "temperature": _number(data.get("temperature"))
        if data.get("temperature") is not None
        else current.get("temperature"),
        "prompt_version": (
            data.get("prompt_version") or current.get("prompt_version") or ""
        ).strip(),
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(clean, ensure_ascii=False, indent=2), encoding="utf-8")
    return public_profile_settings(profile_id)


def public_profile_settings(profile_id: str) -> dict:
    """只返回可展示字段；API Key 永不从后端读回浏览器。"""
    data = load_profile_settings(profile_id)
    return {
        "has_settings": bool(data),
        "has_key": bool((data.get("api_key") or "").strip()),
        "provider": data.get("provider") or "deepseek",
        "model": data.get("model") or "",
        "base_url": data.get("base_url") or "",
        "temperature": data.get("temperature"),
        "prompt_version": data.get("prompt_version") or "",
    }


def delete_profile_settings(profile_id: str) -> dict:
    path = _profile_path(profile_id)
    path.unlink(missing_ok=True)
    return public_profile_settings(profile_id)


def save_settings(data: dict) -> dict:
    """保存用户 LLM 设置（含 api_key）。返回脱敏后的概览。"""
    _STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    # 仅保留白名单字段，避免任意字段落盘
    clean = {
        "provider": (data.get("provider") or "deepseek").strip() or "deepseek",
        "api_key": (data.get("api_key") or "").strip(),
        "base_url": (data.get("base_url") or "").strip(),
        "model": (data.get("model") or "").strip(),
        "temperature": _number(data.get("temperature")),
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
    req = request_cfg or {}
    profile_id = (req.get("profile_id") or "").strip()
    if profile_id:
        profile = load_profile_settings(profile_id)
        provider = (profile.get("provider") or "deepseek").strip() or "deepseek"
        api_key = (profile.get("api_key") or "").strip()
        base_url = (profile.get("base_url") or "").strip() or None
        model = (
            (req.get("model") or "").strip()
            or (profile.get("model") or "").strip()
            or ("deepseek-chat" if provider == "deepseek" else "gpt-4o")
        )
        try:
            temp = float(req["temperature"]) if req.get("temperature") is not None else None
        except (TypeError, ValueError):
            temp = None
        if temp is None:
            temp = profile.get("temperature") if profile.get("temperature") is not None else 0.7
        from app.prompt_builder import PROMPT_VERSION

        prompt_version = (
            (req.get("prompt_version") or "").strip()
            or (profile.get("prompt_version") or "").strip()
            or PROMPT_VERSION
        )
        source = "profile" if api_key else "profile_missing"
        if not api_key:
            # BYOK profile 未配置密钥时，回退服务器 .env / 旧单机 store 的密钥，
            # 恢复「关键词输入 → LLM 拆解 → 联网搜索 → 报告」工作流（本机私有部署）。
            # 显式保存的浏览器 BYOK 仍优先；仅 profile_missing 时兜底。
            # 公共部署模式（PUBLIC_MODE=1）下不回退：访客必须自带密钥。
            if public_mode():
                return {
                    "api_key": "",
                    "base_url": base_url,
                    "model": model,
                    "temperature": temp,
                    "prompt_version": prompt_version,
                    "source": "profile_missing",
                }
            s = load_settings()
            store_key = (s.get("api_key") or "").strip()
            env_key = (
                settings.deepseek_api_key
                if provider == "deepseek"
                else settings.openai_api_key
            )
            if store_key or env_key:
                api_key = store_key or env_key
                source = "store" if store_key else "env"
                # profile 未配置的字段一并回退 store / .env 默认
                if not base_url:
                    env_base = (
                        settings.deepseek_base_url
                        if provider == "deepseek"
                        else settings.openai_base_url
                    )
                    base_url = (s.get("base_url") or "").strip() or env_base or None
                if not (req.get("model") or "").strip() and not (
                    profile.get("model") or ""
                ).strip():
                    model = (s.get("model") or "").strip() or (
                        settings.deepseek_model
                        if provider == "deepseek"
                        else settings.openai_model
                    )
                if req.get("temperature") is None and profile.get("temperature") is None:
                    temp = s.get("temperature") if s.get("temperature") is not None else 0.7
        return {
            "api_key": api_key,
            "base_url": base_url,
            "model": model,
            "temperature": temp,
            "prompt_version": prompt_version,
            "source": source,
        }

    s = load_settings()
    provider = (s.get("provider") or "deepseek").strip() or "deepseek"
    store_key = "" if public_mode() else (s.get("api_key") or "").strip()
    env_key = (
        ""
        if public_mode()
        else (
            settings.deepseek_api_key
            if provider == "deepseek"
            else settings.openai_api_key
        )
    )
    api_key = store_key or env_key
    source = "store" if store_key else ("env" if env_key else "none")

    # base_url：store > env(按 provider) > None
    env_base = (
        settings.deepseek_base_url if provider == "deepseek" else settings.openai_base_url
    )
    base_url = (s.get("base_url") or "").strip() or env_base or None

    # model：请求 > store > env(按 provider) > 默认
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
