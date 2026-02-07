from fastapi import FastAPI

from app.core.settings import settings

app = FastAPI(title="Antique Catalogue API")
app.state.settings = settings


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
