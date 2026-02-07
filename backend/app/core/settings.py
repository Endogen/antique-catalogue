from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


def _get_first_env(*names: str, default: str | None = None) -> str | None:
    for name in names:
        value = os.environ.get(name)
        if value:
            return value
    return default


def _get_int_env(name: str, default: int) -> int:
    value = os.environ.get(name)
    if value is None or value == "":
        return default
    return int(value)


def _get_bool_env(name: str, default: bool) -> bool:
    value = os.environ.get(name)
    if value is None or value == "":
        return default
    return value.lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    database_url: str
    jwt_secret: str
    jwt_algorithm: str
    jwt_access_token_expire_minutes: int
    smtp_host: str | None
    smtp_port: int
    smtp_user: str | None
    smtp_password: str | None
    smtp_from: str | None
    smtp_use_tls: bool
    uploads_path: str

    @property
    def uploads_dir(self) -> Path:
        return Path(self.uploads_path).expanduser().resolve()


@lru_cache
def get_settings() -> Settings:
    return Settings(
        database_url=_get_first_env(
            "DATABASE_URL",
            "DB_URL",
            default="sqlite:///./antique_catalogue.db",
        ),
        jwt_secret=os.environ.get("JWT_SECRET", "change-me"),
        jwt_algorithm=os.environ.get("JWT_ALGORITHM", "HS256"),
        jwt_access_token_expire_minutes=_get_int_env(
            "JWT_ACCESS_TOKEN_EXPIRE_MINUTES",
            30,
        ),
        smtp_host=os.environ.get("SMTP_HOST"),
        smtp_port=_get_int_env("SMTP_PORT", 587),
        smtp_user=os.environ.get("SMTP_USER"),
        smtp_password=os.environ.get("SMTP_PASSWORD"),
        smtp_from=os.environ.get("SMTP_FROM"),
        smtp_use_tls=_get_bool_env("SMTP_USE_TLS", True),
        uploads_path=_get_first_env("UPLOADS_PATH", "UPLOADS_DIR", default="uploads"),
    )


settings = get_settings()
