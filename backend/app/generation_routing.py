"""Input and engine routing for analysis tasks."""

from typing import Literal

from pydantic import BaseModel


class GenerationDecision(BaseModel):
    input_mode: Literal["freeform", "structured"]
    requested_engine: Literal["auto", "llm", "rule"]
    selected_engine: Literal["llm", "rule"]
    may_fallback_to_rule: bool


class GenerationRouteError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def decide_generation_route(
    *,
    input_mode: str | None,
    requested_engine: str | None,
    structured: dict | None,
    llm_available: bool,
) -> GenerationDecision:
    resolved_input = input_mode if input_mode in ("freeform", "structured") else None
    if resolved_input is None:
        resolved_input = "structured" if structured else "freeform"

    resolved_engine = (
        requested_engine
        if requested_engine in ("auto", "llm", "rule")
        else "auto"
    )

    if resolved_input == "freeform":
        if resolved_engine == "rule":
            raise GenerationRouteError(
                "freeform_requires_structured_input",
                "自由输入不能由规则引擎猜测事实，请切换为结构化录入。",
            )
        if not llm_available:
            raise GenerationRouteError(
                "freeform_requires_llm",
                "自由输入需要你自己的 AI API 连接，请先到设置页配置，或切换为结构化录入。",
            )
        return GenerationDecision(
            input_mode="freeform",
            requested_engine=resolved_engine,
            selected_engine="llm",
            may_fallback_to_rule=False,
        )

    if not structured:
        raise GenerationRouteError(
            "structured_input_required",
            "结构化录入缺少主体、关系、证据等必要数据。",
        )

    if resolved_engine == "llm" and llm_available:
        selected = "llm"
        fallback = True
    else:
        selected = "rule"
        fallback = False
    return GenerationDecision(
        input_mode="structured",
        requested_engine=resolved_engine,
        selected_engine=selected,
        may_fallback_to_rule=fallback,
    )
