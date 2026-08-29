"""浏览器级 BYOK 配置：隔离用户密钥，并禁止回退到服务器管理员密钥。"""


def test_profile_settings_are_isolated_and_never_return_plaintext_key(
    client, monkeypatch, tmp_root
):
    import app.llm_settings_store as store

    monkeypatch.setattr(store, "_PROFILES_DIR", tmp_root / "llm_profiles")
    first = "browser-profile-111111111111"
    second = "browser-profile-222222222222"

    saved = client.post(
        f"/api/settings/llm/profiles/{first}",
        json={
            "provider": "deepseek",
            "api_key": "sk-first-private-key",
            "base_url": "https://api.deepseek.com",
            "model": "deepseek-chat",
            "temperature": 0.3,
        },
    )
    assert saved.status_code == 200
    assert saved.json()["has_key"] is True
    assert "api_key" not in saved.json()
    assert "sk-first-private-key" not in saved.text

    updated = client.post(
        f"/api/settings/llm/profiles/{first}",
        json={"provider": "deepseek", "api_key": "", "model": "deepseek-reasoner"},
    )
    assert updated.json()["model"] == "deepseek-reasoner"
    assert store.resolve_config({"profile_id": first})["api_key"] == "sk-first-private-key"

    empty = client.get(f"/api/settings/llm/profiles/{second}")
    assert empty.status_code == 200
    assert empty.json()["has_key"] is False


def test_profile_resolution_uses_profile_key_first_and_falls_back_to_env(
    monkeypatch, tmp_root
):
    """BYOK profile 有 key 时优先；profile 缺失/无 key 时回退服务器 .env 密钥，
    保证「关键词输入 → LLM 拆解 → 搜索 → 报告」工作流在未配置 profile 时仍可用。
    """
    import app.llm_settings_store as store

    monkeypatch.setattr(store, "_PROFILES_DIR", tmp_root / "llm_profiles_resolution")
    monkeypatch.setattr(store.settings, "deepseek_api_key", "owner-server-key")

    # profile 缺失 → 回退 .env 密钥
    missing = store.resolve_config({"profile_id": "missing-profile-111111111111"})
    assert missing["api_key"] == "owner-server-key"
    assert missing["source"] == "env"

    # profile 显式配置了 key → 仍优先使用 BYOK，不回退
    store.save_profile_settings(
        "configured-profile-111111111",
        {
            "provider": "deepseek",
            "api_key": "visitor-key",
            "model": "deepseek-chat",
        },
    )
    configured = store.resolve_config(
        {"profile_id": "configured-profile-111111111"}
    )
    assert configured["api_key"] == "visitor-key"
    assert configured["source"] == "profile"

    # profile 存在但未配 key（api_key 为空）→ 同样回退 .env
    store.save_profile_settings(
        "empty-profile-11111111111",
        {"provider": "deepseek", "api_key": "", "model": "deepseek-chat"},
    )
    empty = store.resolve_config({"profile_id": "empty-profile-11111111111"})
    assert empty["api_key"] == "owner-server-key"
    assert empty["source"] == "env"


def test_deleting_profile_removes_its_key(client, monkeypatch, tmp_root):
    import app.llm_settings_store as store

    monkeypatch.setattr(store, "_PROFILES_DIR", tmp_root / "llm_profiles_delete")
    # 清空服务器密钥，避免 profile 删除后被 .env 兜底影响断言
    monkeypatch.setattr(store.settings, "deepseek_api_key", "")
    monkeypatch.setattr(store.settings, "openai_api_key", "")
    profile_id = "browser-profile-delete-1111111"
    client.post(
        f"/api/settings/llm/profiles/{profile_id}",
        json={"provider": "openai", "api_key": "temporary-secret"},
    )

    response = client.delete(f"/api/settings/llm/profiles/{profile_id}")

    assert response.status_code == 200
    assert response.json()["has_key"] is False
    assert store.resolve_config({"profile_id": profile_id})["api_key"] == ""


def test_legacy_single_machine_settings_still_load(monkeypatch, tmp_root):
    import app.llm_settings_store as store

    monkeypatch.setattr(store, "_STORE_PATH", tmp_root / "legacy_llm_settings.json")
    store.save_settings(
        {"provider": "deepseek", "api_key": "legacy-key", "model": "deepseek-chat"}
    )

    assert store.load_settings()["api_key"] == "legacy-key"
    assert store.resolve_config()["source"] == "store"


