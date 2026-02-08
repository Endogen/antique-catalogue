from fastapi import FastAPI

from app.api.auth import router as auth_router
from app.core.exceptions import register_exception_handlers
from app.core.settings import settings
from app.schemas.responses import DEFAULT_ERROR_RESPONSES, HealthResponse

app = FastAPI(title="Antique Catalogue API", responses=DEFAULT_ERROR_RESPONSES)
app.state.settings = settings
register_exception_handlers(app)
app.include_router(auth_router)


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return {"status": "ok"}
