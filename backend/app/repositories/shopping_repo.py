from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.shopping import ShoppingItem, ShoppingList
from app.repositories.base import BaseRepository


class ShoppingListRepository(BaseRepository[ShoppingList]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(ShoppingList, db)

    async def list_for_household(self, household_id: int) -> Sequence[ShoppingList]:
        result = await self.db.execute(
            select(ShoppingList)
            .options(selectinload(ShoppingList.items))
            .where(ShoppingList.household_id == household_id)
            .where(ShoppingList.is_archived == False)  # noqa: E712
            .order_by(ShoppingList.created_at.asc())
        )
        return result.scalars().unique().all()

    async def get_for_household(self, list_id: int, household_id: int) -> ShoppingList | None:
        result = await self.db.execute(
            select(ShoppingList)
            .options(selectinload(ShoppingList.items))
            .where(ShoppingList.id == list_id)
            .where(ShoppingList.household_id == household_id)
        )
        return result.scalars().first()


class ShoppingItemRepository(BaseRepository[ShoppingItem]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(ShoppingItem, db)

    async def get_in_household(self, item_id: int, household_id: int) -> ShoppingItem | None:
        result = await self.db.execute(
            select(ShoppingItem)
            .join(ShoppingList, ShoppingList.id == ShoppingItem.list_id)
            .where(ShoppingItem.id == item_id)
            .where(ShoppingList.household_id == household_id)
        )
        return result.scalars().first()
