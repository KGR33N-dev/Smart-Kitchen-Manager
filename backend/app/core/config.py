from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Literal


class Settings(BaseSettings):
    # ── App ──────────────────────────────────────────────────────────────────
    APP_NAME: str = "Smart-Fridge & Pantry Assistant"
    APP_VERSION: str = "2.0.0"
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = True

    # ── Database (async PostgreSQL) ───────────────────────────────────────────
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "kitchen"
    POSTGRES_PASSWORD: str = "kitchen_secret"
    POSTGRES_DB: str = "smart_kitchen"

    @property
    def DATABASE_URL(self) -> str:
        """
        In development (ENVIRONMENT=development) uses async SQLite via aiosqlite.
        In staging/production uses PostgreSQL via asyncpg.
        """
        if self.ENVIRONMENT == "development":
            return "sqlite+aiosqlite:///./kitchen.db"
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def DATABASE_URL_SYNC(self) -> str:
        """Used only by Alembic (synchronous migrations)."""
        if self.ENVIRONMENT == "development":
            return "sqlite:///./kitchen.db"
        return (
            f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # ── Security ─────────────────────────────────────────────────────────────
    SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION_64_CHAR_MIN"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24       # 1 day
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # ── Redis / Celery ────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    @property
    def CELERY_BROKER_URL(self) -> str:
        return self.REDIS_URL

    @property
    def CELERY_RESULT_BACKEND(self) -> str:
        return self.REDIS_URL

    # ── File uploads ─────────────────────────────────────────────────────────
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_MB: int = 15
    ALLOWED_IMAGE_TYPES: list[str] = ["image/jpeg", "image/png", "image/webp", "image/heic"]

    # ── AI (OpenAI or Local Ollama) ─────────────────────────────────────────────────
    OPENAI_API_KEY: str = "ollama"  # W Ollama klucz może być cokolwiek, ale SDK wymaga tej wartości
    OPENAI_BASE_URL: str = "http://localhost:11434/v1"  # Adres lokalnego API Ollama kompatybilnego z OpenAI
    OPENAI_MODEL: str = "llama3.2-vision"  # Pamiętaj, aby pobrać ten model używając `ollama run llama3.2-vision`
    AI_MAX_TOKENS: int = 800
    AI_FEW_SHOT_HISTORY_COUNT: int = 10   # number of past corrections to include

    # ── Payments (Stripe) ─────────────────────────────────────────────────────
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_ID_PREMIUM: str = ""     # Monthly premium plan price ID
    FREE_TIER_SCAN_LIMIT: int = 10        # Free users: 10 scans/month

    # ── CORS ─────────────────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:8081", "exp://"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
