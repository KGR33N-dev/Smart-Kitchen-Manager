from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.food import Category
from app.repositories.base import BaseRepository


class CategoryRepository(BaseRepository[Category]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(Category, db)

    async def list_all(self) -> Sequence[Category]:
        result = await self.db.execute(select(Category).order_by(Category.name.asc()))
        return result.scalars().all()

    async def get_by_name(self, name: str) -> Category | None:
        result = await self.db.execute(select(Category).where(Category.name == name))
        return result.scalars().first()
