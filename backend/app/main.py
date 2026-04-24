"""
Smart-Fridge & Pantry Assistant — FastAPI v2.0
Production-grade async application entrypoint.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.core.config import settings
from app.core.database import create_tables
from app.core.logging import configure_logging
from app.api.v1 import v1_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle manager."""
    configure_logging(debug=settings.DEBUG)
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    # Dev convenience: auto-create tables. Use Alembic in production!
    if settings.ENVIRONMENT == "development":
        await create_tables()
    yield
    # Teardown (close engine connections, etc.)


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="""
## 🥗 Smart-Fridge & Pantry Assistant API v2

Production-grade async REST API with:
- **JWT Auth** (access + refresh tokens)
- **Freemium Model** — 10 free scans/month, unlimited on Premium
- **Celery Background Tasks** — receipt OCR, IoT camera freshness analysis
- **Few-Shot AI** — personalized predictions from Daily Check history
- **Stripe Webhooks** — automated subscription lifecycle management
    """,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static files (uploaded images) ───────────────────────────────────────────

Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)  # ensure exists before mount
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# ── Routes ────────────────────────────────────────────────────────────────────

app.include_router(v1_router)


@app.get("/", tags=["Root"], include_in_schema=False)
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "status": "running",
    }


@app.get("/health", tags=["Root"])
async def health():
    return {"status": "ok", "environment": settings.ENVIRONMENT}
