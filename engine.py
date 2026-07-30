"""
引擎 — CaseAnalysisEngine 核心编排器。

编排流程：
加载配置 → 解析正文 → 生成 Word → 转换 PDF → 返回文件路径

用法:
    from engine import CaseAnalysisEngine
    engine = CaseAnalysisEngine()
    result = engine.export_from_text("案例名称", "## 案例事实摘要\\n...")
    print(result["word"])  # 输出 .docx 路径
"""

import datetime
import os
from typing import Optional

from config import load_config, Config
from parser import parse_report, ParsedReport
from auto_number import auto_number_headings


_ENGINE_VERSION = "1.0.0"
_REPORTS_DIR = os.path.join(os.path.dirname(__file__), "reports")


class CaseAnalysisEngine:
    """三元结构案例分析引擎。

    负责编排从原始文本到最终文件的完整流程。
    """

    def __init__(self, config: Optional[Config] = None) -> None:
        self.config = config or load_config()
        self._renderer = None   # 延迟导入 docx_renderer
        self._converter = None  # 延迟导入 pdf_converter
        self._diagrams: list[dict] = []  # 本次导出的图表信息

    # ── 核心接口 ──────────────────────────────────────────────

    def export_from_text(
        self,
        title: str,
        body: str,
        *,
        output_dir: Optional[str] = None,
        slug: Optional[str] = None,
        overwrite: bool = False,
        tone: str = "neutral",
    ) -> dict[str, str]:
        """从分析正文导出 Word + PDF 报告。

        Args:
            title: 报告标题（用于文件名和封面）。
            body: Markdown 格式的分析正文（含 ## 章节结构）。
            output_dir: 输出目录。默认自动创建 reports/标题_时间戳/。
            overwrite: 为 True 时复用固定目录名（reports/标题）并清理同名历史
                时间戳目录，始终只保留 1 份，避免反复运行堆积多份。
            tone: 分析基调。「neutral」=客观中立（默认）；「provocative」=煽动性。
                仅作为元数据与封面标注，不改变报告结构；具体行文由撰写者落实。

        Returns:
            {
                "word": "path/to/report.docx",
                "pdf": "path/to/report.pdf",
                "pdf_ok": True/False,
                "folder": "path/to/output_dir",
                "title": "报告标题",
                "tone": "neutral/provocative"
            }
        """
        # 1. 解析正文
        body = auto_number_headings(body)
        report = parse_report(body)
        if not report.title and title:
            report.title = title
        # 分析基调（二选一）：neutral=客观中立 / provocative=煽动性，非法值回退 neutral
        if tone not in ("neutral", "provocative"):
            tone = "neutral"
        report.tone = tone

        # 2. 创建输出目录
        import glob
        import shutil

        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_name = self._safe_filename(title)
        # slug（如 task_id）提供时，在 output_dir 下建独立子目录，避免并发同名任务互相覆盖
        if output_dir and slug:
            folder = os.path.join(output_dir, f"{safe_name}_{slug}")
        elif overwrite:
            # 覆盖模式：复用固定目录名，并清理同名历史时间戳目录，始终只留 1 份
            for old in glob.glob(os.path.join(_REPORTS_DIR, f"{safe_name}_*")):
                try:
                    shutil.rmtree(old)
                except OSError:
                    # 沙箱 safe-delete 拦截删除时忽略，继续写到固定目录
                    pass
            folder = os.path.join(_REPORTS_DIR, safe_name)
        else:
            folder = output_dir or os.path.join(_REPORTS_DIR, f"{safe_name}_{timestamp}")
        os.makedirs(folder, exist_ok=True)

        # 3. 生成 Word
        word_path = self._render_docx(report, folder, tone=tone)

        # 4. 转换 PDF
        pdf_path = self._convert_to_pdf(word_path, folder)

        return {
            "word": word_path,
            "pdf": pdf_path,
            "pdf_ok": bool(pdf_path),
            "folder": folder,
            "title": title,
            "tone": tone,
            "diagrams": self._diagrams,
        }

    def export_from_parsed(
        self,
        report: ParsedReport,
        *,
        output_dir: Optional[str] = None,
        slug: Optional[str] = None,
        overwrite: bool = False,
        tone: str = "neutral",
    ) -> dict[str, str]:
        """从已解析的报告数据导出，跳过解析步骤。"""
        title = report.title or "未命名报告"
        if tone not in ("neutral", "provocative"):
            tone = "neutral"
        report.tone = tone
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_name = self._safe_filename(title)
        if output_dir and slug:
            folder = os.path.join(output_dir, f"{safe_name}_{slug}")
        elif overwrite:
            import glob
            import shutil

            for old in glob.glob(os.path.join(_REPORTS_DIR, f"{safe_name}_*")):
                shutil.rmtree(old)
            folder = os.path.join(_REPORTS_DIR, safe_name)
        else:
            folder = output_dir or os.path.join(_REPORTS_DIR, f"{safe_name}_{timestamp}")
        os.makedirs(folder, exist_ok=True)

        self._diagrams = []
        word_path = self._render_docx(report, folder, tone=tone)
        pdf_path = self._convert_to_pdf(word_path, folder)

        return {
            "word": word_path,
            "pdf": pdf_path,
            "pdf_ok": bool(pdf_path),
            "folder": folder,
            "title": title,
            "tone": tone,
            "diagrams": self._diagrams,
        }

    # ── 内部方法 ──────────────────────────────────────────────

    def _render_docx(self, report: ParsedReport, folder: str, tone: str = "neutral") -> str:
        """渲染 Word 文档，保存网络图到输出目录。"""
        from docx_renderer import render_docx

        output_path = os.path.join(folder, f"{self._safe_filename(report.title)}.docx")
        # 重置图表列表
        self._diagrams = []
        render_docx(
            report, output_path, self.config,
            output_folder=folder,
            diagram_collector=self._diagrams,
            tone=tone,
        )
        return output_path

    def _convert_to_pdf(self, docx_path: str, folder: str) -> str:
        """将 .docx 转换为 .pdf。成功返回 pdf 路径，失败返回空字符串。"""
        try:
            from pdf_converter import convert_to_pdf

            pdf_path = os.path.join(
                folder,
                os.path.splitext(os.path.basename(docx_path))[0] + ".pdf",
            )
            result = convert_to_pdf(docx_path, pdf_path)
            return result or ""
        except (ImportError, Exception) as e:
            # PDF 转换失败时返回空字符串，不阻塞主流程，但显式告警
            import warnings
            warnings.warn(f"⚠️ PDF 转换失败（不影响 Word 输出，但本报告无 PDF 文件）: {e}")
            return ""

    @staticmethod
    def _safe_filename(name: str) -> str:
        """将任意字符串转为安全的文件名。"""
        safe = ""
        for ch in name:
            if ch.isalnum() or ch in "-_.":
                safe += ch
            elif ch in " ()（）":
                safe += "_"
            else:
                safe += "_"
        # 去除连续下划线
        import re
        safe = re.sub(r"_+", "_", safe).strip("_")
        return safe if safe else "report"

    @property
    def version(self) -> str:
        return _ENGINE_VERSION


# ── 快捷函数 ──────────────────────────────────────────────────

def export_report(
    title: str,
    body: str,
    *,
    output_dir: Optional[str] = None,
    slug: Optional[str] = None,
) -> dict[str, str]:
    """一键导出：创建引擎 → 导出报告。"""
    engine = CaseAnalysisEngine()
    return engine.export_from_text(title, body, output_dir=output_dir, slug=slug)


def diagnose_pdf() -> dict:
    """诊断当前环境可用的 PDF 转换器（避免静默失败）。"""
    from pdf_converter import diagnose_pdf as _diag

    return _diag()
