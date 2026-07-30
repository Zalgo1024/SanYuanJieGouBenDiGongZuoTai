import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from docx_renderer import format_section_title
from docx_renderer import render_docx
from parser import ParsedReport, Section


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
        report = ParsedReport(
            title="测试报告",
            sections={"analysis_body": Section("三元结构分析正文")},
        )
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / "report.docx"
            render_docx(report, str(output))
            from docx import Document

            headings = [
                paragraph.text
                for paragraph in Document(output).paragraphs
                if paragraph.style.name == "Heading 1"
            ]
        self.assertIn("三、三元结构分析正文", headings)


if __name__ == "__main__":
    unittest.main()
