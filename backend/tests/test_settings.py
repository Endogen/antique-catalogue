from __future__ import annotations

import pytest

from app.core import settings as settings_module


def _rebuild_settings():
    settings_module.get_settings.cache_clear()
    return settings_module.get_settings()


def test_production_rejects_default_jwt_secret(monkeypatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "change-me")
    try:
        with pytest.raises(RuntimeError, match="JWT_SECRET"):
            _rebuild_settings()

        monkeypatch.setenv("JWT_SECRET", "")
        with pytest.raises(RuntimeError, match="JWT_SECRET"):
            _rebuild_settings()

        monkeypatch.setenv("JWT_SECRET", "too-short")
        with pytest.raises(RuntimeError, match="JWT_SECRET"):
            _rebuild_settings()

        strong_secret = "a" * 48
        monkeypatch.setenv("JWT_SECRET", strong_secret)
        settings = _rebuild_settings()
        assert settings.app_env == "production"
        assert settings.jwt_secret == strong_secret
    finally:
        settings_module.get_settings.cache_clear()


def test_development_accepts_default_jwt_secret(monkeypatch) -> None:
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.delenv("JWT_SECRET", raising=False)
    try:
        settings = _rebuild_settings()
        assert settings.app_env == "development"
        assert settings.jwt_secret == settings_module.DEV_JWT_SECRET
        assert settings.refresh_token_cookie_secure is False
    finally:
        settings_module.get_settings.cache_clear()


def test_refresh_cookie_secure_flag(monkeypatch) -> None:
    monkeypatch.setenv("REFRESH_TOKEN_COOKIE_SECURE", "true")
    try:
        settings = _rebuild_settings()
        assert settings.refresh_token_cookie_secure is True
    finally:
        settings_module.get_settings.cache_clear()
