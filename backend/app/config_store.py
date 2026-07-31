"""服务端通用配置存储 — 让前端的「设置」真正落到后端，而非仅存浏览器 localStorage。

与 llm_settings_store 同构，但保存的是非机密的「应用偏好」：
- engine_mode：默认分析引擎（rule 离线 / llm 增强）
- default_analysis_level / default_weight_system / default_depth：分析默认偏好
- report_language / chart_palette：展示偏好
- notify_on_done / weekly_digest：通知开关

存储位置：backend/data/app_config.json（已 gitignore）。GET 返回合并默认值后的完整配置；
POST 仅合并传入字段（部分更新），缺省字段保持原值。
"""
from pathlib import Path

_STORE_PATH = Path(__file__).resolve().parent.parent / "data" / "app_config.json"

# 字段白名单 + 默认值（任何未知字段都不会落盘）
DEFAULTS = {
    "engine_mode": "rule",            # rule | llm
    "default_analysis_level": "事件",  # 组织 | 事件 | 政策
    "default_weight_system": "中国",   # 中国 | 通用
    "default_depth": "标准",           # 快速 | 标准 | 深入
    "report_language": "简体中文",     # 简体中文 | English
    "chart_palette": "standard",       # standard | mono
    "notify_on_done": True,            # 报告生成完成通知
    "weekly_digest": False,            # 每周利益格局摘要
}

_BOOL_KEYS = {"notify_on_done", "weekly_digest"}


def load_app_config() -> dict:
    if not _STORE_PATH.exists():
        return dict(DEFAULTS)
    try:
        import json

        with open(_STORE_PATH, encoding="utf-8") as f:
            stored = json.load(f)
    except Exception:
        return dict(DEFAULTS)
    # 合并默认值，保证返回字段齐全、类型正确
    merged = dict(DEFAULTS)
    if isinstance(stored, dict):
        for k, v in stored.items():
            if k in DEFAULTS:
                if k in _BOOL_KEYS:
                    merged[k] = bool(v)
                else:
                    merged[k] = v
    return merged


def save_app_config(data: dict) -> dict:
    """部分更新：仅合并白名单字段，返回合并默认值后的完整配置。"""
    import json

    current = load_app_config()
    for k, v in (data or {}).items():
        if k not in DEFAULTS:
            continue
        if k in _BOOL_KEYS:
            current[k] = bool(v)
        elif k == "engine_mode":
            current[k] = v if v in ("rule", "llm") else DEFAULTS[k]
        else:
            current[k] = v
    _STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(_STORE_PATH, "w", encoding="utf-8") as f:
        json.dump(current, f, ensure_ascii=False, indent=2)
    return current
