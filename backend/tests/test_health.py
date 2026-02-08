"""Test health endpoint."""

import asyncio

import httpx

from app.main import app


def test_health_check():
    """Test the health endpoint returns ok status."""

    async def _request():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.get("/health")

    response = asyncio.run(_request())
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
