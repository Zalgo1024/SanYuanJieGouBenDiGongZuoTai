"""Deterministic comparison of two versioned research snapshots."""

from __future__ import annotations

from typing import Any

from app.research_ledger import ResearchLedger, normalize_research_ledger


def _ledger(value: dict | ResearchLedger | None) -> ResearchLedger | None:
    if value is None:
        return None
    if isinstance(value, ResearchLedger):
        return value
    if not isinstance(value, dict):
        return None
    return normalize_research_ledger(value)


def _dump(value) -> dict:
    return value.model_dump(mode="json")


def _changed_fields(before, after, fields: tuple[str, ...]) -> dict[str, dict[str, Any]]:
    changes = {}
    for field in fields:
        left = getattr(before, field)
        right = getattr(after, field)
        if left != right:
            changes[field] = {"before": left, "after": right}
    return changes


def _risk_level(ledger: ResearchLedger) -> str:
    critical = sum(gap.priority == "critical" for gap in ledger.gaps)
    signals = (
        critical * 3
        + ledger.metrics.conflict_count * 2
        + ledger.metrics.unsupported_inference_count
        + sum(relation.polarity == "negative" and relation.strength >= 4 for relation in ledger.relations)
    )
    return "high" if signals >= 5 else "medium" if signals >= 2 else "low"


def compare_research_ledgers(
    before_value: dict | ResearchLedger | None,
    after_value: dict | ResearchLedger | None,
) -> dict:
    before = _ledger(before_value)
    after = _ledger(after_value)
    if before is None or after is None:
        return {
            "status": "unavailable",
            "has_changes": False,
            "summary": ["缺少可比较的历史研究快照"],
            "added_nodes": [],
            "removed_nodes": [],
            "stance_changes": [],
            "added_relations": [],
            "removed_relations": [],
            "changed_relations": [],
            "added_claims": [],
            "removed_claims": [],
            "changed_claims": [],
            "added_sources": [],
            "new_gaps": [],
            "resolved_gaps": [],
            "risk_change": None,
        }

    before_nodes = {item.id: item for item in before.nodes}
    after_nodes = {item.id: item for item in after.nodes}
    added_nodes = [_dump(after_nodes[key]) for key in sorted(after_nodes.keys() - before_nodes.keys())]
    removed_nodes = [_dump(before_nodes[key]) for key in sorted(before_nodes.keys() - after_nodes.keys())]
    stance_changes = [
        {
            "node_id": key,
            "label": after_nodes[key].label,
            "before": before_nodes[key].stance,
            "after": after_nodes[key].stance,
        }
        for key in sorted(before_nodes.keys() & after_nodes.keys())
        if before_nodes[key].stance != after_nodes[key].stance
    ]

    before_relations = {item.id: item for item in before.relations}
    after_relations = {item.id: item for item in after.relations}
    added_relations = [_dump(after_relations[key]) for key in sorted(after_relations.keys() - before_relations.keys())]
    removed_relations = [_dump(before_relations[key]) for key in sorted(before_relations.keys() - after_relations.keys())]
    changed_relations = []
    for key in sorted(before_relations.keys() & after_relations.keys()):
        changes = _changed_fields(
            before_relations[key],
            after_relations[key],
            ("label", "strength", "interest_types", "direction", "polarity", "confidence", "status", "valid_from", "valid_to"),
        )
        if changes:
            changed_relations.append({"id": key, "label": after_relations[key].label, "changes": changes})

    before_claims = {item.id: item for item in before.claims}
    after_claims = {item.id: item for item in after.claims}
    added_claims = [_dump(after_claims[key]) for key in sorted(after_claims.keys() - before_claims.keys())]
    removed_claims = [_dump(before_claims[key]) for key in sorted(before_claims.keys() - after_claims.keys())]
    changed_claims = []
    for key in sorted(before_claims.keys() & after_claims.keys()):
        changes = _changed_fields(
            before_claims[key], after_claims[key], ("text", "claim_type", "confidence", "unsupported")
        )
        if changes:
            changed_claims.append({"id": key, "text": after_claims[key].text, "changes": changes})

    before_sources = {item.id: item for item in before.sources}
    after_sources = {item.id: item for item in after.sources}
    added_sources = [_dump(after_sources[key]) for key in sorted(after_sources.keys() - before_sources.keys())]
    before_gaps = {item.id: item for item in before.gaps}
    after_gaps = {item.id: item for item in after.gaps}
    new_gaps = [_dump(after_gaps[key]) for key in sorted(after_gaps.keys() - before_gaps.keys())]
    resolved_gaps = [_dump(before_gaps[key]) for key in sorted(before_gaps.keys() - after_gaps.keys())]

    before_risk = _risk_level(before)
    after_risk = _risk_level(after)
    risk_change = {"before": before_risk, "after": after_risk} if before_risk != after_risk else None
    summary = []
    if added_nodes:
        summary.append(f"发现 {len(added_nodes)} 个新主体")
    if removed_nodes:
        summary.append(f"消失 {len(removed_nodes)} 个主体")
    if added_relations:
        summary.append(f"新增 {len(added_relations)} 条关系")
    if removed_relations:
        summary.append(f"移除 {len(removed_relations)} 条关系")
    if changed_relations:
        summary.append(f"{len(changed_relations)} 条关系属性发生变化")
    if stance_changes:
        summary.append(f"{len(stance_changes)} 个主体立场变化")
    if changed_claims:
        summary.append(f"{len(changed_claims)} 个判断被修正或置信度变化")
    if resolved_gaps:
        summary.append(f"补齐 {len(resolved_gaps)} 项资料缺口")
    if risk_change:
        summary.append(f"风险代理由 {before_risk} 变为 {after_risk}")

    has_changes = any(
        (
            added_nodes,
            removed_nodes,
            stance_changes,
            added_relations,
            removed_relations,
            changed_relations,
            added_claims,
            removed_claims,
            changed_claims,
            added_sources,
            new_gaps,
            resolved_gaps,
            risk_change,
        )
    )
    return {
        "status": "ready",
        "has_changes": has_changes,
        "summary": summary or ["未发现结构性变化"],
        "added_nodes": added_nodes,
        "removed_nodes": removed_nodes,
        "stance_changes": stance_changes,
        "added_relations": added_relations,
        "removed_relations": removed_relations,
        "changed_relations": changed_relations,
        "added_claims": added_claims,
        "removed_claims": removed_claims,
        "changed_claims": changed_claims,
        "added_sources": added_sources,
        "new_gaps": new_gaps,
        "resolved_gaps": resolved_gaps,
        "risk_change": risk_change,
    }
