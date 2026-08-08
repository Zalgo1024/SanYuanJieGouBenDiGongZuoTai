"""报告生成器 — 生成半的编排层。

职责：
1. 用 prompt_builder 装配系统提示词；
2. 把用户输入（材料/关键词）包装成用户提示词；
3. 调用 LLM 客户端产出 Markdown；
4. 交给域引擎导出 Word(+PDF)，并一并返回 Markdown 原文。

LLM 客户端可替换（DeepSeek / OpenAI / Mock），generator 本身不关心具体模型。
"""
import os
import re

from app.prompt_builder import build_system_prompt
from app.engine_bridge import export_report
from app import rule_engine


def _truncate(text: str | None, limit: int = 64000) -> str | None:
    """截断 LLM 原始响应，避免超大文本撑爆数据库。"""
    if not text:
        return None
    return text if len(text) <= limit else text[:limit] + "\n...[原始响应已截断]"


class ReportGenerator:
    def __init__(
        self,
        llm=None,
        analysis_type: str = "case",
        mode: str = "rule",
        structured=None,
        llm_config: dict | None = None,
        web_mode: bool = False,
        materials: dict | None = None,
    ) -> None:
        self.llm = llm
        self.analysis_type = analysis_type
        self.mode = mode
        self.structured = structured
        self.llm_config = llm_config
        # T3：联网写报告模式（素材注入 + 强制 [名称](url) 附录约束）
        self.web_mode = web_mode
        self.materials = materials

    @staticmethod
    def _coerce_bundle(materials):
        """把 queue 传入的 bundle.__dict__（dict）或 MaterialBundle 归一为 MaterialBundle。"""
        from app.materials import MaterialBundle

        if materials is None:
            return MaterialBundle(items=[], sources=[])
        if isinstance(materials, MaterialBundle):
            return materials
        if isinstance(materials, dict):
            return MaterialBundle(
                items=materials.get("items") or [],
                sources=materials.get("sources") or [],
            )
        return MaterialBundle(items=[], sources=[])

    def _build_user_prompt(
        self, input_text: str, title: str | None, materials: dict | None = None
    ) -> str:
        head = f"报告标题：{title}\n\n" if title else ""
        base = (
            f"{head}以下是待分析的材料（可能是事件描述、政策文本或关键词）：\n\n"
            f"{input_text}\n\n"
            f"请基于上述材料，按系统提示中的结构与铁律生成完整分析正文（Markdown）。"
        )
        if not self.web_mode:
            return base

        from app.materials import format_materials_context, format_source_appendix

        bundle = self._coerce_bundle(materials if materials is not None else self.materials)
        mctx = format_materials_context(bundle)
        src_appendix = format_source_appendix(bundle.sources)
        extra = []
        if mctx:
            extra.append(mctx)
        extra.append(
            "引用约束：正文事实条目仅写「（来源：名称）」；不要在正文堆叠 URL 或整段复述素材。"
            "报告末尾附录使用「[名称](url)」可点击格式，禁止裸 URL 或无链接媒体名。"
        )
        if src_appendix:
            extra.append("附录来源清单（必须原样包含，可增补）：\n" + src_appendix)
        return base + "\n\n" + "\n\n".join(extra)

    @staticmethod
    def _strip_code_fence(markdown: str) -> str:
        # 去掉 LLM 可能额外包裹的 ```markdown ... ``` 整篇围栏
        m = re.match(r"^\s*```[a-zA-Z]*\s*\n(.*)\n```\s*$", markdown, re.DOTALL)
        return m.group(1) if m else markdown

    @staticmethod
    def _normalize(markdown: str, title: str | None) -> str:
        md = ReportGenerator._strip_code_fence(markdown)
        # 保证以一级标题开头，便于 parser 提取标题
        if not md.lstrip().startswith("# "):
            md = f"# {title or '未命名报告'}\n\n" + md
        return md

    def _build_structured(self, input_text: str, title: str | None):
        if isinstance(self.structured, rule_engine.StructuredInput):
            return self.structured
        if isinstance(self.structured, dict):
            return rule_engine.StructuredInput.model_validate(self.structured)
        # 无结构化输入时，用自由文本兜底（仅事件/标题）
        return rule_engine.StructuredInput(
            title=title or "", analysis_type=self.analysis_type, event=input_text or ""
        )

    def generate(self, input_text: str = "", title: str | None = None) -> str:
        if self.mode == "rule":
            si = self._build_structured(input_text, title)
            md = rule_engine.generate(si)
            self._last_contract = {
                "valid": True,
                "diagram_ok": True,
                "diagram_synthetic": False,
                "missing_sections": [],
                "errors": [],
                "repaired": False,
                "mode": "rule",
                "engine_used": "rule",
                "degraded_from_llm": False,
                "degrade_reason": None,
            }
            self._engine_meta = {
                "engine_used": "rule",
                "llm_model": None,
                "llm_temperature": None,
                "prompt_version": None,
                "degraded_from_llm": False,
                "degrade_reason": None,
                "raw_response": None,
            }
            return self._normalize(md, title)

        # —— LLM 增强模式 ——
        from app.contract import validate_and_repair
        from app.llm_client import create_llm_from_config, MockClient
        from app.llm_settings_store import resolve_config
        from app.prompt_builder import PROMPT_VERSION

        cfg = resolve_config(self.llm_config)
        llm = create_llm_from_config(self.llm_config)

        # 无可用密钥 → 没有 LLM 可用，直接降级到规则引擎（核心不依赖 LLM）
        if isinstance(llm, MockClient):
            reason = (
                "未配置 LLM 密钥（请到设置页填写，或用 backend/.env 配置），已使用规则引擎"
            )
            return self._fallback_or_raise(input_text, title, reason)

        system = build_system_prompt(self.analysis_type)
        user = self._build_user_prompt(input_text, title, self.materials)
        try:
            raw = llm.generate(system, user, temperature=cfg["temperature"])
        except Exception as e:  # noqa: BLE001
            # LLMError（限流/鉴权/余额/超时/连接）或任何调用异常 → 降级
            msg = getattr(e, "message", None) or str(e)
            return self._fallback_or_raise(
                input_text, title, f"LLM 调用失败：{msg}"
            )
        md = self._normalize(raw, title)
        si = (
            self.structured
            if isinstance(self.structured, rule_engine.StructuredInput)
            else None
        )
        md, contract = validate_and_repair(md, self.analysis_type, si)
        if contract.get("degrade"):
            reason = "LLM 输出不符合契约（缺少可用利益关系图且必要章节缺失），已自动降级到规则引擎"
            return self._fallback_or_raise(input_text, title, reason, raw=raw)

        # LLM 成功且契约可用
        contract["mode"] = "llm"
        contract["engine_used"] = "llm"
        contract["degraded_from_llm"] = False
        contract["degrade_reason"] = None
        contract["prompt_version"] = cfg["prompt_version"]
        self._last_contract = contract
        self._engine_meta = {
            "engine_used": "llm",
            "llm_model": cfg["model"],
            "llm_temperature": cfg["temperature"],
            "prompt_version": cfg["prompt_version"],
            "degraded_from_llm": False,
            "degrade_reason": None,
            "raw_response": _truncate(raw),
        }
        return md

    def revise(
        self,
        previous_markdown: str,
        instruction: str,
        title: str | None = None,
    ) -> str:
        """T13 AI 再改：基于上一版全文 + 修改指令，生成新 Markdown。

        system = build_system_prompt(同 analysis_type)（含哨兵护栏）；
        user = 上一版全文 + 「修改指令」+「仅输出修改后的完整报告 Markdown」。
        复用 generate 的契约校验/修复/降级链（type_mismatch 提高温度重试 1 次）。

        仅 llm 模式可用；未配置 LLM 密钥时抛出 ValueError（由 API 层转明确错误），不静默。
        """
        from app.contract import validate_and_repair
        from app.llm_client import MockClient, create_llm_from_config
        from app.llm_settings_store import resolve_config

        if self.mode != "llm":
            raise ValueError("AI 再改仅在 llm 模式可用（mode='llm'）")

        cfg = resolve_config(self.llm_config)
        llm = create_llm_from_config(self.llm_config)
        if isinstance(llm, MockClient):
            raise ValueError(
                "未配置 LLM 密钥，AI 再改不可用（请到设置页填写，或用 backend/.env 配置）"
            )

        system = build_system_prompt(self.analysis_type)
        user = (
            f"报告标题：{title or '未命名报告'}\n\n"
            f"以下是上一版报告全文：\n\n{previous_markdown}\n\n"
            f"修改指令：{instruction}\n\n"
            f"请基于上述修改指令，重写为完整报告 Markdown。"
            f"仅输出修改后的完整报告 Markdown，不要输出解释性文字，不要用代码围栏包裹整篇。"
        )

        def _run(temp: float) -> tuple[str, dict]:
            raw = llm.generate(system, user, temperature=temp)
            md = self._normalize(raw, title)
            md, contract = validate_and_repair(md, self.analysis_type, None)
            return md, contract

        try:
            md, contract = _run(cfg["temperature"])
        except Exception as e:  # noqa: BLE001
            msg = getattr(e, "message", None) or str(e)
            raise ValueError(f"AI 再改调用失败：{msg}") from e

        # 缺哨兵/类型不一致 → 提高温度重试 1 次（双轨护栏第三层）
        if contract.get("type_mismatch") or contract.get("degrade"):
            try:
                md2, contract2 = _run(min(cfg["temperature"] + 0.2, 1.0))
                if not contract2.get("type_mismatch") and not contract2.get("degrade"):
                    md, contract = md2, contract2
                else:
                    contract = contract2
            except Exception:  # noqa: BLE001
                pass

        self._last_contract = contract
        self._engine_meta = {
            "engine_used": "llm",
            "llm_model": cfg["model"],
            "llm_temperature": cfg["temperature"],
            "prompt_version": cfg["prompt_version"],
            "degraded_from_llm": False,
            "degrade_reason": None,
            "raw_response": None,
        }
        return md

    def _degrade_to_rule(
        self, input_text: str, title: str | None, reason: str, raw: str | None = None
    ) -> str:
        """LLM 不可用或产出不可信时，回退到规则引擎（核心流程不依赖 LLM）。

        返回规则引擎产出的 Markdown；元信息标注 engine_used=rule / degraded_from_llm=True。
        """
        from app.prompt_builder import PROMPT_VERSION

        si = self._build_structured(input_text, title)
        md = rule_engine.generate(si)
        md = self._normalize(md, title)
        self._last_contract = {
            "valid": True,
            "diagram_ok": True,
            "diagram_synthetic": False,
            "missing_sections": [],
            "errors": [reason],
            "repaired": True,
            "mode": "llm",  # 用户请求的是 llm，但实际用了 rule
            "engine_used": "rule",
            "degraded_from_llm": True,
            "degrade_reason": reason,
            "prompt_version": PROMPT_VERSION,
        }
        self._engine_meta = {
            "engine_used": "rule",
            "llm_model": None,
            "llm_temperature": None,
            "prompt_version": PROMPT_VERSION,
            "degraded_from_llm": True,
            "degrade_reason": reason,
            "raw_response": _truncate(raw),
        }
        return md

    def _fallback_or_raise(
        self, input_text: str, title: str | None, reason: str, raw: str | None = None
    ) -> str:
        if self.structured is None:
            raise ValueError(
                "自由输入的 LLM 生成失败，且没有可供规则引擎接管的结构化数据："
                + reason
            )
        return self._degrade_to_rule(input_text, title, reason, raw=raw)

    def extract_network(self, markdown: str) -> dict:
        """从已生成的 Markdown 中抽取「利益关系网络（DIAGRAM）」区块。

        纯文本解析，不调用域引擎（遵守项目铁律：不改动 engine 内部逻辑）。
        对应进度链第 4 步「利益关系网络拆解」里程碑。

        返回 {"diagram": <str|None>, "valid": <bool>}。
        """
        m = re.search(r"```DIAGRAM\s*\n(.*?)\n```", markdown, re.IGNORECASE | re.DOTALL)
        diagram = m.group(1).strip() if m else None
        return {"diagram": diagram, "valid": bool(diagram)}

    def validate(self, markdown: str | None = None, title: str | None = None) -> dict:
        """契约校验里程碑（进度链第 5 步「整理分析结果」）。

        ``generate()`` 已在两种模式下产出自检契约并存入 ``_last_contract``：
        - LLM 模式：内部已调用 ``validate_and_repair``，契约含真实校验结果；
        - rule 模式：已置为默认通过（结构由规则引擎保证）。

        此处返回该契约作为「整理 / 校验」阶段的可见节点，不二次解析以免与引擎重复。
        markdown / title 入参保留为未来内联校验预留（当前直接复用已算契约）。
        """
        return getattr(self, "_last_contract", None) or {
            "valid": False,
            "diagram_ok": False,
            "diagram_synthetic": False,
            "missing_sections": [],
            "errors": ["尚无契约校验结果（generate 未执行）"],
            "repaired": False,
            "mode": self.mode,
            "engine_used": None,
            "degraded_from_llm": False,
            "degrade_reason": None,
        }

    def export(
        self,
        markdown: str,
        title: str | None = None,
        output_dir: str | None = None,
        slug: str | None = None,
    ) -> dict:
        """导出 Word/PDF（调用域引擎），并归一 PDF 可用状态。

        对应进度链第 6 步「输出分析结果」里程碑。
        返回域引擎导出结果（含 ``pdf_available`` / ``pdf_reason`` 修正），不含原始 Markdown。
        """
        exp = export_report(title or "未命名报告", markdown, output_dir=output_dir, slug=slug)
        # 归一 PDF：域引擎在转换失败时也会返回「幽灵路径」（文件并不存在）。
        # 此处以真实文件存在性为准：存在才保留 pdf 路径并标 pdf_available=true；
        # 否则去掉 pdf 字段、标 pdf_available=false，由前端明确提示「PDF 待配置」。
        # 这样若日后装好 LibreOffice 等转换器，PDF 会自动恢复可用，无需改前端。
        pdf_path = exp.get("pdf")
        exp["pdf_available"] = bool(pdf_path and os.path.exists(pdf_path))
        if not exp["pdf_available"]:
            exp.pop("pdf", None)
            # 明确原因，避免「静默失败」：告知前端/用户当前环境缺哪个转换器
            try:
                from app.engine_bridge import diagnose_pdf

                diag = diagnose_pdf()
                avail = [
                    n
                    for n, ok in (
                        ("LibreOffice", diag.get("libreoffice")),
                        ("pandoc", diag.get("pandoc")),
                        ("Word COM", diag.get("word_com")),
                    )
                    if ok
                ]
                exp["pdf_reason"] = (
                    "本机未安装任何可用 PDF 转换器（建议安装 LibreOffice 并加入 PATH）。"
                    if not avail
                    else f"已检测到 {', '.join(avail)}，但本次转换未成功（见后端日志）。"
                )
            except Exception:  # noqa: BLE001
                exp["pdf_reason"] = "PDF 不可用（原因诊断失败）。"
        return exp

    def generate_and_export(
        self,
        input_text: str = "",
        title: str | None = None,
        output_dir: str | None = None,
        slug: str | None = None,
        on_phase=None,
    ) -> dict:
        """生成报告并导出 Word/PDF。

        编排 ``generate → extract_network → validate → export`` 四个独立阶段，
        在边界以 ``on_phase(phase, pct)`` 回调推送阶段消息（回调异常被忽略，不影响流程）。

        阶段里程碑：
            - ("decompose", 25) — 开始拆解分析（generate 前）
            - ("network", 55)   — 利益关系网络构建（generate 后，extract_network）
            - ("organize", 75)  — 整理分析结果（validate 契约校验）
            - ("output", 85)    — 输出报告（export 导出开始）
        """
        def _safe_phase(phase: str, pct: int):
            if on_phase:
                try:
                    on_phase(phase, pct)
                except Exception:  # noqa: BLE001
                    pass

        _safe_phase("decompose", 25)
        md = self.generate(input_text, title)
        _safe_phase("network", 55)
        network = self.extract_network(md)
        _safe_phase("organize", 75)
        contract = self.validate(md, title)
        _safe_phase("output", 85)
        exp = self.export(md, title, output_dir, slug)
        # 合并：Markdown 原文 + 网络图抽取 + 契约校验 + 引擎导出结果 + 引擎元信息
        meta = getattr(self, "_engine_meta", None) or {}
        return {
            "markdown": md,
            "network": network,
            "contract": contract,
            # —— 阶段四：标注本次报告由哪个引擎生成，是否从 LLM 降级 ——
            "engine_used": meta.get("engine_used"),
            "degraded_from_llm": meta.get("degraded_from_llm", False),
            "degrade_reason": meta.get("degrade_reason"),
            "prompt_version": meta.get("prompt_version"),
            "llm_model": meta.get("llm_model"),
            "llm_temperature": meta.get("llm_temperature"),
            # raw_response 仅落库（Task.llm_raw_response），不进前端响应
            "raw_response": meta.get("raw_response"),
            **exp,
        }
