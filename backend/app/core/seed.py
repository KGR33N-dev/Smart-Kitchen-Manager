"""Seed data — default food categories inserted on first startup."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.core.logging import log
from app.models.food import Category

# name → icon. Names match the categories the AI receipt parser returns,
# so scanned items can be auto-linked by category name.
DEFAULT_CATEGORIES: list[tuple[str, str]] = [
    ("Dairy", "🥛"),
    ("Vegetables", "🥬"),
    ("Fruit", "🍎"),
    ("Meat", "🍗"),
    ("Fish", "🐟"),
    ("Bakery", "🍞"),
    ("Drinks", "🧃"),
    ("Frozen", "🧊"),
    ("Grains", "🌾"),
    ("Snacks", "🍫"),
    ("Other", "🍽️"),
]


async def seed_categories(db: AsyncSession | None = None) -> int:
    """Insert any missing default categories. Idempotent. Returns count added."""
    own_session = db is None
    session = db or AsyncSessionLocal()
    added = 0
    try:
        existing = set(
            (await session.execute(select(Category.name))).scalars().all()
        )
        for name, icon in DEFAULT_CATEGORIES:
            if name not in existing:
                session.add(Category(name=name, icon=icon, is_system=True))
                added += 1
        if added:
            await session.commit()
            log.info("seed.categories", added=added)
        return added
    finally:
        if own_session:
            await session.close()
