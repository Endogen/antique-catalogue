from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette import status
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.schemas.responses import ErrorResponse

logger = logging.getLogger(__name__)


def _normalize_error_detail(detail: Any) -> tuple[str, list[dict[str, Any]] | None]:
    if isinstance(detail, str):
        return detail, None
    if isinstance(detail, list):
        if all(isinstance(item, dict) for item in detail):
            return "Request error", detail
        return "Request error", [{"message": str(item)} for item in detail]
    if isinstance(detail, dict):
        return "Request error", [detail]
    return "Request error", [{"message": str(detail)}]


def _error_response(
    status_code: int,
    detail: str,
    errors: list[dict[str, Any]] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    payload = ErrorResponse(detail=detail, errors=errors)
    return JSONResponse(
        status_code=status_code,
        content=jsonable_encoder(payload, exclude_none=True),
        headers=headers,
    )


def _stringify_exceptions(value: Any) -> Any:
    if isinstance(value, Exception):
        return str(value)
    if isinstance(value, dict):
        return {key: _stringify_exceptions(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_stringify_exceptions(item) for item in value]
    return value


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        detail, errors = _normalize_error_detail(exc.detail)
        return _error_response(
            status_code=exc.status_code,
            detail=detail,
            errors=errors,
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return _error_response(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Validation error",
            errors=_stringify_exceptions(exc.errors()),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception", exc_info=exc)
        return _error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error",
        )
