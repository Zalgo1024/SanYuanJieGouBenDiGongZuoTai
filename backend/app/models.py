"""数据模型 — 账本里的「账页」（Phase 2.1）。

- Task：每一条分析任务（分析报告）的完整记录，替代原进程内存 dict。
- User：会员系统预留表（Phase 2.3 未启用，仅建好骨架，不写注册/登录逻辑）。
- Project：项目（分析报告归属），为阶段三前端接真实数据铺路；此处先建表 + 种子数据。

⚠️ 会员系统（注册/登录/多用户隔离）按用户要求「仅预留、暂不设计」，
   User 表与 Task.owner_id / Task.project_id 仅占位，当前所有接口仍视为单用户、无鉴权。
"""
from datetime import datetime, timezone
import uuid

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Float,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.db import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    """会员系统预留表（Phase 2.3 未启用，不写任何鉴权逻辑）。"""

    __tablename__ = "users"

    id = Column(String(32), primary_key=True)
    email = Column(String(255), unique=True, nullable=False)
    display_name = Column(String(120), nullable=True)
    hashed_password = Column(String(255), nullable=True)  # 预留：当前不写入
    created_at = Column(DateTime(timezone=True), default=_now)

    tasks = relationship("Task", back_populates="owner")


class Project(Base):
    """项目（分析报告归属）。阶段三前端项目页将读取此表。"""

    __tablename__ = "projects"

    id = Column(String(64), primary_key=True)  # 例如 "saige"
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(32), default="active")  # 进行中 / 已完成 / active ...
    subjects = Column(String(16), default="0")  # 利益主体数（种子值）
    interests = Column(String(16), default="0")  # 利益项数
    chapters = Column(String(16), default="0")  # 报告章节数
    progress = Column(String(16), default="0")  # 完成度
    owner_name = Column(String(120), nullable=True)
    is_archived = Column(Integer, default=0)  # 0=活跃 1=已归档（软删除）
    archived_at = Column(DateTime(timezone=True), nullable=True)
    # 会员系统预留（与 Task.owner_id 对齐，当前单用户默认「李政恒」）
    owner_id = Column(String(32), ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    tasks = relationship("Task", back_populates="project")


class Task(Base):
    """分析任务 / 分析报告（核心账页）。"""

    __tablename__ = "tasks"

    id = Column(String(32), primary_key=True)  # uuid4().hex
    title = Column(String(500), nullable=False)
    input_text = Column(Text, nullable=False)
    analysis_type = Column(String(32), default="case")  # case | policy

    status = Column(String(16), default="queued")  # queued|generating|done|error
    # —— 6 步分析进度链（inspect→search→decompose→network→organize→output）——
    phase = Column(String(32), nullable=True)       # 当前所处阶段（null=尚未开始）
    progress_pct = Column(Integer, default=0)        # 0-100 总进度百分比
    result = Column(JSON, nullable=True)  # 完成后：{markdown,word,pdf,diagrams,title}
    error = Column(Text, nullable=True)  # 失败后：人类可读错误摘要（不含完整堆栈）
    # —— 结构化错误信息（前端展示「重试」按钮 + 可读原因）——
    error_type = Column(String(64), nullable=True)   # 异常类名：如 RuntimeError / ValueError
    error_phase = Column(String(32), nullable=True)  # 失败阶段：validate|generate|export
    error_detail = Column(Text, nullable=True)      # 安全摘要（已脱敏路径/密钥）

    # —— 重试血缘：当前任务是某失败任务的「重试版」时指向原任务 ——
    retry_of = Column(
        String(32), ForeignKey("tasks.id"), nullable=True, index=True
    )
    attempt_no = Column(Integer, default=1)  # 第几次尝试（1=首次）

    # —— 生成模式（2.4 内置规则引擎 + 可选 LLM 插件）——
    mode = Column(String(16), default="rule")  # rule(默认,离线) | llm(可选插件)
    structured = Column(JSON, nullable=True)   # rule 模式：结构化输入
    llm_config = Column(JSON, nullable=True)    # llm 模式：每请求 {api_key,base_url,model}

    # —— 会员系统 / 项目归属预留（2.3 / 阶段三 未启用）——
    owner_id = Column(String(32), ForeignKey("users.id"), nullable=True)
    project_id = Column(String(64), ForeignKey("projects.id"), nullable=True)

    # —— 阶段三：分析使用到的材料（Material.id 列表，记录证据出处）——
    material_ids = Column(JSON, nullable=True)

    # —— 阶段五：全网搜索（可选增强）——
    search_enabled = Column(Boolean, nullable=True)  # None=自动 | True=强制搜索 | False=跳过
    search_results = Column(JSON, nullable=True)      # 搜索结果摘要 {query,snippets,sources,provider}

    # —— T8：联网写报告（web 开关 + 用户勾选来源白名单）——
    web = Column(Boolean, default=False)              # True=联网检索/抓取素材写报告
    source_urls = Column(JSON, nullable=True)          # 用户勾选白名单（null=自动检索全部）

    # —— 阶段四：LLM 增强模式元信息（仅在 llm 模式记录，便于复现与审计）——
    llm_model = Column(String(120), nullable=True)       # 实际使用的模型（如 deepseek-chat）
    llm_temperature = Column(Float, nullable=True)        # 采样温度
    prompt_version = Column(String(32), nullable=True)    # 提示词版本（可复现）
    llm_raw_response = Column(Text, nullable=True)        # LLM 原始响应（截断存储，调试用）

    created_at = Column(DateTime(timezone=True), default=_now)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    owner = relationship("User", back_populates="tasks")
    project = relationship("Project", back_populates="tasks")


class ReportVersion(Base):
    """报告版本 — 支持「原始生成版 / 人工修订版」双轨。

    - 每篇报告（Task）至少有一个 kind='original' 的版本，内容来自生成引擎产出的 Markdown；
      首次访问报告版本接口时自动播种，确保原始稿永不丢失。
    - 用户在编辑器里保存的修订，写入 kind='revised' 的新行；可有多条。
    - content_markdown 为权威文本（用于引擎再导出 Word/PDF）；content_html 为编辑器富文本快照。
    """

    __tablename__ = "report_versions"

    id = Column(String(32), primary_key=True, default=lambda: uuid.uuid4().hex)
    task_id = Column(
        String(32),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kind = Column(String(16), default="revised")  # original | revised
    content_markdown = Column(Text, nullable=False)
    content_html = Column(Text, nullable=True)
    note = Column(String(500), nullable=True)  # 修订说明
    editor = Column(String(120), nullable=True)  # 修订人（当前单用户；保存时取 settings.default_owner_name，可配置）
    created_at = Column(DateTime(timezone=True), default=_now)

    # —— T13：版本管理扩展（version_no 从 1 起；original 恒为 v1；is_current 回滚语义）——
    version_no = Column(Integer, default=1)              # v1/v2/v3…
    edited_by = Column(String(16), default="ai")         # human | ai
    summary = Column(String(500), nullable=True)         # 改动摘要
    is_current = Column(Integer, default=0)              # 0/1 当前版本标记

    task = relationship("Task")


class Material(Base):
    """输入材料 — 用户手动粘贴的长文本或上传的文件（.txt/.md/.docx/.pdf）。

    - 作为分析的证据 / 上下文来源，可在向导「证据与依据」步骤一键插入。
    - content_text 为解析后的纯文本（docx/pdf 已抽取正文），便于检索与插入。
    - source_type：paste(粘贴) | txt | md | docx | pdf。
    """

    __tablename__ = "materials"

    id = Column(String(32), primary_key=True, default=lambda: uuid.uuid4().hex)
    project_id = Column(
        String(64),
        ForeignKey("projects.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title = Column(String(200), nullable=False, default="未命名素材")
    content_text = Column(Text, nullable=False, default="")
    source_type = Column(String(16), default="paste")  # paste|txt|md|docx|pdf
    # —— 阶段三：来源 / 标签 / 解析告警 ——
    source = Column(String(500), nullable=True)        # 来源出处：链接 / 文号 / 出处说明
    tags = Column(String(500), nullable=True)          # 逗号分隔标签（如：政策,业主陈述）
    original_filename = Column(String(255), nullable=True)
    char_count = Column(Integer, default=0)
    # 解析告警（JSON 数组，如 ["pdf_text_empty","pdf_garbled","pdf_too_large"]）
    warnings = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_now)

    project = relationship("Project")
