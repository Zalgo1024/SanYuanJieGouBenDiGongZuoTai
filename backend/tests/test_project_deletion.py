def test_bulk_delete_accepts_legacy_string_diagram_entries(client):
    """旧验证任务把 diagrams 存成 ["d1"]，删除时也应安全跳过。"""
    from app.db import SessionLocal
    from app.models import Project, Task

    project_id = "legacy_diagram_delete_project"
    task_id = "legacy_diagram_delete_task"
    with SessionLocal() as db:
        db.add(Project(id=project_id, name="旧图表项目", status="已完成", progress="100%"))
        db.add(
            Task(
                id=task_id,
                title="旧图表任务",
                input_text="测试",
                project_id=project_id,
                status="done",
                result={"word": "fake.docx", "diagrams": ["d1"]},
            )
        )
        db.commit()

    response = client.request(
        "DELETE",
        "/api/projects",
        json={"ids": [project_id], "confirm": True},
    )

    assert response.status_code == 200
    assert response.json()["failed"] == []
    assert response.json()["deleted_count"] == 1
    with SessionLocal() as db:
        assert db.get(Project, project_id) is None
        assert db.get(Task, task_id) is None
