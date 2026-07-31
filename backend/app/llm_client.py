"""LLM 客户端抽象 — 生成半的核心可替换件。

- DeepSeekClient：真实调用（需 DEEPSEEK_API_KEY），走 OpenAI 兼容协议。
- OpenAIClient：真实调用（需 OPENAI_API_KEY）。
- MockClient：无密钥时的占位实现，产出一段合法 Markdown，用于跑通管线与验证契约。

generator 只依赖 BaseLLM 接口，未来可加 ClaudeClient / 本地模型 Client 而不动其它代码。
create_llm() 按 settings.llm_provider 选择实现。
"""
from abc import ABC, abstractmethod


# 占位报告正文（合法 Markdown，含一个 DIAGRAM 块，可被 parser + engine 消费）。
# 用 __TITLE__ 占位，避免 f-string 与 JSON 大括号冲突。
MOCK_MARKDOWN = """# __TITLE__

## 案例事实摘要

本段为 Mock 生成，用于验证「输入 → 报告」最小闭环。纯事实，不夹带分析。

**时间线**：
- 2026年X月 — 事件A发生
- 2026年Y月 — 事件B发生

## 分析框架说明

> 核心张力：一句话写出最说不通的地方。

**核心命题：一句话定义本报告要论证的核心判断。**

| 观察到的模式 | 选用的概念 | 概念如何解释 | 分析问题 |
|---|---|---|---|
| 模式描述 | 概念名 | 为什么选这个概念 | 要回答什么 |

## 三元结构分析正文

### 第一节：冲突式标题（主体A视角）

直接落笔具体事实，把概念自然编织进叙述中。

→ 子结论句

```DIAGRAM
{"viz": "network", "title": "利益关系图", "nodes": [{"id": "A", "label": "主体A", "type": "actor"}, {"id": "B", "label": "主体B", "type": "actor"}], "edges": [{"source": "A", "target": "B", "label": "流向", "type": "economic"}]}
```

## 结论

**汇流段**：把各节判断汇流成一句话。

**核心判断**：明确、有主见的结论。

> 可传播金句。

## 附录

**数据来源**：
1. [示例来源](https://example.com)

分析框架：三元结构理论 © 2026, CC BY-NC-SA 4.0，国作登字-2026-A-00048134
"""


class BaseLLM(ABC):
    @abstractmethod
    def generate(self, system_prompt: str, user_prompt: str, **kwargs) -> str:
        ...


class LLMError(Exception):
    """LLM 调用失败（已分类）。kind 用于前端精确提示，message 为中文可读原因。

    kind 取值：
      rate_limit 限流(429) | auth 鉴权失败 | balance 余额不足(402)
      timeout 超时 | connection 连接失败 | api_error 服务错误 | config 配置错误
    """

    def __init__(self, kind: str, message: str) -> None:
        self.kind = kind
        self.message = message
        super().__init__(message)


def _call_chat(client, model: str, messages: list, temperature: float, timeout: float = 60.0) -> str:
    """统一封装 OpenAI 兼容聊天调用：加超时、把异常分类为 LLMError。

    要求 openai SDK 已安装（懒导入，避免无 key 的 rule 模式下导入失败）。
    """
    from openai import (
        APIConnectionError,
        APIError,
        APIStatusError,
        APITimeoutError,
        AuthenticationError,
        RateLimitError,
    )

    try:
        resp = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            timeout=timeout,
        )
    except RateLimitError:
        raise LLMError(
            "rate_limit",
            "请求被限流（HTTP 429）：请稍后重试，或检查账户额度与请求频率。",
        )
    except AuthenticationError:
        raise LLMError("auth", "鉴权失败：API Key 无效或缺失。")
    except APITimeoutError:
        raise LLMError(
            "timeout",
            f"LLM 请求超时（>{int(timeout)}s）：服务响应过慢或网络不稳定。",
        )
    except APIConnectionError:
        raise LLMError(
            "connection", "无法连接 LLM 服务：请检查 base_url 与网络连通性。"
        )
    except APIStatusError as e:
        if e.status_code == 402:
            raise LLMError("balance", "账户余额不足（HTTP 402）：请充值后重试。")
        if e.status_code in (401, 403):
            raise LLMError("auth", f"鉴权失败（HTTP {e.status_code}）：API Key 无效。")
        raise LLMError(
            "api_error", f"LLM 服务返回错误（HTTP {e.status_code}）。"
        )
    except APIError as e:
        raise LLMError("api_error", f"LLM 服务错误：{e}")
    return resp.choices[0].message.content or ""


