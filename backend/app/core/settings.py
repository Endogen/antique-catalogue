from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
REPO_DIR = BASE_DIR.parent
DEFAULT_DB_FILENAME = "antique_catalogue.db"
SQLITE_PREFIX = "sqlite:///"


def _sqlite_url_from_path(path: Path, query: str | None = None) -> str:
    url = f"sqlite:///{path.as_posix()}"
    if query:
        url = f"{url}?{query}"
    return url


def _normalize_sqlite_url(database_url: str) -> str:
    if not database_url.startswith(SQLITE_PREFIX):
        return database_url
    if database_url.startswith("sqlite:////") or database_url.startswith("sqlite:///:memory:"):
        return database_url

    relative_with_query = database_url[len(SQLITE_PREFIX) :]
    if relative_with_query.startswith("/"):
        return database_url

    path_part, sep, query = relative_with_query.partition("?")
    if path_part == ":memory:":
        return database_url

    resolved_path = (BASE_DIR / path_part).resolve()
    return _sqlite_url_from_path(resolved_path, query if sep else None)


def _default_database_url() -> str:
    candidates = [
        BASE_DIR / "data" / DEFAULT_DB_FILENAME,
        BASE_DIR / DEFAULT_DB_FILENAME,
        REPO_DIR / "data" / DEFAULT_DB_FILENAME,
        REPO_DIR / DEFAULT_DB_FILENAME,
    ]

    existing = [path for path in candidates if path.exists()]
    if existing:
        chosen = max(existing, key=lambda path: path.stat().st_mtime)
        return _sqlite_url_from_path(chosen.resolve())

    default_path = candidates[0]
    default_path.parent.mkdir(parents=True, exist_ok=True)
    return _sqlite_url_from_path(default_path.resolve())


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


# Recognizable dev-only default; long enough to satisfy the 32-byte minimum
# HMAC key length for HS256 (RFC 7518) so local runs stay warning-free.
DEV_JWT_SECRET = "insecure-development-secret-change-me"
INSECURE_JWT_SECRETS = {"", "change-me", DEV_JWT_SECRET}
MIN_JWT_SECRET_LENGTH = 32


@dataclass(frozen=True)
class Settings:
    app_env: str
    database_url: str
    jwt_secret: str
    jwt_algorithm: str
    jwt_access_token_expire_minutes: int
    refresh_token_cookie_path: str
    refresh_token_cookie_secure: bool
    auto_verify_email: bool
    admin_email: str | None
    admin_password: str | None
    admin_token_expire_minutes: int
    smtp_host: str | None
    smtp_port: int
    smtp_user: str | None
    smtp_password: str | None
    smtp_from: str | None
    smtp_use_tls: bool
    uploads_path: str
    public_app_url: str = "http://localhost:3010"

    @property
    def uploads_dir(self) -> Path:
        return Path(self.uploads_path).expanduser().resolve()


@lru_cache
def get_settings() -> Settings:
    raw_database_url = _get_first_env("DATABASE_URL", "DB_URL")
    if raw_database_url:
        database_url = _normalize_sqlite_url(raw_database_url)
    else:
        database_url = _default_database_url()

    app_env = os.environ.get("APP_ENV", "development").strip().lower() or "development"
    jwt_secret = os.environ.get("JWT_SECRET", DEV_JWT_SECRET)
    if app_env == "production" and (
        jwt_secret in INSECURE_JWT_SECRETS or len(jwt_secret) < MIN_JWT_SECRET_LENGTH
    ):
        raise RuntimeError(
            "JWT_SECRET must be set to a strong secret of at least "
            f"{MIN_JWT_SECRET_LENGTH} characters when APP_ENV=production"
        )

    return Settings(
        app_env=app_env,
        public_app_url=os.environ.get("PUBLIC_APP_URL", "http://localhost:3010"),
        database_url=database_url,
        jwt_secret=jwt_secret,
        jwt_algorithm=os.environ.get("JWT_ALGORITHM", "HS256"),
        jwt_access_token_expire_minutes=_get_int_env(
            "JWT_ACCESS_TOKEN_EXPIRE_MINUTES",
            30,
        ),
        refresh_token_cookie_path=_get_first_env(
            "REFRESH_TOKEN_COOKIE_PATH",
            default="/",
        )
        or "/",
        refresh_token_cookie_secure=_get_bool_env("REFRESH_TOKEN_COOKIE_SECURE", False),
        auto_verify_email=_get_bool_env("AUTO_VERIFY_EMAIL", False),
        admin_email=os.environ.get("ADMIN_EMAIL"),
        admin_password=os.environ.get("ADMIN_PASSWORD"),
        admin_token_expire_minutes=_get_int_env("ADMIN_TOKEN_EXPIRE_MINUTES", 60),
        smtp_host=os.environ.get("SMTP_HOST"),
        smtp_port=_get_int_env("SMTP_PORT", 587),
        smtp_user=os.environ.get("SMTP_USER"),
        smtp_password=os.environ.get("SMTP_PASSWORD"),
        smtp_from=os.environ.get("SMTP_FROM"),
        smtp_use_tls=_get_bool_env("SMTP_USE_TLS", True),
        uploads_path=_get_first_env("UPLOADS_PATH", "UPLOADS_DIR", default="uploads"),
    )


settings = get_settings()
