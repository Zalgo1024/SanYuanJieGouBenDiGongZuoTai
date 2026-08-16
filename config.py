"""
配置加载器 — 读取 theory_config.json 并提供类型安全的配置访问。

用法:
    from config import load_config
    cfg = load_config()
    cfg.concept_pool          # 全部概念列表
    cfg.get_concept("代偿")   # 按名称查找概念
    cfg.interest_types        # 六大利益类型
    cfg.typography            # 排版参数
"""

import json
import os
from typing import Any, Optional


_CONFIG_PATH = os.path.join(os.path.dirname(__file__), "theory_config.json")


class Config:
    """包装 theory_config.json 的配置对象，提供属性访问和便捷方法。"""

    def __init__(self, data: dict) -> None:
        self._data = data

    # ── 顶层属性 ──────────────────────────────────────────────

    @property
    def theory(self) -> dict:
        """理论元信息（名称、版本、版权）。"""
        return self._data.get("theory", {})

    @property
    def dimensions(self) -> list[dict]:
        """四维度定义列表。"""
        return self._data.get("dimensions", [])

    @property
    def concept_pool(self) -> list[dict]:
        """全量概念池。"""
        return self._data.get("concept_pool", [])

    @property
    def max_concepts(self) -> int:
        """单篇报告概念数上限。"""
        return self._data.get("max_concepts", 3)

    @property
    def max_concepts_special(self) -> int:
        """特殊情况概念数上限。"""
        return self._data.get("max_concepts_special", 4)

    @property
    def interest_types(self) -> list[dict]:
        """六大利益类型。"""
        return self._data.get("interest_types", [])

    @property
    def interest_conversion_paths(self) -> list[str]:
        """利益转化路径列表。"""
        return self._data.get("interest_conversion_paths", [])

    @property
    def historical_dynamics(self) -> list[dict]:
        """四大历史动力机制。"""
        return self._data.get("historical_dynamics", [])

    @property
    def visualization(self) -> dict:
        """可视化配置（节点类型、边类型、颜色）。"""
        return self._data.get("visualization", {})

    @property
    def report_structure(self) -> list[dict]:
        """案例报告六部分结构定义。"""
        return self._data.get("report_structure", [])

    @property
    def policy_report_structure(self) -> list[dict]:
        """政策报告五部分结构定义。"""
        return self._data.get("policy_report_structure", [])

    @property
    def typography(self) -> dict:
        """排版参数（字体、字号、颜色、页边距）。"""
        return self._data.get("typography", {})

    # ── 便捷方法 ──────────────────────────────────────────────

    def get_concept(self, name: str) -> Optional[dict]:
        """按名称（支持前缀匹配）查找概念。"""
        if not name:
            return None
        for c in self.concept_pool:
            cname = c.get("name", "")
            if cname == name or (cname and cname.startswith(name)):
                return c
        return None

    def get_interest_type(self, type_id: str) -> Optional[dict]:
        """按 id 查找利益类型。"""
        for t in self.interest_types:
            if t.get("id") == type_id:
                return t
        return None

    def get_node_type(self, type_id: str) -> Optional[dict]:
        """按 id 查找可视化节点类型。"""
        for n in self.visualization.get("node_types", []):
            if n.get("id") == type_id:
                return n
        return None

    def get_edge_type(self, type_id: str) -> Optional[dict]:
        """按 id 查找可视化边类型。"""
        for e in self.visualization.get("edge_types", []):
            if e.get("id") == type_id:
                return e
        return None

    def copyright_notice(self) -> str:
        """返回标准版权声明字符串。"""
        return self.theory.get(
            "copyright",
            "三元结构理论 © 2026, CC BY-NC-SA 4.0",
        )

    def raw(self) -> dict:
        """返回原始字典（需要低层级访问时使用）。"""
        return self._data


def load_config(path: Optional[str] = None) -> Config:
    """加载配置文件，返回 Config 实例。

    Args:
        path: 配置文件路径，默认使用项目根目录下的 theory_config.json。

    Returns:
        Config 实例。
    """
    config_path = path or _CONFIG_PATH
    if not os.path.exists(config_path):
        raise FileNotFoundError(
            f"配置文件不存在: {config_path}\n"
            f"请确保 theory_config.json 在项目根目录中。"
        )
    with open(config_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return Config(data)


def get_config() -> Config:
    """单例快捷方式 — 第一次调用时加载，之后返回缓存。"""
    if not hasattr(get_config, "_cache"):
        get_config._cache = load_config()  # type: ignore
    return get_config._cache  # type: ignore
