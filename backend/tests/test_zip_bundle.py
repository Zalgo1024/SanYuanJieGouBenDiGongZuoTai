"""组合下载：Word+PDF+PPT+Markdown+利益关系网络图 → 一个 zip 包。"""

import io
import zipfile


def _seed_report(db, task_id="zip-task-1"):
    from app.models import ReportVersion, Task

    db.add(
        Task(
            id=task_id,
            title="打包测试报告",
            input_text="测试",
            analysis_type="case",
            status="done",
            result={"word": None, "pdf": None, "diagrams": []},
        )
    )
    db.add(
        ReportVersion(
            id="zip-version-1",
            task_id=task_id,
            kind="original",
            version_no=1,
            content_markdown=(
                "# 打包测试报告\n\n"
                "## 情况概述\n\n一段概述。\n\n"
                "## 核心冲突点\n\n- 冲突一\n- 冲突二"
            ),
            is_current=1,
        )
    )
    db.commit()


def test_zip_bundle_contains_md_pptx_and_diagrams(client, tmp_path, monkeypatch):
    from app.db import SessionLocal
    from app.settings import settings

    monkeypatch.setattr(settings, "generated_dir", str(tmp_path))
    with SessionLocal() as db:
        _seed_report(db)

    response = client.get("/api/download/zip-task-1?kind=zip")

    assert response.status_code == 200
    with zipfile.ZipFile(io.BytesIO(response.content)) as zf:
        names = "\n".join(zf.namelist())
        assert ".md" in names
        assert ".pptx" in names
        # 无 word/pdf 产物时允许缺失（复用逻辑），zip 仍须可解压
        assert len(zf.namelist()) >= 2


def test_zip_bundle_reuses_stored_word_and_pdf(client, tmp_path, monkeypatch):
    import os

    from app.db import SessionLocal
    from app.settings import settings

    monkeypatch.setattr(settings, "generated_dir", str(tmp_path))
    word = tmp_path / "bundle.docx"
    pdf = tmp_path / "bundle.pdf"
    word.write_bytes(b"%PDF-1.4 fake-word")
    pdf.write_bytes(b"%PDF-1.4 fake-pdf")

    with SessionLocal() as db:
        from app.models import ReportVersion, Task

        db.add(
            Task(
                id="zip-task-2",
                title="复用产物测试",
                input_text="测试",
                analysis_type="case",
                status="done",
                result={"word": str(word), "pdf": str(pdf), "diagrams": []},
            )
        )
        db.add(
            ReportVersion(
                id="zip-version-2",
                task_id="zip-task-2",
                kind="original",
                version_no=1,
                content_markdown="# 复用产物测试\n\n## 情况概述\n\n正文。",
                is_current=1,
            )
        )
        db.commit()

    response = client.get("/api/download/zip-task-2?kind=zip")

    assert response.status_code == 200
    with zipfile.ZipFile(io.BytesIO(response.content)) as zf:
        names = "\n".join(zf.namelist())
        assert ".docx" in names
        assert ".pdf" in names
        assert ".pptx" in names
        assert ".md" in names
