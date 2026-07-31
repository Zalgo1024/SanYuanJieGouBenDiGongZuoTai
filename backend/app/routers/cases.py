"""案例库接口：GET /api/cases + POST /api/cases/{id}/import（T14）。

红线：KERNEL `cases/*.py` 与 `theory_config.json` **只读引用**——
用 ast 解析 TITLE/BODY 字符串字面量，**绝不 exec/import**；导入 = 复制为 Task +
播种 original 版本（留痕），**绝不写回 KERNEL 脚本**。

analysis_type 从 BODY 章节哨兵推断（复用 contract 哨兵识别；多类→combo；无→unknown）。
"""
import ast
import json
import logging
import re
import uuid
from pathlib import Path

from fastapi import APIRouter

from app.db import SessionLocal
from app.models import ReportVersion, Task
from app.settings import settings

logger = logging.getLogger(__name__)

router = APIRouter()

# 模板脚本（仅结构骨架，非成稿）——列表排除，导入亦拒绝
TEMPLATE_SCRIPT = "run_report.py"

_DIAGRAM_RE = re.compile(r"```DIAGRAM\s*\n(.*?)\n```", re.DOTALL)


def _cases_dir() -> Path:
    return Path(settings.engine_dir) / "cases"


def _parse_diagrams(md: str) -> list[dict]:
    """提取全部 DIAGRAM 块（/g 语义），逐个 json.loads，坏块跳过。"""
    out: list[dict] = []
    for m in _DIAGRAM_RE.finditer(md or ""):
        try:
            obj = json.loads(m.group(1).strip())
            if isinstance(obj, dict):
                out.append(obj)
        except Exception:  # noqa: BLE001
            continue
    return out


def _count_chapters(md: str) -> int:
    return len([l for l in (md or "").splitlines() if l.strip().startswith("##")])


def _infer_analysis_type(md: str) -> str:
    """从 BODY 哨兵章节推断类型：多类→combo；单类→该类型；无→unknown。"""
    from app.contract import _count_sentinel_modes, _has_section
    from app.prompt_builder import SENTINEL_SECTIONS

    modes = set()
    for mode, sections in SENTINEL_SECTIONS.items():
        for s in sections:
            if _has_section(md, s):
                modes.add(mode)
                break
    if len(modes) >= 2:
        return "combo"
    if len(modes) == 1:
        return next(iter(modes))
    return "unknown"


def _parse_case_file(path: Path) -> dict | None:
    """ast 只读解析单个 cases/*.py：提取 TITLE / BODY 字符串字面量。"""
    try:
        src = path.read_text(encoding="utf-8", errors="replace")
        tree = ast.parse(src)
    except Exception as e:  # noqa: BLE001
        logger.warning("案例解析失败 %s：%s", path.name, e)
        return None

    title: str | None = None
    body: str | None = None
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name) and t.id in ("TITLE", "BODY"):
                    if isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
                        if t.id == "TITLE":
                            title = node.value.value
                        else:
                            body = node.value.value
    if body is None:
        return None
    return {
        "id": path.stem,
        "name": (title or path.stem)[:200],
        "analysis_type": _infer_analysis_type(body),
        "chapters": _count_chapters(body),
        "script": f"cases/{path.name}",
        "title": title or "",
        "markdown": body,
        "diagrams": _parse_diagrams(body),
    }


def _list_case_files() -> list[Path]:
    d = _cases_dir()
    if not d.is_dir():
        return []
    return sorted(
        p
        for p in d.glob("*.py")
        if p.is_file() and p.name != TEMPLATE_SCRIPT and not p.name.startswith("_")
    )


@router.get("/api/cases")
def list_cases():
    """案例库列表：ast 只读解析 KERNEL cases/*.py（排除模板 run_report.py）。"""
    cases: list[dict] = []
    for p in _list_case_files():
        c = _parse_case_file(p)
        if c:
            cases.append(c)
    return {"total": len(cases), "cases": cases}


def _load_case_by_id(case_id: str) -> dict | None:
    for p in _list_case_files():
        if p.stem == case_id:
            return _parse_case_file(p)
    return None


@router.post("/api/cases/{case_id}/import")
def import_case(case_id: str):
    """导入案例：读 BODY → 建 Task(status=done, result={markdown:BODY}) + 播种 original 版本。

    返回 {"task_id": "..."}；前端跳 /report/{taskId} 走 T13 版本留痕。绝不写回 KERNEL。
    """
    case = _load_case_by_id(case_id)
    if not case:
        return {"error": "case_not_found", "message": f"未找到案例 {case_id}"}

    task_id = uuid.uuid4().hex
    title = case["title"] or case["name"] or "未命名案例"
    analysis_type = case["analysis_type"]
    if analysis_type not in ("case", "policy", "org", "opinion", "combo"):
        analysis_type = "case"  # unknown 兜底为事件（前端 5 Tab 均可用）

    with SessionLocal() as db:
        t = Task(
            id=task_id,
            title=title,
            input_text=case["markdown"][:2000],
            analysis_type=analysis_type,
            status="done",
            mode="rule",
            result={
                "markdown": case["markdown"],
                "title": title,
                "engine_used": "case_import",
                "degraded_from_llm": False,
                "contract": {"valid": True, "mode": "case_import", "errors": []},
            },
        )
        db.add(t)
        db.flush()
        v = ReportVersion(
            task_id=task_id,
            kind="original",
            version_no=1,
            edited_by="ai",
            summary="案例库导入（自动生成）",
            content_markdown=case["markdown"],
            editor="系统",
            is_current=1,
        )
        db.add(v)
        db.commit()
    return {"task_id": task_id}
