"""路径与运行时配置。

单机本地部署：
- PROJECT_ROOT: 项目根（内核 engine.py / parser.py 所在目录）
- RUNTIME_DIR:  后端运行时数据目录（SQLite + 项目产物）
- DB_PATH:      SQLite 数据库文件
- KERNEL_OUR_DIR 在 output_dir 下用 slug=run_id 隔离每次产物，避免并发覆盖。
"""
import os
from pathlib import Path

# backend/ 的父目录就是项目根（engine.py/parser.py 所在）
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent

# 内核模块从项目根导入
KERNEL_SYS_PATH = str(PROJECT_ROOT)

RUNTIME_DIR = BACKEND_DIR / "runtime"
RUNTIME_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = RUNTIME_DIR / "app.db"

# 每个项目的产物根目录
PROJECTS_DIR = RUNTIME_DIR / "projects"

# CORS 放行：前端 Next.js dev 端口
CORS_ALLOW_ORIGINS = [
    "http://127.0.0.1:3000",
    "http://localhost:3000",
]

# 服务绑定
HOST = "127.0.0.1"
PORT = 8000

# 对外暴露的基础 URL（前端跨端口下载文件用）。
# 默认 http://127.0.0.1:8000；可被环境变量 PUBLIC_BASE_URL 覆盖。
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", f"http://{HOST}:{PORT}").rstrip("/")

# 单租户占位（云就绪：未来从请求头取 tenant_id）
DEFAULT_TENANT_ID = 1
