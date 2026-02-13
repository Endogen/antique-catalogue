from __future__ import annotations

from contextlib import asynccontextmanager

import fastapi.concurrency
import fastapi.dependencies.utils
import fastapi.routing
import pytest
import starlette.concurrency
from fastapi import FastAPI
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.activity import router as activity_router
from app.api.admin import router as admin_router
from app.api.auth import router as auth_router
from app.api.collections import public_router as public_collections_router
from app.api.collections import router as collections_router
from app.api.fields import router as fields_router
from app.api.images import router as images_router
from app.api.images import serve_router as images_serve_router
from app.api.items import public_router as public_items_router
from app.api.items import router as items_router
from app.api.profiles import router as profiles_router
from app.api.schema_templates import router as schema_templates_router
from app.api.search import router as search_router
from app.api.stars import router as stars_router
from app.core.exceptions import register_exception_handlers
from app.core.settings import settings
from app.db.base import Base
from app.db.session import get_db
from app.schemas.responses import DEFAULT_ERROR_RESPONSES


@pytest.fixture()
def db_session_factory():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(bind=engine)
    try:
        yield TestingSessionLocal
    finally:
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture()
def app_with_db(db_session_factory, monkeypatch):
    async def direct_run(func, *args, **kwargs):
        return func(*args, **kwargs)

    @asynccontextmanager
    async def direct_contextmanager(cm):
        try:
            yield cm.__enter__()
        except Exception as exc:
            ok = bool(cm.__exit__(type(exc), exc, exc.__traceback__))
            if not ok:
                raise
        else:
            cm.__exit__(None, None, None)

    monkeypatch.setattr(starlette.concurrency, "run_in_threadpool", direct_run)
    monkeypatch.setattr(fastapi.routing, "run_in_threadpool", direct_run)
    monkeypatch.setattr(fastapi.dependencies.utils, "run_in_threadpool", direct_run)
    monkeypatch.setattr(fastapi.concurrency, "contextmanager_in_threadpool", direct_contextmanager)
    monkeypatch.setattr(
        fastapi.dependencies.utils,
        "contextmanager_in_threadpool",
        direct_contextmanager,
    )

    app = FastAPI(title="Antique Catalogue API", responses=DEFAULT_ERROR_RESPONSES)
    app.state.settings = settings
    register_exception_handlers(app)
    app.include_router(auth_router)
    app.include_router(admin_router)
    app.include_router(activity_router)
    app.include_router(collections_router)
    app.include_router(fields_router)
    app.include_router(items_router)
    app.include_router(images_router)
    app.include_router(images_serve_router)
    app.include_router(public_collections_router)
    app.include_router(public_items_router)
    app.include_router(profiles_router)
    app.include_router(search_router)
    app.include_router(stars_router)
    app.include_router(schema_templates_router)

    def override_get_db():
        db = db_session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield app
    app.dependency_overrides.clear()
