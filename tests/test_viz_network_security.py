import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from viz_network import _generate_html


class DiagramHtmlSecurityTests(unittest.TestCase):
    """回归保护：交互式 HTML 中的 title / 节点 / 边 / viz 字段必须防注入。

    曾存在存储型 XSS：AI 生成文本（标题、节点标签、边标签）未经转义直接拼进
    内联 <script>，含 `</script>` 即可闭合脚本标签执行任意代码。
    """

    def _render(self, data: dict) -> str:
        out = os.path.join(tempfile.mkdtemp(), "t.html")
        self.assertIsNotNone(_generate_html(data, out))
        with open(out, encoding="utf-8") as f:
            return f.read()

    def test_title_is_html_escaped(self):
        html = self._render({
            "viz": "network",
            "title": '甲</title><script>alert(1)</script>',
            "nodes": [{"id": "a", "label": "节点A"}],
            "edges": [],
        })
        self.assertNotIn("</title><script>", html)
        self.assertIn("&lt;/title&gt;", html)

    def test_node_label_cannot_break_out_of_script_tag(self):
        html = self._render({
            "viz": "network",
            "title": "正常标题",
            "nodes": [{"id": "a", "label": '</script><script>alert(2)</script>'}],
            "edges": [],
        })
        self.assertNotIn("</script><script>alert(2)", html)
        self.assertIn("\\u003c/script>", html)  # '<' 转义为 \u003c，'</script>' 无法闭合

    def test_edge_label_cannot_break_out_of_script_tag(self):
        html = self._render({
            "viz": "network",
            "title": "正常标题",
            "nodes": [{"id": "a", "label": "A"}, {"id": "b", "label": "B"}],
            "edges": [{"source": "a", "target": "b", "label": '</script><script>alert(3)</script>'}],
        })
        self.assertNotIn("</script><script>alert(3)", html)
        self.assertIn("\\u003c/script>", html)

    def test_arbitrary_viz_value_falls_back_to_whitelist(self):
        html = self._render({
            "viz": 'x";alert(4);//',
            "title": "正常标题",
            "nodes": [{"id": "a", "label": "A"}],
            "edges": [],
        })
        self.assertNotIn("alert(4)", html)
        self.assertIn("var viz = \"network\"", html)

    def test_normal_content_still_renders(self):
        html = self._render({
            "viz": "org",
            "title": "组织架构",
            "nodes": [{"id": "总部", "label": "总部"}, {"id": "加盟商", "label": "加盟商"}],
            "edges": [{"source": "总部", "target": "加盟商", "label": "控制", "type": "power"}],
        })
        self.assertIn("组织架构", html)
        self.assertIn("var viz = \"org\"", html)


if __name__ == "__main__":
    unittest.main()
