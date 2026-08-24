"""Deterministic comparison metrics for system, general-AI and human candidates."""

from __future__ import annotations

from typing import Literal

import json

from app.research_ledger import normalize_research_ledger, parse_research_payload


CandidateName = Literal["system", "general", "human"]


def _candidate(snapshot: dict | None, audit: dict | None, duration: float | None) -> dict:
    if not isinstance(snapshot, dict):
        return {
            "status": "missing",
            "actor_count": None,
            "evidence_backed_relation_count": None,
            "fact_error_count": None,
            "investigation_direction_count": None,
            "duration_seconds": duration,
        }
    relations = [item for item in snapshot.get("relations") or [] if isinstance(item, dict)]
    audited_error_count = (audit or {}).get("fact_error_count")
    if not isinstance(audited_error_count, int) or audited_error_count < 0:
        audited_error_count = None
    return {
        "status": "ready",
        "actor_count": len([item for item in snapshot.get("nodes") or [] if isinstance(item, dict)]),
        "evidence_backed_relation_count": sum(
            1 for item in relations if item.get("evidence_ids")
        ),
        "fact_error_count": audited_error_count,
        "investigation_direction_count": len(
            [item for item in snapshot.get("gaps") or [] if isinstance(item, dict)]
        ),
        "duration_seconds": duration if isinstance(duration, (int, float)) and duration >= 0 else None,
    }


def evaluate_candidates(
    *,
    system_snapshot: dict | None,
    general_snapshot: dict | None = None,
    human_snapshot: dict | None = None,
    audits: dict | None = None,
    durations: dict | None = None,
    preference: str = "unset",
) -> dict:
    """Compare inspectable dimensions and deliberately avoid a composite score."""
    audits = audits or {}
    durations = durations or {}
    allowed_preferences = {"system", "general", "human", "tie", "unset"}
    return {
        "candidates": {
            "system": _candidate(system_snapshot, audits.get("system"), durations.get("system")),
            "general": _candidate(general_snapshot, audits.get("general"), durations.get("general")),
            "human": _candidate(human_snapshot, audits.get("human"), durations.get("human")),
        },
        "preference": preference if preference in allowed_preferences else "unset",
        "methodology": [
            "主体数、证据关系数和调查方向数从同一研究账本契约直接计数",
            "事实错误数只有完成人工审计后才显示，未审计时为未知",
            "不合成总分，不自动宣布胜者",
        ],
    }


def generate_general_baseline(*, input_text: str, system_snapshot: dict, llm) -> dict:
    """Run the configured model with a neutral prompt and the same source catalogue."""
    sources = []
    for source in system_snapshot.get("sources") or []:
        if not isinstance(source, dict) or not source.get("id"):
            continue
        sources.append(
            {
                "id": str(source.get("id")),
                "title": str(source.get("title") or "未命名来源"),
                "url": str(source.get("url") or ""),
                "excerpt": str(source.get("excerpt") or "")[:700],
                "source_type": str(source.get("source_type") or "unknown"),
                "source_level": str(source.get("source_level") or "unknown"),
            }
        )
    system = (
        "你是通用研究助理。不要使用三元结构理论、本项目术语或本项目报告模板。"
        "仅依据给定来源和用户问题完成一般性分析，并只返回 JSON 对象。"
        "不得新增来源 ID，不得把推断写成事实，不得编造数量或概率。"
        "输出 sources,claims,nodes,relations,gaps；claims 区分 fact、source_view、inference、user_input；"
        "nodes 至少含 id,label,evidence_ids；relations 至少含 id,source_node,target_node,label,evidence_ids,status,confidence；"
        "gaps 至少含 id,question,reason,recommended_materials。"
    )
    user = "同题输入：\n" + input_text[:6000] + "\n\n共同来源索引：\n" + json.dumps(sources, ensure_ascii=False)
    raw = llm.generate(system, user, temperature=0.1)
    payload = parse_research_payload(raw)
    proposed = {
        str(item.get("id") or ""): item
        for item in payload.get("sources") or []
        if isinstance(item, dict)
    }
    payload["sources"] = [
        {
            **source,
            **(proposed.get(source["id"]) or {}),
            "id": source["id"],
            "title": source["title"],
            "url": source["url"],
        }
        for source in sources
    ]
    return normalize_research_ledger(payload).model_dump()
