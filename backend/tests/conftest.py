"""
Shared pytest fixtures.

A separate SQLite database file is used so tests never touch the dev DB.
AI is forced into demo mode and Celery is disabled, so the full scan pipeline
runs inline with zero external infrastructure.
"""
import os

# Must be set BEFORE importing the app / settings (settings are cached).
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("DATABASE_URL_OVERRIDE", "sqlite+aiosqlite:///./test_kitchen.db")
os.environ.setdefault("AI_DEMO_MODE", "true")
os.environ.setdefault("USE_CELERY", "false")
os.environ.setdefault("SECRET_KEY", "test-secret-key-that-is-long-enough-for-hs256-signing-0000")

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.database import Base, engine
from app.core.seed import seed_categories, seed_recipes
from app.main import app


@pytest_asyncio.fixture(autouse=True)
async def _reset_db():
    """Fresh schema + seed categories & recipes before each test; drop after."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    await seed_categories()
    await seed_recipes()
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
def register_user(client):
    """Factory: register + login a user, returning an Authorization header dict."""
    async def _make(email: str, password: str = "password123", name: str = "User Name"):
        await client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": password, "full_name": name},
        )
        res = await client.post(
            "/api/v1/auth/token", data={"username": email, "password": password}
        )
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    return _make


@pytest_asyncio.fixture
async def auth_client(client):
    """An AsyncClient with a registered + logged-in user's bearer token set."""
    email = "tester@example.com"
    password = "supersecret123"
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Test User"},
    )
    res = await client.post(
        "/api/v1/auth/token",
        data={"username": email, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    token = res.json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    return client
