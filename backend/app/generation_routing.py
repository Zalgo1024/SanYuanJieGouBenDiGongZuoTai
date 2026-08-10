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
        # 自由输入必须由 LLM 拆解（规则引擎只吃结构化要素，无法处理自由文本）。
        # 因此 freeform + rule 也一律提升为 llm 工作流（保持 legacy 兼容，避免静默空报告）。
        if not llm_available:
            raise GenerationRouteError(
                "freeform_requires_llm",
                "「AI 辅助」模式需要先配置可用的语言模型：请到设置页填写 API Key"
                "（默认 DeepSeek，也可填 OpenAI 兼容地址）。配置后即可联网检索并拆解你的输入。"
                "若暂时不想配 Key，可改用「直接撰写」模式自己粘贴已写好的正文。",
            )
        return GenerationDecision(
            input_mode="freeform",
            requested_engine="auto",
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
