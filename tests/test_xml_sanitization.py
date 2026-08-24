from engine import CaseAnalysisEngine


def test_export_strips_xml_illegal_control_characters(tmp_path):
    result = CaseAnalysisEngine().export_from_text(
        "控制字符\x00标题",
        "# 控制字符\x00标题\n\n## 案例事实摘要\n\n事实\x0b仍可读取。",
        output_dir=str(tmp_path),
        slug="xml-control-char",
    )

    assert result["word"].endswith(".docx")
