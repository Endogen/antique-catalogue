from fastapi import FastAPI

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
from app.api.profiles import avatar_router as avatar_serve_router
from app.api.profiles import router as profiles_router
from app.api.schema_templates import router as schema_templates_router
from app.api.search import router as search_router
from app.api.stars import router as stars_router
from app.core.exceptions import register_exception_handlers
from app.core.settings import settings
from app.schemas.responses import DEFAULT_ERROR_RESPONSES, HealthResponse

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
app.include_router(avatar_serve_router)
app.include_router(search_router)
app.include_router(stars_router)
app.include_router(schema_templates_router)


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return {"status": "ok"}
