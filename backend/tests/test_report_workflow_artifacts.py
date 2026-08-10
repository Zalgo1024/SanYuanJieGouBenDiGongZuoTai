from pathlib import Path

from app.report_workflow.artifacts import ArtifactStore
from app.report_workflow.specs import load_all_report_specs, load_report_spec


def test_all_report_specs_load_with_unique_required_section_ids():
    specs = load_all_report_specs()

    assert set(specs) == {"case", "policy", "org", "opinion", "combo"}
    for analysis_type, spec in specs.items():
        assert spec.analysis_type == analysis_type
        required = [section for section in spec.sections if section.required]
        ids = [section.id for section in required]
        assert ids
        assert len(ids) == len(set(ids))
        assert all(section.title and section.purpose for section in required)


def test_unknown_report_spec_falls_back_to_case():
    assert load_report_spec("unknown").analysis_type == "case"


def test_combo_spec_offers_multiple_mode_sections_without_requiring_all_of_them():
    combo = load_report_spec("combo")
    optional_titles = {section.title for section in combo.sections if not section.required}

    assert {"事件与时间线", "政策对象图谱", "组织画像"} <= optional_titles


def test_artifact_store_round_trips_json_text_and_stage_state(tmp_path: Path):
    store = ArtifactStore(tmp_path / "work")

    store.write_json("scope.json", {"question": "为什么会发生？"})
    store.write_text("sections/01-summary.md", "## 事实摘要\n\n正文")
    store.mark_completed("scope")

    assert store.read_json("scope.json") == {"question": "为什么会发生？"}
    assert store.read_text("sections/01-summary.md").startswith("## 事实摘要")
    assert store.is_completed("scope") is True
    assert store.completed_stages() == ["scope"]

    resumed = ArtifactStore(tmp_path / "work")
    assert resumed.is_completed("scope") is True
    assert resumed.read_json("scope.json")["question"] == "为什么会发生？"


def test_artifact_store_overwrites_without_leaving_temp_files(tmp_path: Path):
    store = ArtifactStore(tmp_path / "work")

    store.write_text("final.md", "first")
    store.write_text("final.md", "second")

    assert store.read_text("final.md") == "second"
    assert not list(store.root.rglob("*.tmp"))
