from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ReportSectionSpec(BaseModel):
    id: str
    title: str
    purpose: str
    required: bool = True


class ReportSpec(BaseModel):
    analysis_type: Literal["case", "policy", "org", "opinion", "combo"]
    version: str = "1.0"
    sections: list[ReportSectionSpec]
    diagram_viz: list[Literal["network", "org", "flow"]] = Field(
        default_factory=lambda: ["network"]
    )


class ScopeResult(BaseModel):
    question: str
    object: str
    time_range: str = ""
    evidence_boundary: str
    analysis_type: str


class EvidenceCard(BaseModel):
    id: str
    claim: str
    source_name: str = "用户输入"
    source_url: str | None = None
    fact_or_inference: Literal["fact", "inference"] = "fact"
    confidence: Literal["high", "medium", "low"] = "medium"


class FoundationResult(BaseModel):
    actors: list[str]
    interests: list[str]
    relations: list[str]
    core_proposition: str
    evidence_ids: list[str] = Field(default_factory=list)


class OutlineSection(BaseModel):
    id: str
    title: str
    purpose: str
    evidence_ids: list[str] = Field(default_factory=list)
    key_question: str


class OutlineResult(BaseModel):
    title: str
    sections: list[OutlineSection]


class DiagramResult(BaseModel):
    viz: Literal["network", "org", "flow"] = "network"
    title: str
    nodes: list[dict]
    edges: list[dict]
