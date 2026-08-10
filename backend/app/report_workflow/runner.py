from __future__ import annotations

import dataclasses
import json
import re
from pathlib import Path
from typing import TypeVar

from pydantic import BaseModel, TypeAdapter, ValidationError

from app.llm_client import MockClient
from app.report_quality import ReportQualityResult
from app.report_workflow.artifacts import ArtifactStore
from app.report_workflow.models import (
    DiagramResult,
    EvidenceCard,
    FoundationResult,
    OutlineResult,
    ScopeResult,
)
from app.report_workflow.prompts import (
    diagram_prompts,
    edit_prompts,
    evidence_prompts,
    foundation_prompts,
    outline_prompts,
    repair_prompts,
    scope_prompts,
    section_prompts,
)
from app.report_workflow.quality import evaluate_delivery_quality
from app.report_workflow.specs import load_report_spec


T = TypeVar("T")
_FENCE_RE = re.compile(r"^\s*```(?:json|markdown)?\s*\n(.*?)\n```\s*$", re.DOTALL)
_DIAGRAM_RE = re.compile(r"```DIAGRAM\s*\n.*?\n```", re.DOTALL | re.IGNORECASE)
_NODE_TYPES = {
    "actor",
    "material",
    "security",
    "political",
    "identity_culture",
    "institutional_future",
    "public",
}
_EDGE_TYPES = {"economic", "power", "cultural", "legal"}
_COPYRIGHT = (
    "分析框架：三元结构理论 © 2026, CC BY-NC-SA 4.0，"
    "国作登字-2026-A-00048134"
)


class WorkflowError(RuntimeError):
    def __init__(self, message: str, *, stage: str | None = None, code: str = "workflow_error"):
        super().__init__(message)
        self.stage = stage
        self.code = code


class WorkflowQualityError(WorkflowError):
    def __init__(self, result: ReportQualityResult):
        self.result = result
        super().__init__(
            "报告草稿已保留，但未通过最低交付校验。",
            stage="quality_gate",
            code="quality_gate",
        )


class WorkflowRunResult(BaseModel):
    markdown: str
    diagram: dict
    quality: ReportQualityResult
    spec_version: str


def _jsonable(value):
    if isinstance(value, BaseModel):
        return value.model_dump()
    if dataclasses.is_dataclass(value):
        return dataclasses.asdict(value)
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(item) for item in value]
    return value


