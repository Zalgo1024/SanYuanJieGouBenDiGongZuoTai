"""异步 run worker — 用 threading 后台执行内核调用。

状态机：pending → running → success / failed
- pending:  刚创建 run 记录，未开始
- running:  worker 线程已启动，正在调内核
- success:  内核返回，产物+sections+graphs 已入库，report_id 已设
- failed:   内核抛异常，error 字段记录错误信息

run.log 实时追加（前端轮询 GET /runs/{id} 拿最新 log）。
"""
import os
import threading
import traceback
from typing import Optional

import db
from settings import PROJECTS_DIR
from kernel_adapter import run_kernel
from translator import translate


def _run_output_dir(project_id: int, run_id: int) -> str:
    """每次 run 的产物根目录：runtime/projects/{pid}/runs/{rid}。"""
    d = os.path.join(str(PROJECTS_DIR), str(project_id), "runs", str(run_id))
    os.makedirs(d, exist_ok=True)
    return d


def _execute_run(run_id: int, project_id: int, title: str, body: str, tone: str) -> None:
    """后台线程主体。任何异常都不向上抛（线程内吞掉），写 failed 状态。"""
    try:
        db.append_run_log(run_id, f"启动生成任务：{title}")
        db.set_run_status(run_id, "running")
        db.append_run_log(run_id, f"正文长度={len(body)} DIAGRAM块数={body.count('```DIAGRAM')}")
        # DEBUG: 用 parser 直接解析，看 diagram 块是否被识别
        try:
            from translator import _collect_diagrams
            diags = _collect_diagrams(body)
            db.append_run_log(run_id, f"parser 识别到 diagram 块：{len(diags)}")
            for i, d in enumerate(diags):
                db.append_run_log(run_id, f"  diag[{i}] viz={d.get('viz')!r} title={d.get('title')!r} nodes={len(d.get('nodes') or [])}")
        except Exception as e:
            db.append_run_log(run_id, f"parser 诊断失败: {e}")
        db.append_run_log(run_id, "正在调用本地内核 export_from_text ...")

        output_dir = _run_output_dir(project_id, run_id)
        kernel_result = run_kernel(
            title=title,
            body=body,
            output_dir=output_dir,
            slug=str(run_id),
            tone=tone,
        )

        db.append_run_log(
            run_id,
            f"内核完成：word={os.path.basename(kernel_result.get('word') or '')}, "
            f"pdf_ok={kernel_result.get('pdf_ok')}, "
            f"diagrams={len(kernel_result.get('diagrams') or [])}",
        )
        # DEBUG: 详列 diagrams 内容
        for i, diag in enumerate(kernel_result.get("diagrams") or []):
            db.append_run_log(
                run_id,
                f"  diagram[{i}]: title={diag.get('title')!r} png={os.path.basename(diag.get('png') or '')} html={os.path.basename(diag.get('html') or '')}",
            )
        # DEBUG: 列出产物目录下的所有文件
        folder = kernel_result.get("folder") or ""
        if folder and os.path.isdir(folder):
            for f in sorted(os.listdir(folder)):
                fp = os.path.join(folder, f)
                size = os.path.getsize(fp) if os.path.isfile(fp) else 0
                db.append_run_log(run_id, f"  file: {f} ({size} bytes)")

        db.append_run_log(run_id, "正在解析 sections / graphs / artifacts ...")
        translated = translate(body, kernel_result, run_id)

        report = db.create_report(
            run_id=run_id,
            project_id=project_id,
            title=title,
            tone=tone,
            pdf_ok=bool(kernel_result.get("pdf_ok")),
            sections=translated["sections"],
            graphs=translated["graphs"],
            artifacts=translated["artifacts"],
            cover_graph_url=translated["cover_graph_url"],
            output_dir=kernel_result.get("folder") or output_dir,
        )
        report_id = report["id"]

        db.append_run_log(run_id, f"报告已入库：report_id={report_id}")
        db.set_run_status(run_id, "success", report_id=report_id)

        # 同步项目状态为已生成
        db.update_project_status(project_id, "generated")

    except Exception as exc:
        msg = f"{type(exc).__name__}: {exc}"
        db.append_run_log(run_id, f"任务失败：{msg}")
        db.append_run_log(run_id, traceback.format_exc())
        db.set_run_status(run_id, "failed", error=msg)


def start_run_worker(*, run_id: int, project_id: int, title: str, body: str,
                     tone: str = "neutral") -> threading.Thread:
    """启动后台线程执行 run。返回 thread 对象（不 join）。"""
    t = threading.Thread(
        target=_execute_run,
        args=(run_id, project_id, title, body, tone),
        name=f"run-{run_id}",
        daemon=True,
    )
    t.start()
    return t
