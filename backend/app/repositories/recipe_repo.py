from typing import Sequence

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.recipe import Recipe
from app.repositories.base import BaseRepository


class RecipeRepository(BaseRepository[Recipe]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(Recipe, db)

    async def list_all(self, q: str | None = None) -> Sequence[Recipe]:
        stmt = select(Recipe)
        if q:
            like = f"%{q.lower()}%"
            stmt = stmt.where(
                or_(Recipe.name.ilike(like), Recipe.aliases.ilike(like))
            )
        stmt = stmt.order_by(Recipe.name.asc())
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_with_ingredients(self, recipe_id: int) -> Recipe | None:
        result = await self.db.execute(
            select(Recipe)
            .options(selectinload(Recipe.ingredients))
            .where(Recipe.id == recipe_id)
        )
        return result.scalars().first()

    async def all_with_ingredients(self) -> Sequence[Recipe]:
        result = await self.db.execute(
            select(Recipe).options(selectinload(Recipe.ingredients))
        )
        return result.scalars().all()
