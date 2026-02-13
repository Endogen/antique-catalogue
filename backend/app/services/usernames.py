from __future__ import annotations

import re

USERNAME_MAX_LENGTH = 12
USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")


def normalize_username(value: str) -> str:
    return value.strip().lower()


def _validate_username_format(normalized: str) -> None:
    if not normalized:
        raise ValueError("Username is required")
    if len(normalized) > USERNAME_MAX_LENGTH:
        raise ValueError(f"Username must be at most {USERNAME_MAX_LENGTH} characters")
    if not USERNAME_PATTERN.fullmatch(normalized):
        raise ValueError("Username can only contain letters, numbers, hyphens, and underscores")


def validate_username_for_user(value: str, *, user_id: int) -> str:
    normalized = normalize_username(value)
    _validate_username_format(normalized)
    if normalized.isdigit() and normalized != str(user_id):
        raise ValueError("Username cannot be only numbers")
    return normalized


def normalize_username_lookup(value: str) -> str:
    normalized = normalize_username(value)
    _validate_username_format(normalized)
    return normalized
