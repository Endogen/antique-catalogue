from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.auth import RegisterRequest, ResetPasswordRequest, VerifyRequest


def test_register_request_normalizes_email() -> None:
    request = RegisterRequest(email="  Collector@Example.com ", password="strongpass")
    assert request.email == "collector@example.com"


def test_register_request_rejects_invalid_email() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest(email="not-an-email", password="strongpass")


def test_register_request_rejects_short_password() -> None:
    with pytest.raises(ValidationError):
        RegisterRequest(email="collector@example.com", password="short")


def test_verify_request_rejects_blank_token() -> None:
    with pytest.raises(ValidationError):
        VerifyRequest(token="   ")


def test_reset_request_rejects_blank_token() -> None:
    with pytest.raises(ValidationError):
        ResetPasswordRequest(token=" ", password="strongpass")
