"""生成报告结构「固定快照」—— 由样例输入经规则引擎产出的 Markdown 派生结构字段。

运行（在 backend/ 目录）：
    python -m tests.gen_snapshots

产物：tests/fixtures/snapshots/*.snapshot.json
测试 test_rule_engine / test_e2e 会比对这些快照，结构一旦变化即报警，
需人工复核后重新生成（即重新跑本脚本）。
"""
import json
from pathlib import Path

from app import rule_engine
from tests._snapshot_utils import derive_fields

HERE = Path(__file__).resolve().parent
FIX = HERE / "fixtures"
SNAP = HERE / "fixtures" / "snapshots"


def _gen(name: str) -> None:
    data = json.loads((FIX / f"{name}.json").read_text(encoding="utf-8"))
    si = rule_engine.StructuredInput.model_validate(data)
    md = rule_engine.generate(si)
    fields = derive_fields(md, si.analysis_type)
    (SNAP / f"{name}.snapshot.json").write_text(
        json.dumps(fields, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"[{name}] 快照已生成: nodes={fields['diagram_node_count']} "
          f"edges={fields['diagram_edge_count']} concepts={fields['concept_count']} "
          f"len={fields['markdown_length']}")


if __name__ == "__main__":
    _gen("sample_event")
    _gen("sample_policy")
    print("\n✅ 快照生成完成（见 tests/fixtures/snapshots/）")
