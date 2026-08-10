from __future__ import annotations

import json
import os
from pathlib import Path
from uuid import uuid4


class ArtifactStore:
    """Task-scoped, atomic storage for workflow checkpoints."""

    def __init__(self, root: str | Path):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, name: str) -> Path:
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    def _atomic_write(self, path: Path, content: str) -> None:
        temp = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
        try:
            temp.write_text(content, encoding="utf-8")
            os.replace(temp, path)
        finally:
            if temp.exists():
                temp.unlink()

    def write_json(self, name: str, value) -> None:
        self._atomic_write(
            self._path(name),
            json.dumps(value, ensure_ascii=False, indent=2),
        )

    def read_json(self, name: str, default=None):
        path = self.root / name
        if not path.exists():
            return default
        return json.loads(path.read_text(encoding="utf-8"))

    def write_text(self, name: str, value: str) -> None:
        self._atomic_write(self._path(name), value)

    def read_text(self, name: str, default: str | None = None) -> str | None:
        path = self.root / name
        return path.read_text(encoding="utf-8") if path.exists() else default

    def completed_stages(self) -> list[str]:
        state = self.read_json("state.json", {}) or {}
        return list(state.get("completed_stages") or [])

    def is_completed(self, stage: str) -> bool:
        return stage in self.completed_stages()

    def mark_completed(self, stage: str) -> None:
        completed = self.completed_stages()
        if stage not in completed:
            completed.append(stage)
        self.write_json("state.json", {"completed_stages": completed})
