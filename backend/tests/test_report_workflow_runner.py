import json
import re

import pytest

from app.llm_client import MockClient
from app.report_workflow.runner import ReportWorkflow, WorkflowError

# 新契约：AI 辅助模式必须有联网素材才能写报告（杜绝 EVD 空壳）。
# mock LLM 返回的 E1 证据卡 source_url 指向此 sources，满足可溯源校验。
_MATERIALS = {
    "items": [
        {"title": "公开规则页面", "url": "https://example.com/rule", "text": "规则正文"}
    ],
    "sources": [
        {"title": "公开规则页面", "url": "https://example.com/rule"}
    ],
}


class DeterministicWorkflowLLM:
    def __init__(self):
        self.calls: list[tuple[str, str]] = []

    def generate(self, system_prompt: str, user_prompt: str, **_kwargs) -> str:
        self.calls.append((system_prompt, user_prompt))
        if "STAGE:SCOPE" in system_prompt:
            return json.dumps(
                {
                    "question": "为什么平台规则会改变主体关系？",
                    "object": "测试事件",
                    "time_range": "2026年",
                    "evidence_boundary": "只使用用户输入与已列明来源",
                    "analysis_type": "case",
                },
                ensure_ascii=False,
            )
        if "STAGE:EVIDENCE" in system_prompt:
            return json.dumps(
                [
                    {
                        "id": "E1",
                        "claim": "公开规则在2026年发生调整。",
                        "source_name": "公开规则页面",
                        "source_url": "https://example.com/rule",
                        "fact_or_inference": "fact",
                        "confidence": "high",
                    },
                    {
                        "id": "E2",
                        "claim": "机构与服务对象之间存在执行关系。",
                        "source_name": "用户输入",
                        "source_url": None,
                        "fact_or_inference": "inference",
                        "confidence": "medium",
                    },
                ],
                ensure_ascii=False,
            )
        if "STAGE:FOUNDATION" in system_prompt:
            return json.dumps(
                {
                    "actors": ["公共机构", "服务对象"],
                    "interests": ["规则执行", "服务可及性"],
                    "relations": ["公共机构制定规则，服务对象承担适应成本"],
                    "core_proposition": "这不是一次单纯调整，而是执行成本与定义权的重新分配。",
                    "evidence_ids": ["E1", "E2"],
                },
                ensure_ascii=False,
            )
        if "STAGE:OUTLINE" in system_prompt:
            spec = json.loads(_between(user_prompt, "SPEC_BEGIN", "SPEC_END"))
            return json.dumps(
                {
                    "title": "规则调整背后的关系重排",
                    "sections": [
                        {
                            "id": section["id"],
                            "title": section["title"],
                            "purpose": section["purpose"],
                            "evidence_ids": ["E1", "E2"],
                            "key_question": f"{section['title']}要解释什么？",
                        }
                        for section in spec["sections"]
                    ],
                },
                ensure_ascii=False,
            )
        if "STAGE:SECTION" in system_prompt:
            title = re.search(r"SECTION_TITLE:(.+)", user_prompt).group(1).strip()
            if title.startswith("附录"):
                return f"## {title}\n\n1. [公开规则页面](https://example.com/rule)"
            return (
                f"## {title}\n\n"
                "公共机构与服务对象围绕规则执行形成了可核验的成本差异。"
                "证据 E1 说明规则已经调整，E2 则限定了关系判断的证据边界。"
            )
        if "STAGE:EDIT" in system_prompt:
            return _between(user_prompt, "DRAFT_BEGIN", "DRAFT_END").strip()
        if "STAGE:DIAGRAM" in system_prompt:
            return json.dumps(
                {
                    "viz": "network",
                    "title": "利益关系网络",
                    "nodes": [
                        {"id": "a", "label": "公共机构", "type": "political"},
                        {"id": "b", "label": "服务对象", "type": "public"},
                    ],
                    "edges": [
                        {
                            "source": "a",
                            "target": "b",
                            "label": "规则执行",
                            "type": "power",
                        }
                    ],
                },
                ensure_ascii=False,
            )
        raise AssertionError(f"unexpected prompt: {system_prompt[:80]}")


def _between(text: str, start: str, end: str) -> str:
    return text.split(start, 1)[1].split(end, 1)[0]


def test_workflow_runs_fixed_stages_and_persists_all_artifacts(tmp_path):
    llm = DeterministicWorkflowLLM()
    phases = []
    workflow = ReportWorkflow(
        llm=llm,
        analysis_type="case",
        artifact_root=tmp_path / "work",
        materials={
            "items": [
                {
                    "title": "公开规则页面",
                    "url": "https://example.com/rule",
                    "text": "RAW-MATERIAL-SECRET 规则正文",
                }
            ],
            "sources": [
                {"title": "公开规则页面", "url": "https://example.com/rule"}
            ],
        },
        on_phase=lambda phase, pct: phases.append((phase, pct)),
    )

    result = workflow.run("RAW-MATERIAL-SECRET 用户问题", "测试报告")

    assert result.markdown.startswith("# 规则调整背后的关系重排")
    assert "```DIAGRAM" in result.markdown
    assert "国作登字-2026-A-00048134" in result.markdown
    assert result.quality.valid is True
    assert phases == [("decompose", 25), ("network", 55), ("organize", 75)]
    assert workflow.store.completed_stages() == [
        "input",
        "scope",
        "evidence",
        "foundation",
        "outline",
        "sections",
        "draft",
        "edit",
        "diagram",
        "quality",
    ]
    for name in (
        "input.json",
        "scope.json",
        "evidence.json",
        "foundation.json",
        "outline.json",
        "draft.md",
        "final.md",
        "diagrams.json",
        "quality.json",
        "state.json",
    ):
        assert (tmp_path / "work" / name).exists(), name

    section_prompts = [user for system, user in llm.calls if "STAGE:SECTION" in system]
    assert section_prompts
    assert all("RAW-MATERIAL-SECRET" not in prompt for prompt in section_prompts)
    assert all('"claim"' in prompt for prompt in section_prompts)