def test_public_global_settings_write_endpoint_is_disabled(client):
    response = client.post(
        "/api/settings/llm",
        json={"provider": "deepseek", "api_key": "must-not-become-global"},
    )

    assert response.status_code == 410
    assert "个人 AI 连接" in response.text


def test_public_analysis_never_accepts_server_key_without_profile(monkeypatch):
    import app.routers.analyze as analyze
    import app.llm_settings_store as store

    monkeypatch.setattr(store.settings, "deepseek_api_key", "owner-key")
    assert analyze.llm_is_available(None) is False


def test_extended_providers_are_accepted(client, monkeypatch, tmp_root):
    """新服务商（智谱/千问/Kimi/硅基流动/OpenRouter/Ollama）按 OpenAI 兼容端点保存。"""
    import app.llm_settings_store as store

    monkeypatch.setattr(store, "_PROFILES_DIR", tmp_root / "llm_profiles_providers")
    profile_id = "browser-profile-providers-111"
    saved = client.post(
        f"/api/settings/llm/profiles/{profile_id}",
        json={
            "provider": "zhipu",
            "api_key": "zhipu-key",
            "base_url": "https://open.bigmodel.cn/api/paas/v4",
            "model": "glm-4.6",
        },
    )
    assert saved.status_code == 200
    assert saved.json()["provider"] == "zhipu"

    resolved = store.resolve_config({"profile_id": profile_id})
    assert resolved["api_key"] == "zhipu-key"
    assert resolved["base_url"] == "https://open.bigmodel.cn/api/paas/v4"
    assert resolved["model"] == "glm-4.6"

    # 未知 provider 归一化为 compatible，不会被随意保存
    fallback = client.post(
        f"/api/settings/llm/profiles/{profile_id}",
        json={"provider": "not-a-provider", "api_key": "", "model": "m"},
    )
    assert fallback.json()["provider"] == "compatible"


def test_public_mode_blocks_server_key_fallback(monkeypatch, tmp_root):
    """PUBLIC_MODE=1：profile 缺失/为空时不再回退服务器密钥，访客必须自带。"""
    import app.llm_settings_store as store

    monkeypatch.setattr(store, "_PROFILES_DIR", tmp_root / "llm_profiles_public")
    monkeypatch.setattr(store.settings, "deepseek_api_key", "owner-server-key")
    monkeypatch.setattr(store.settings, "public_mode", True)

    missing = store.resolve_config({"profile_id": "missing-profile-111111111111"})
    assert missing["api_key"] == ""
    assert missing["source"] == "profile_missing"

    # 全局入口（无 profile）同样拿不到服务器密钥
    global_cfg = store.resolve_config({})
    assert global_cfg["api_key"] == ""
    assert global_cfg["source"] == "none"

    # 访客自带 BYOK 仍然可用
    store.save_profile_settings(
        "visitor-profile-1111111111",
        {"provider": "kimi", "api_key": "visitor-key", "model": "moonshot-v1-32k"},
    )
    configured = store.resolve_config({"profile_id": "visitor-profile-1111111111"})
    assert configured["api_key"] == "visitor-key"
    assert configured["source"] == "profile"


def test_llm_test_endpoint_reports_config_errors(client):
    """测试连接端点：缺 key / 缺地址时返回结构化失败，不产生网络请求。"""
    response = client.post(
        "/api/settings/llm/test",
        json={"provider": "deepseek", "api_key": "", "base_url": "", "model": ""},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is False
    assert data["kind"] == "config"


def test_llm_test_endpoint_uses_profile_key_when_blank(client, monkeypatch, tmp_root):
    """留空 api_key 时可用 profile_id 取已保存密钥；连接函数被 mock，不发真实请求。"""
    import app.llm_client as llm_client
    import app.llm_settings_store as store

    monkeypatch.setattr(store, "_PROFILES_DIR", tmp_root / "llm_profiles_test_ep")
    profile_id = "browser-profile-test-endpoint-1"
    client.post(
        f"/api/settings/llm/profiles/{profile_id}",
        json={"provider": "deepseek", "api_key": "stored-key", "model": "deepseek-chat"},
    )

    captured = {}

    def fake_test_connection(api_key, base_url, model, timeout=15.0):
        captured["api_key"] = api_key
        captured["model"] = model
        return {"ok": True, "kind": "", "message": "ok"}

    monkeypatch.setattr(llm_client, "test_connection", fake_test_connection)
    response = client.post(
        "/api/settings/llm/test",
        json={"provider": "deepseek", "api_key": "", "model": "deepseek-chat", "profile_id": profile_id},
    )
    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert captured["api_key"] == "stored-key"
