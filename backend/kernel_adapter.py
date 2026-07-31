"""内核适配层 — 唯一调用 CaseAnalysisEngine 的出口。

内核吃成稿 Markdown 正文（body），按章节哨兵自动识别报告类型，不收 analysis_type。
产物（docx/pdf/png/html）直接落到 output_dir，本层只读路径返回 URL。

调用方式：
    result = run_kernel(title, body, output_dir=..., slug=run_id)
    # result = {word, pdf, pdf_ok, folder, title, tone, diagrams}
    # diagrams = [{title, seq, png, html}, ...]
"""
import os
import sys
import threading
from typing import Optional

from settings import KERNEL_SYS_PATH

# 内核非线程安全（matplotlib/docx 共享状态），用全局锁串行化
_kernel_lock = threading.Lock()

_sys_path_ready = False
_sys_path_lock = threading.Lock()


def _ensure_sys_path():
    """首次调用时把项目根加入 sys.path（只做一次）。"""
    global _sys_path_ready
    if not _sys_path_ready:
        with _sys_path_lock:
            if not _sys_path_ready:
                if KERNEL_SYS_PATH not in sys.path:
                    sys.path.insert(0, KERNEL_SYS_PATH)
                _sys_path_ready = True


def run_kernel(title: str, body: str, *, output_dir: str, slug: str,
               tone: str = "neutral") -> dict:
    """调 export_from_text，返回内核原始 dict。

    每次创建新引擎实例，避免单例状态在长驻进程里累积导致 matplotlib/字体缓存
    在后台线程中行为不一致。

    Args:
        title: 报告标题。
        body:  成稿 Markdown 正文。
        output_dir: 产物根目录（runtime/projects/{pid}/runs/{rid}）。
        slug:  用 run_id 做子目录名，避免并发同名任务互相覆盖。
        tone:  neutral / provocative。
    """
    _ensure_sys_path()
    from engine import CaseAnalysisEngine  # type: ignore

    with _kernel_lock:
        # 每次新建引擎，避免 _diagrams 单例状态在多线程/多轮调用中错乱
        engine = CaseAnalysisEngine()
        os.makedirs(output_dir, exist_ok=True)
        result = engine.export_from_text(
            title,
            body,
            output_dir=output_dir,
            slug=slug,
            overwrite=False,
            tone=tone,
        )
    return result


def diagnose_pdf() -> dict:
    """透传内核的 PDF 诊断函数（启动排查用）。"""
    _ensure_sys_path()
    with _kernel_lock:
        from engine import diagnose_pdf as _diag  # type: ignore
        return _diag()
