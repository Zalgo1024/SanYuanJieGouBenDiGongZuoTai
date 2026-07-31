"""端到端完整测试 —— 一条贯穿「样例数据 → 规则引擎 → 导出 → 文件校验 → 快照比对」的链路。

不依赖 HTTP，直接驱动生成器 + 域引擎，验证：
1. Markdown + 契约合法；
2. Word 文件真实生成且可读；
3. 关系图产物非空；
4. PDF 字段存在且为 bool（本机可能不可用，但契约字段必须齐）；
5. 报告结构与「固定快照」逐字段一致（防回归）。

事件型与政策型各跑一条，覆盖两种分析分支。
"""
import json
import os
from pathlib import Path

import docx

from app import rule_engine
from app.generator import ReportGenerator
from tests._snapshot_utils import derive_fields, assert_fields_match

FIX = Path(__file__).resolve().parent / "fixtures"
SNAP = FIX / "snapshots"


def _load(name: str) -> dict:
    return json.loads((FIX / f"{name}.json").read_text(encoding="utf-8"))


def _snap(name: str) -> dict:
    return json.loads((SNAP / f"{name}.snapshot.json").read_text(encoding="utf-8"))


def test_end_to_end_event_pipeline(tmp_path, sample_event):
    si = rule_engine.StructuredInput.model_validate(sample_event)
    gen = ReportGenerator(None, analysis_type="case", mode="rule", structured=si)
    out = gen.generate_and_export(
        title=sample_event["title"], output_dir=str(tmp_path), slug="e2e_event"
    )

    # 1) Markdown + 契约
    assert out["markdown"]
    assert out["contract"]["valid"] is True
    assert out["engine_used"] == "rule"
    assert out["degraded_from_llm"] is False

    # 2) Word 文件真实可读
    word = out.get("word")
    assert word and os.path.exists(word)
    d = docx.Document(word)
    assert len([p for p in d.paragraphs if p.text.strip()]) > 5

    # 3) 关系图产物
    assert out.get("diagrams")

    # 4) PDF 字段契约（本机可能不可用）
    assert isinstance(out.get("pdf_available"), bool)

    # 5) 结构快照一致
    actual = derive_fields(out["markdown"], "case")
    assert_fields_match(actual, _snap("sample_event"))


def test_end_to_end_policy_pipeline(tmp_path, sample_policy):
    si = rule_engine.StructuredInput.model_validate(sample_policy)
    gen = ReportGenerator(None, analysis_type="policy", mode="rule", structured=si)
    out = gen.generate_and_export(
        title=sample_policy["title"], output_dir=str(tmp_path), slug="e2e_policy"
    )

    assert out["contract"]["valid"] is True
    assert out["engine_used"] == "rule"
    assert out.get("word") and os.path.exists(out["word"])

    actual = derive_fields(out["markdown"], "policy")
    assert_fields_match(actual, _snap("sample_policy"))
