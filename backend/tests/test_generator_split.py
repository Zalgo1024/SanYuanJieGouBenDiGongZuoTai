"""第六阶段：生成器拆分的独立单元验证。

验证 generate / extract_network / validate / export 四个阶段可独立调用、
边界清晰，且 generate_and_export 编排后返回结构向后兼容。
"""
import json
import os
from pathlib import Path

import pytest

from app import rule_engine
from app.generator import ReportGenerator
from app.llm_client import MockClient
from app.report_quality import ReportQualityError

FIX = Path(__file__).resolve().parent / "fixtures"


def _load(name: str) -> dict:
    return json.loads((FIX / f"{name}.json").read_text(encoding="utf-8"))


def _gen(sample: dict) -> ReportGenerator:
    si = rule_engine.StructuredInput.model_validate(sample)
    return ReportGenerator(
        None, analysis_type=sample.get("analysis_type", "case"), mode="rule", structured=si
    )


def test_generate_returns_markdown():
    sample = _load("sample_event")
    gen = _gen(sample)
    md = gen.generate(title=sample["title"])
    assert isinstance(md, str) and md.strip()
    assert md.lstrip().startswith("# ")  # _normalize 保证以一级标题开头


def test_extract_network_parses_diagram():
    sample = _load("sample_event")
    gen = _gen(sample)
    md = gen.generate(title=sample["title"])
    net = gen.extract_network(md)
    assert "diagram" in net and "valid" in net
    # 规则引擎产物必含 DIAGRAM 区块
    assert net["valid"] is True
    assert "```" not in net["diagram"]  # 已剥离代码围栏


def test_extract_network_handles_missing_diagram():
    sample = _load("sample_event")
    gen = _gen(sample)
    net = gen.extract_network("# 标题\n\n无网络区块的正文")
    assert net["valid"] is False
    assert net["diagram"] is None


def test_validate_returns_contract():
    sample = _load("sample_event")
    gen = _gen(sample)
    gen.generate(title=sample["title"])
    contract = gen.validate()
    assert isinstance(contract, dict)
    assert "valid" in contract
    assert contract["engine_used"] == "rule"


def test_validate_before_generate_returns_fallback():
    gen = _gen(_load("sample_event"))
    contract = gen.validate()
    assert contract["valid"] is False
    assert contract["engine_used"] is None


def test_generate_and_export_orchestrates_and_is_compatible(tmp_path):
    sample = _load("sample_event")
    gen = _gen(sample)
    out = gen.generate_and_export(title=sample["title"], output_dir=str(tmp_path), slug="split_event")
    # 向后兼容字段齐全
    assert out["markdown"]
    assert out["contract"]["valid"] is True
    assert out["engine_used"] == "rule"
    assert out["degraded_from_llm"] is False
    # 新增 network 阶段产物
    assert out["network"]["valid"] is True
    # 引擎导出契约字段
    assert isinstance(out.get("pdf_available"), bool)
    assert out.get("word") and os.path.exists(out["word"])


def test_freeform_llm_failure_never_degrades_to_rule(monkeypatch):
    monkeypatch.setattr(
        "app.llm_client.create_llm_from_config", lambda _config=None: MockClient()
    )
    gen = ReportGenerator(None, analysis_type="case", mode="llm", structured=None)

    with pytest.raises(ValueError, match="自由输入"):
        gen.generate("分析这个事件", "自由输入报告")


def test_structured_llm_failure_can_degrade_to_rule(monkeypatch):
    sample = _load("sample_event")
    structured = rule_engine.StructuredInput.model_validate(sample)
    monkeypatch.setattr(
        "app.llm_client.create_llm_from_config", lambda _config=None: MockClient()
    )
    gen = ReportGenerator(
        None,
        analysis_type="case",
        mode="llm",
        structured=structured,
    )

    markdown = gen.generate("", sample["title"])

    assert markdown.startswith("# ")
    assert gen.validate()["engine_used"] == "rule"
    assert gen.validate()["degraded_from_llm"] is True


def test_rule_generation_attaches_a_passing_quality_result():
    sample = _load("sample_event")
    gen = _gen(sample)

    gen.generate(title=sample["title"])

    assert gen.quality().valid is True
    assert gen.quality().score > 0


def test_rule_generation_rejects_a_broken_template(monkeypatch):
    sample = _load("sample_event")
    gen = _gen(sample)
    monkeypatch.setattr(
        rule_engine,
        "generate",
        lambda _structured: "# 失败报告\n\n## 结论\n\n（未提供分析）",
    )

    with pytest.raises(ReportQualityError):
        gen.generate(title=sample["title"])


def test_llm_quality_failure_gets_at_most_two_targeted_revisions(monkeypatch):
    sample = _load("sample_event")
    valid = rule_engine.generate(rule_engine.StructuredInput.model_validate(sample))
    invalid = valid.replace("图 1", "下图")

    class SequenceLlm:
        def __init__(self):
            self.calls = []
            self.responses = [invalid, invalid, valid]

        def generate(self, system, user, temperature=0.2):
            self.calls.append(user)
            return self.responses.pop(0)

    llm = SequenceLlm()
    monkeypatch.setattr("app.llm_client.create_llm_from_config", lambda _config=None: llm)
    gen = ReportGenerator(None, analysis_type="case", mode="llm", structured=None)

    markdown = gen.generate("分析这个事件", sample["title"])

    assert markdown
    assert len(llm.calls) == 3
    assert "figure_reference" in llm.calls[1]
    assert gen.quality().valid is True


def test_ai_revise_also_runs_the_quality_revision_loop(monkeypatch):
    sample = _load("sample_event")
    valid = rule_engine.generate(rule_engine.StructuredInput.model_validate(sample))
    invalid = valid.replace("图 1", "下图")

    class SequenceLlm:
        def __init__(self):
            self.calls = []
            self.responses = [invalid, valid]

        def generate(self, system, user, temperature=0.2):
            self.calls.append(user)
            return self.responses.pop(0)

    llm = SequenceLlm()
    monkeypatch.setattr("app.llm_client.create_llm_from_config", lambda _config=None: llm)
    gen = ReportGenerator(None, analysis_type="case", mode="llm")

    revised = gen.revise(valid, "压缩重复内容", sample["title"])

    assert revised
    assert len(llm.calls) == 2
    assert "figure_reference" in llm.calls[1]
    assert gen.quality().valid is True
