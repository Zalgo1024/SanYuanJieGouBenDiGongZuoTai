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


def test_profile_resolution_never_falls_back_to_server_key(monkeypatch, tmp_root):
    import app.llm_settings_store as store

    monkeypatch.setattr(store, "_PROFILES_DIR", tmp_root / "llm_profiles_resolution")
    monkeypatch.setattr(store.settings, "deepseek_api_key", "owner-server-key")

    missing = store.resolve_config({"profile_id": "missing-profile-111111111111"})
    assert missing["api_key"] == ""
    assert missing["source"] == "profile_missing"

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


def test_deleting_profile_removes_its_key(client, monkeypatch, tmp_root):
    import app.llm_settings_store as store

    monkeypatch.setattr(store, "_PROFILES_DIR", tmp_root / "llm_profiles_delete")
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
