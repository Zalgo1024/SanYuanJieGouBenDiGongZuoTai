import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from docx_renderer import format_section_title
from docx_renderer import render_docx
from parser import parse_report


class SectionHeadingNumberingTests(unittest.TestCase):
    def test_adds_chinese_serial_number_to_unmarked_heading(self):
        self.assertEqual(format_section_title("事实摘要", 1), "一、事实摘要")
        self.assertEqual(format_section_title("附录", 7), "七、附录")

    def test_preserves_existing_serial_number_without_duplication(self):
        self.assertEqual(format_section_title("三、政策对象图谱", 3), "三、政策对象图谱")
        self.assertEqual(format_section_title("7. 附录", 7), "七、附录")

    def test_supports_all_report_modes_and_double_digit_sections(self):
        self.assertEqual(format_section_title("组织画像", 1), "一、组织画像")
        self.assertEqual(format_section_title("利益转化与组织社会关系", 7), "七、利益转化与组织社会关系")
        self.assertEqual(format_section_title("第十一部分", 11), "十一、第十一部分")

    def test_renders_analysis_body_heading_so_serials_have_no_gap(self):
        # 真实解析一份政策模式成稿（哨兵：政策对象图谱/政策权重与空间分析）。
        # analysis_body 位于 fact_summary/framework/两个哨兵之后（第 5 位），
        # 渲染后编号必须连续无缺口（一、二、三、四、五、…），正文标题不被吞。
        md = (
            "# 测试报告\n\n"
            "## 事实摘要\n\n事实正文\n\n"
            "## 分析框架\n\n框架正文\n\n"
            "## 政策对象图谱\n\n图谱正文\n\n"
            "## 政策权重与空间分析\n\n权重正文\n\n"
            "## 三元结构分析正文\n\n分析正文\n\n"
            "## 结论\n\n结论正文\n\n"
            "## 附录\n\n[来源一](https://example.com/1)\n"
        )
        report = parse_report(md)
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / "report.docx"
            render_docx(report, str(output))
            from docx import Document

            headings = [
                paragraph.text
                for paragraph in Document(output).paragraphs
                if paragraph.style.name == "Heading 1"
            ]
        self.assertIn("五、三元结构分析正文", headings)
        # 编号无缺口：七个正式章节连续（"目  录"是目录页标题，同为 Heading 1 样式，排除之）
        chapters = [h for h in headings if h != "目  录"]
        self.assertEqual(len(chapters), 7)
        self.assertEqual(chapters[:2], ["一、事实摘要", "二、分析框架"])


if __name__ == "__main__":
    unittest.main()
