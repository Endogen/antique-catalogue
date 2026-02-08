from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


def _normalize_email(value: str) -> str:
    normalized = value.strip().lower()
    local, at, domain = normalized.partition("@")
    if not at or not local or not domain or "." not in domain:
        raise ValueError("Invalid email address")
    return normalized


def _validate_password_strength(value: str) -> str:
    if value.strip() == "":
        raise ValueError("Password cannot be blank")
    if len(value) < 8:
        raise ValueError("Password must be at least 8 characters long")
    return value


class RegisterRequest(BaseModel):
    email: str = Field(..., examples=["collector@example.com"])
    password: str = Field(..., examples=["strong-password"])

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return _normalize_email(value)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return _validate_password_strength(value)


class LoginRequest(BaseModel):
    email: str = Field(..., examples=["collector@example.com"])
    password: str = Field(..., examples=["strong-password"])

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return _normalize_email(value)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return _validate_password_strength(value)


class VerifyRequest(BaseModel):
    token: str = Field(..., examples=["verification-token"])

    @field_validator("token")
    @classmethod
    def validate_token(cls, value: str) -> str:
        if value.strip() == "":
            raise ValueError("Verification token cannot be blank")
        return value


class TokenResponse(BaseModel):
    access_token: str = Field(..., examples=["jwt-access-token"])
    token_type: str = Field("bearer", examples=["bearer"])
    expires_in: int = Field(..., examples=[1800], description="Access token lifetime in seconds")
