from __future__ import annotations

import json
from pathlib import Path

from app.report_workflow.models import ReportSpec


SPEC_DIR = Path(__file__).with_name("specs")
SUPPORTED_TYPES = ("case", "policy", "org", "opinion", "combo")


def load_report_spec(analysis_type: str) -> ReportSpec:
    resolved = analysis_type if analysis_type in SUPPORTED_TYPES else "case"
    data = json.loads((SPEC_DIR / f"{resolved}.json").read_text(encoding="utf-8"))
    return ReportSpec.model_validate(data)


def load_all_report_specs() -> dict[str, ReportSpec]:
    return {name: load_report_spec(name) for name in SUPPORTED_TYPES}
