"""pytest 公共夹具 —— 让整套测试在「隔离环境」中运行，不污染开发数据。

隔离策略：
1. 临时目录：所有测试产物（测试库、配置、生成报告）写入系统临时目录。
2. 数据库：重建 app.db.engine / SessionLocal 指向临时 SQLite，避免动到 backend/data/app.db。
3. 配置/密钥存储：把 config_store / llm_settings_store 的落盘路径改到临时文件。
4. 生成目录：GENERATED_DIR 指向临时目录（在导入 app 之前设置环境变量）。

注意：db / config 的补丁必须在 import app.main 之前完成。本文件在 pytest 收集阶段
最早被加载，_test_env 是 session 级夹具，client 依赖它，保证补丁先于任何 app 导入生效。
"""
import os
import tempfile
from pathlib import Path

import pytest

# 在导入任何 app 模块之前，先确定隔离临时目录并注入 GENERATED_DIR。
_TEST_TMP = Path(tempfile.mkdtemp(prefix="tsap_test_"))
os.environ["GENERATED_DIR"] = str(_TEST_TMP / "generated")


@pytest.fixture(scope="session")
def _test_env():
    """为整个测试会话打补丁：隔离 DB、配置、密钥存储。"""
    from sqlalchemy import create_engine, event
    from sqlalchemy.orm import sessionmaker

    import app.db as dbmod

    db_path = _TEST_TMP / "test_app.db"
    eng = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False, "timeout": 30},
        future=True,
    )

    @event.listens_for(eng, "connect")
    def _set_pragma(dbapi_conn, _record):  # noqa: ANN001
        cur = dbapi_conn.cursor()
        try:
            cur.execute("PRAGMA journal_mode=WAL")
            cur.execute("PRAGMA busy_timeout=30000")
        finally:
            cur.close()

    dbmod.engine = eng
    dbmod.SessionLocal = sessionmaker(bind=eng, autoflush=False, autocommit=False, future=True)
    dbmod.DB_PATH = db_path

    import app.config_store as cfgstore
    import app.llm_settings_store as llms

    cfgstore._STORE_PATH = _TEST_TMP / "app_config.json"
    llms._STORE_PATH = _TEST_TMP / "llm_settings.json"

    yield {"tmp": _TEST_TMP, "db_path": db_path}


@pytest.fixture(scope="session")
def tmp_root(_test_env):
    return _TEST_TMP


@pytest.fixture(scope="session")
def client(_test_env):
    """FastAPI TestClient（触发 startup：建表 / 种子 / 启动工人池）。"""
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def fixtures_dir():
    return Path(__file__).resolve().parent / "fixtures"


@pytest.fixture(scope="session")
def sample_event(fixtures_dir):
    import json

    return json.loads((fixtures_dir / "sample_event.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="session")
def sample_policy(fixtures_dir):
    import json

    return json.loads((fixtures_dir / "sample_policy.json").read_text(encoding="utf-8"))