def test_completed_workflow_resumes_without_calling_the_model(tmp_path):
    first = ReportWorkflow(
        llm=DeterministicWorkflowLLM(),
        analysis_type="case",
        artifact_root=tmp_path / "work",
        materials=_MATERIALS,
    ).run("一个测试事件", "测试报告")

    class FailingLLM:
        def generate(self, *_args, **_kwargs):
            raise AssertionError("completed workflow must not call the model")

    resumed = ReportWorkflow(
        llm=FailingLLM(),
        analysis_type="case",
        artifact_root=tmp_path / "work",
        materials=_MATERIALS,
    ).run("一个测试事件", "测试报告")

    assert resumed.markdown == first.markdown
    assert resumed.quality == first.quality


def test_mock_client_is_rejected_instead_of_falling_back_to_templates(tmp_path):
    workflow = ReportWorkflow(
        llm=MockClient(),
        analysis_type="case",
        artifact_root=tmp_path / "work",
    )

    with pytest.raises(WorkflowError, match="未配置可用的语言模型"):
        workflow.run("分析这个事件", "测试报告")


def test_degenerate_model_diagram_is_repaired_without_failing_the_report(tmp_path):
    class EmptyDiagramLLM(DeterministicWorkflowLLM):
        def generate(self, system_prompt: str, user_prompt: str, **kwargs) -> str:
            if "STAGE:FOUNDATION" in system_prompt:
                return json.dumps(
                    {
                        "actors": [],
                        "interests": [],
                        "relations": [],
                        "core_proposition": "",
                        "evidence_ids": ["E1"],
                    },
                    ensure_ascii=False,
                )
            if "STAGE:DIAGRAM" in system_prompt:
                return json.dumps(
                    {
                        "viz": "network",
                        "title": "空图",
                        "nodes": [],
                        "edges": [],
                    },
                    ensure_ascii=False,
                )
            if "STAGE:EDIT" in system_prompt:
                edited = super().generate(system_prompt, user_prompt, **kwargs)
                return edited + "\n\n未标注证据编号的句子属于分析性推断。"
            return super().generate(system_prompt, user_prompt, **kwargs)

    result = ReportWorkflow(
        llm=EmptyDiagramLLM(),
        analysis_type="case",
        artifact_root=tmp_path / "work",
        materials=_MATERIALS,
    ).run("分析这个事件", "测试报告")

    assert result.quality.valid is True
    assert any(issue.code == "failure_placeholder" for issue in result.quality.issues)
    assert all(issue.severity != "error" for issue in result.quality.issues)
    assert len(result.diagram["nodes"]) >= 2
    assert result.diagram["edges"]
    assert {node["label"] for node in result.diagram["nodes"]} == {
        "测试事件",
        "可验证公开证据",
    }
    assert "```DIAGRAM" in result.markdown


def test_invalid_stage_json_repair_receives_the_required_schema(tmp_path):
    class SchemaRepairLLM(DeterministicWorkflowLLM):
        def generate(self, system_prompt: str, user_prompt: str, **kwargs) -> str:
            if "STAGE:FOUNDATION_JSON_REPAIR" in system_prompt:
                assert "REQUIRED_JSON_SCHEMA_BEGIN" in user_prompt
                assert '"interests"' in user_prompt
                return json.dumps(
                    {
                        "actors": ["公共机构", "服务对象"],
                        "interests": ["规则执行"],
                        "relations": ["公共机构执行规则"],
                        "core_proposition": "规则执行会重新分配适应成本。",
                        "evidence_ids": ["E1"],
                    },
                    ensure_ascii=False,
                )
            if "STAGE:FOUNDATION" in system_prompt:
                return json.dumps(
                    {
                        "actors": ["公共机构"],
                        "interests": {},
                        "relations": [],
                        "core_proposition": "",
                        "evidence_ids": ["E1"],
                    },
                    ensure_ascii=False,
                )
            return super().generate(system_prompt, user_prompt, **kwargs)

    result = ReportWorkflow(
        llm=SchemaRepairLLM(),
        analysis_type="case",
        artifact_root=tmp_path / "work",
        materials=_MATERIALS,
    ).run("分析这个事件", "测试报告")

    assert result.quality.valid is True


def test_combo_outline_must_select_at_least_two_analysis_modes(tmp_path):
    class IncompleteComboLLM(DeterministicWorkflowLLM):
        def generate(self, system_prompt: str, user_prompt: str, **kwargs) -> str:
            if "STAGE:OUTLINE" not in system_prompt:
                return super().generate(system_prompt, user_prompt, **kwargs)
            spec = json.loads(_between(user_prompt, "SPEC_BEGIN", "SPEC_END"))
            required = [section for section in spec["sections"] if section["required"]]
            return json.dumps(
                {
                    "title": "不完整组合报告",
                    "sections": [
                        {
                            "id": section["id"],
                            "title": section["title"],
                            "purpose": section["purpose"],
                            "evidence_ids": ["E1"],
                            "key_question": "需要解释什么？",
                        }
                        for section in required
                    ],
                },
                ensure_ascii=False,
            )

    workflow = ReportWorkflow(
        llm=IncompleteComboLLM(),
        analysis_type="combo",
        artifact_root=tmp_path / "work",
        materials=_MATERIALS,
    )

    with pytest.raises(WorkflowError, match="至少选择两类"):
        workflow.run("综合分析这个事件、政策和组织", "组合报告")