class ReportWorkflow:
    """Deterministic state machine around a bounded text-generation model."""

    def __init__(
        self,
        *,
        llm,
        analysis_type: str,
        artifact_root: str | Path,
        materials=None,
        temperature: float = 0.4,
        on_phase=None,
    ):
        self.llm = llm
        self.spec = load_report_spec(analysis_type)
        self.store = ArtifactStore(artifact_root)
        self.materials = _jsonable(materials or {"items": [], "sources": []})
        self.temperature = temperature
        self.on_phase = on_phase

    def _emit(self, phase: str, pct: int) -> None:
        if self.on_phase:
            self.on_phase(phase, pct)

    def _generate(self, system: str, user: str, *, stage: str) -> str:
        try:
            value = self.llm.generate(
                system,
                user,
                temperature=self.temperature,
            )
        except Exception as exc:  # noqa: BLE001
            raise WorkflowError(f"{stage} 阶段模型调用失败：{exc}", stage=stage) from exc
        value = (value or "").strip()
        match = _FENCE_RE.match(value)
        return match.group(1).strip() if match else value

    def _json_stage(self, stage: str, prompts: tuple[str, str], adapter) -> T:
        raw = self._generate(*prompts, stage=stage)
        try:
            return adapter.validate_python(json.loads(raw))
        except (ValueError, TypeError, ValidationError) as first_error:
            repair_system = (
                f"STAGE:{stage.upper()}_JSON_REPAIR\n"
                "只把输入修复为符合要求的合法 JSON，不增加事实，不输出解释。"
            )
            schema = json.dumps(adapter.json_schema(), ensure_ascii=False, indent=2)
            repair_user = (
                f"REQUIRED_JSON_SCHEMA_BEGIN\n{schema}\nREQUIRED_JSON_SCHEMA_END\n\n"
                f"INVALID_JSON_BEGIN\n{raw}\nINVALID_JSON_END"
            )
            repaired = self._generate(repair_system, repair_user, stage=stage)
            try:
                return adapter.validate_python(json.loads(repaired))
            except (ValueError, TypeError, ValidationError) as exc:
                raise WorkflowError(
                    f"{stage} 阶段连续两次返回无效结构：{first_error}",
                    stage=stage,
                    code="invalid_stage_output",
                ) from exc

    def _load_completed_result(self) -> WorkflowRunResult | None:
        if not self.store.is_completed("quality"):
            return None
        quality_data = self.store.read_json("quality.json")
        quality = ReportQualityResult.model_validate(quality_data)
        result = WorkflowRunResult(
            markdown=self.store.read_text("final.md", "") or "",
            diagram=(self.store.read_json("diagrams.json", [{}]) or [{}])[0],
            quality=quality,
            spec_version=self.spec.version,
        )
        if not quality.valid:
            raise WorkflowQualityError(quality)
        return result

    def _enforce_evidence_traceability(self, evidence: list[EvidenceCard]) -> None:
        """可溯源校验：证据卡必须有可追溯到公开素材的来源链接，杜绝 LLM 编造 EVD 空壳。

        两道防线：
        1. 无联网素材（sources 为空）→ 直接拒绝，AI 辅助模式不许凭空生成报告。
        2. 有素材但证据卡全部无法溯源到 sources 中的真实 URL → 拒绝，说明 LLM 没用素材而是在编。
        用户输入本身陈述的事实（source_name="用户输入"）不在此校验范围内——
        AI 辅助模式的契约是「平台联网搜素材 → 基于素材写」，不是「用户喂事实」。
        """
        sources = (self.materials or {}).get("sources") or []
        source_urls = {
            str(item.get("url", "")).strip()
            for item in sources
            if isinstance(item, dict) and item.get("url")
        }
        if not source_urls:
            raise WorkflowError(
                "未检索到公开素材，AI 辅助模式无法凭空生成报告。"
                "请：① 确认已开启联网检索并稍后重试；"
                "② 或在「直接撰写」模式直接粘贴你的分析正文。",
                stage="evidence",
                code="no_materials",
            )
        traced = [
            card
            for card in evidence
            if card.source_url and str(card.source_url).strip() in source_urls
        ]
        if not traced:
            raise WorkflowError(
                "已检索到公开素材，但未能从中提取可溯源证据（证据卡缺少有效来源链接）。"
                "请提供更具体的主题或来源链接，或在「直接撰写」模式直接粘贴分析正文。",
                stage="evidence",
                code="untraceable_evidence",
            )

    def run(self, input_text: str, title: str) -> WorkflowRunResult:
        completed = self._load_completed_result()
        if completed is not None:
            return completed
        if isinstance(self.llm, MockClient):
            raise WorkflowError(
                "未配置可用的语言模型，正式报告工作流无法启动。",
                stage="configuration",
                code="llm_unavailable",
            )

        if not self.store.is_completed("input"):
            self.store.write_json(
                "input.json",
                {
                    "title": title,
                    "input_text": input_text,
                    "analysis_type": self.spec.analysis_type,
                    "materials": self.materials,
                },
            )
            self.store.mark_completed("input")

        self._emit("decompose", 25)
        if self.store.is_completed("scope"):
            scope = ScopeResult.model_validate(self.store.read_json("scope.json"))
        else:
            scope = self._json_stage(
                "scope",
                scope_prompts(input_text, title, self.spec),
                TypeAdapter(ScopeResult),
            )
            self.store.write_json("scope.json", scope.model_dump())
            self.store.mark_completed("scope")

        evidence_adapter = TypeAdapter(list[EvidenceCard])
        if self.store.is_completed("evidence"):
            evidence = evidence_adapter.validate_python(self.store.read_json("evidence.json"))
        else:
            evidence = self._json_stage(
                "evidence",
                evidence_prompts(input_text, self.materials, scope),
                evidence_adapter,
            )
            if not evidence:
                raise WorkflowError("证据提取结果为空。", stage="evidence", code="empty_evidence")
            # —— 可溯源校验：杜绝 LLM 在无素材时编造 EVD 空壳证据卡 ——
            self._enforce_evidence_traceability(evidence)
            self.store.write_json("evidence.json", [item.model_dump() for item in evidence])
            self.store.mark_completed("evidence")

        if self.store.is_completed("foundation"):
            foundation = FoundationResult.model_validate(
                self.store.read_json("foundation.json")
            )
        else:
            foundation = self._json_stage(
                "foundation",
                foundation_prompts(scope, evidence),
                TypeAdapter(FoundationResult),
            )
            self.store.write_json("foundation.json", foundation.model_dump())
            self.store.mark_completed("foundation")

        if self.store.is_completed("outline"):
            outline = OutlineResult.model_validate(self.store.read_json("outline.json"))
        else:
            outline = self._json_stage(
                "outline",
                outline_prompts(title, self.spec, foundation, evidence),
                TypeAdapter(OutlineResult),
            )
            required_ids = [section.id for section in self.spec.sections if section.required]
            outline_ids = [section.id for section in outline.sections]
            missing = [section_id for section_id in required_ids if section_id not in outline_ids]
            if missing:
                raise WorkflowError(
                    "提纲缺少必要章节：" + "、".join(missing),
                    stage="outline",
                    code="incomplete_outline",
                )
            if self.spec.analysis_type == "combo":
                selected_modes = self._combo_modes(outline_ids)
                if len(selected_modes) < 2:
                    raise WorkflowError(
                        "组合报告提纲必须至少选择两类分析模式章节。",
                        stage="outline",
                        code="incomplete_combo_outline",
                    )
            self.store.write_json("outline.json", outline.model_dump())
            self.store.mark_completed("outline")

        cards_by_id = {item.id: item for item in evidence}
        section_texts: list[str] = []
        for index, section in enumerate(outline.sections, start=1):
            filename = f"sections/{index:02d}-{section.id}.md"
            if self.store.read_text(filename) is not None:
                text = self.store.read_text(filename, "") or ""
            else:
                cards = [
                    cards_by_id[item_id]
                    for item_id in section.evidence_ids
                    if item_id in cards_by_id
                ] or evidence
                text = self._generate(
                    *section_prompts(section, cards, foundation),
                    stage=f"section:{section.id}",
                )
                if not text.lstrip().startswith("## "):
                    text = f"## {section.title}\n\n{text}"
                self.store.write_text(filename, text.strip() + "\n")
            section_texts.append(text.strip())
        if not self.store.is_completed("sections"):
            self.store.mark_completed("sections")

        if self.store.is_completed("draft"):
            draft = self.store.read_text("draft.md", "") or ""
        else:
            draft = f"# {outline.title}\n\n" + "\n\n".join(section_texts) + "\n"
            self.store.write_text("draft.md", draft)
            self.store.mark_completed("draft")

        if self.store.is_completed("edit"):
            final = self.store.read_text("final.md", "") or ""
        else:
            final = self._generate(*edit_prompts(draft, self.spec), stage="edit")
            if not final.lstrip().startswith("# "):
                final = f"# {outline.title}\n\n{final}"
            self.store.write_text("final.md", final.strip() + "\n")
            self.store.mark_completed("edit")

        if self.store.is_completed("diagram"):
            diagram = DiagramResult.model_validate(
                (self.store.read_json("diagrams.json") or [])[0]
            )
            final = self.store.read_text("final.md", final) or final
        else:
            diagram = self._json_stage(
                "diagram",
                diagram_prompts(foundation, evidence, self.spec),
                TypeAdapter(DiagramResult),
            )
            diagram = self._normalize_diagram(diagram, scope, foundation)
            self.store.write_json("diagrams.json", [diagram.model_dump()])
            final = self._insert_diagram(final, diagram.model_dump())
            self.store.write_text("final.md", final)
            self.store.mark_completed("diagram")

        if _COPYRIGHT not in final:
            final = final.rstrip() + "\n\n" + _COPYRIGHT + "\n"
            self.store.write_text("final.md", final)

        self._emit("network", 55)
        self._emit("organize", 75)
        used_web_sources = bool((self.materials or {}).get("sources"))
        quality = evaluate_delivery_quality(
            final,
            spec=self.spec,
            used_web_sources=used_web_sources,
        )
        if not quality.valid:
            errors = [issue.message for issue in quality.issues if issue.severity == "error"]
            repaired = self._generate(*repair_prompts(final, errors), stage="quality_repair")
            # DIAGRAM is a validated workflow artifact. A prose repair pass must not
            # silently replace it with an empty or malformed model-generated graph.
            repaired = self._insert_diagram(repaired, diagram.model_dump())
            if _COPYRIGHT not in repaired:
                repaired = repaired.rstrip() + "\n\n" + _COPYRIGHT + "\n"
            final = repaired.strip() + "\n"
            self.store.write_text("final.md", final)
            quality = evaluate_delivery_quality(
                final,
                spec=self.spec,
                used_web_sources=used_web_sources,
            )

        self.store.write_json("quality.json", quality.model_dump())
        self.store.mark_completed("quality")
        if not quality.valid:
            raise WorkflowQualityError(quality)
        return WorkflowRunResult(
            markdown=final,
            diagram=diagram.model_dump(),
            quality=quality,
            spec_version=self.spec.version,
        )

    @staticmethod
    def _insert_diagram(markdown: str, diagram: dict) -> str:
        block = "```DIAGRAM\n" + json.dumps(diagram, ensure_ascii=False) + "\n```"
        if _DIAGRAM_RE.search(markdown or ""):
            return _DIAGRAM_RE.sub(block, markdown, count=1)
        appendix = re.search(r"^##\s+.*附录.*$", markdown or "", re.MULTILINE)
        if appendix:
            pos = appendix.start()
            return markdown[:pos].rstrip() + "\n\n" + block + "\n\n" + markdown[pos:]
        return (markdown or "").rstrip() + "\n\n" + block + "\n"

    def _normalize_diagram(
        self,
        diagram: DiagramResult,
        scope: ScopeResult,
        foundation: FoundationResult,
    ) -> DiagramResult:
        """Return a renderable graph without inventing real-world relationships.

        Models occasionally return an empty graph when evidence is thin. In that
        case the workflow records the honest analytical boundary: the named object
        and the public-evidence basis that still needs verification.
        """
        nodes: list[dict] = []
        seen_ids: set[str] = set()
        seen_labels: set[str] = set()
        for index, raw in enumerate(diagram.nodes or [], start=1):
            if not isinstance(raw, dict):
                continue
            label = str(raw.get("label") or "").strip()
            if not label or label in seen_labels:
                continue
            node_id = str(raw.get("id") or f"n{index}").strip()
            if not node_id or node_id in seen_ids:
                node_id = f"n{index}"
            node_type = str(raw.get("type") or "public")
            nodes.append(
                {
                    "id": node_id,
                    "label": label,
                    "type": node_type if node_type in _NODE_TYPES else "public",
                }
            )
            seen_ids.add(node_id)
            seen_labels.add(label)

        if len(nodes) < 2:
            candidates = [*foundation.actors, *foundation.interests, scope.object]
            for candidate in candidates:
                label = str(candidate or "").strip()
                if not label or label in seen_labels:
                    continue
                node_id = f"n{len(nodes) + 1}"
                nodes.append(
                    {
                        "id": node_id,
                        "label": label,
                        "type": "actor" if label in foundation.actors else "material",
                    }
                )
                seen_ids.add(node_id)
                seen_labels.add(label)
                if len(nodes) >= 2:
                    break

        if not nodes:
            nodes.append({"id": "n1", "label": scope.object or "分析对象", "type": "actor"})
            seen_ids.add("n1")
        if len(nodes) == 1:
            nodes.append(
                {
                    "id": "n2",
                    "label": "可验证公开证据",
                    "type": "institutional_future",
                }
            )
            seen_ids.add("n2")

        edges: list[dict] = []
        for raw in diagram.edges or []:
            if not isinstance(raw, dict):
                continue
            source = str(raw.get("source") or raw.get("from") or "").strip()
            target = str(raw.get("target") or raw.get("to") or "").strip()
            if source not in seen_ids or target not in seen_ids or source == target:
                continue
            edge_type = str(raw.get("type") or "power")
            edges.append(
                {
                    "source": source,
                    "target": target,
                    "label": str(raw.get("label") or "关系").strip(),
                    "type": edge_type if edge_type in _EDGE_TYPES else "power",
                }
            )

        if not edges:
            relation = next(
                (str(item).strip() for item in foundation.relations if str(item).strip()),
                "关系待公开证据核验",
            )
            edges.append(
                {
                    "source": nodes[0]["id"],
                    "target": nodes[1]["id"],
                    "label": relation[:80],
                    "type": "power" if foundation.relations else "legal",
                }
            )

        return DiagramResult(
            viz=diagram.viz if diagram.viz in self.spec.diagram_viz else self.spec.diagram_viz[0],
            title=(diagram.title or "").strip() or f"{scope.object}结构关系图",
            nodes=nodes,
            edges=edges,
        )

    @staticmethod
    def _combo_modes(section_ids: list[str]) -> set[str]:
        modes: set[str] = set()
        for section_id in section_ids:
            if section_id.startswith("policy_"):
                modes.add("policy")
            elif section_id.startswith("org_"):
                modes.add("org")
            elif section_id.startswith("opinion_"):
                modes.add("opinion")
            elif section_id.startswith("case_"):
                modes.add("case")
        return modes