class MockClient(BaseLLM):
    def __init__(self, title: str = "Mock 验证报告") -> None:
        self.title = title

    def generate(self, system_prompt: str, user_prompt: str, **kwargs) -> str:
        return MOCK_MARKDOWN.replace("__TITLE__", self.title)


class OpenAIClient(BaseLLM):
    def __init__(self) -> None:
        from app.settings import settings
        from openai import OpenAI

        if not settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY 未设置，无法使用 OpenAIClient")
        base_url = settings.openai_base_url or None
        self.client = OpenAI(api_key=settings.openai_api_key, base_url=base_url)
        self.model = settings.openai_model

    def generate(self, system_prompt: str, user_prompt: str, **kwargs) -> str:
        return _call_chat(
            self.client,
            self.model,
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            kwargs.get("temperature", 0.7),
        )


class DeepSeekClient(BaseLLM):
    """DeepSeek 走 OpenAI 兼容协议（base_url=https://api.deepseek.com）。"""

    def __init__(self) -> None:
        from app.settings import settings
        from openai import OpenAI

        if not settings.deepseek_api_key:
            raise ValueError("DEEPSEEK_API_KEY 未设置，无法使用 DeepSeekClient")
        self.client = OpenAI(
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_base_url or "https://api.deepseek.com",
        )
        self.model = settings.deepseek_model

    def generate(self, system_prompt: str, user_prompt: str, **kwargs) -> str:
        return _call_chat(
            self.client,
            self.model,
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            kwargs.get("temperature", 0.7),
        )


class GenericOpenAIClient(BaseLLM):
    """通用 OpenAI 兼容端点客户端。

    支持任意 OpenAI 兼容服务（DeepSeek / OpenAI / Groq / OpenRouter / Azure /
    本地 Ollama http://localhost:11434/v1 等）。api_key / base_url / model 由
    调用方在运行时传入（来自用户设置），不依赖 backend .env。
    """

    def __init__(self, api_key: str, base_url: str | None = None, model: str = "gpt-4o") -> None:
        from openai import OpenAI

        if not api_key:
            raise ValueError("api_key 为空，无法使用 GenericOpenAIClient")
        self.client = OpenAI(api_key=api_key, base_url=base_url or None)
        self.model = model

    def generate(self, system_prompt: str, user_prompt: str, **kwargs) -> str:
        return _call_chat(
            self.client,
            self.model,
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            kwargs.get("temperature", 0.7),
        )


def create_llm() -> BaseLLM:
    """按 settings.llm_provider 选择实现；缺密钥时回退 Mock。"""
    from app.settings import settings

    if settings.llm_provider == "deepseek" and settings.deepseek_api_key:
        return DeepSeekClient()
    if settings.llm_provider == "openai" and settings.openai_api_key:
        return OpenAIClient()
    return MockClient()


def create_llm_from_config(request_cfg: dict | None = None):
    """从合并后的配置构造客户端；无可用 key 时回退 Mock。

    request_cfg 仅含模型/温度/提示词版本（**不含量钥**）。密钥由后端
    llm_settings_store.resolve_config 解析：用户设置文件 > .env > 无 key 回退 Mock。
    前端请求体永不携带 api_key，满足「API Key 不写入前端」。
    """
    from app.llm_settings_store import resolve_config

    cfg = resolve_config(request_cfg)
    if not cfg["api_key"]:
        return MockClient()
    return GenericOpenAIClient(
        api_key=cfg["api_key"],
        base_url=cfg["base_url"] or None,
        model=cfg["model"] or "gpt-4o",
    )
