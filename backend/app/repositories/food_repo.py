from datetime import datetime, timezone, timedelta
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.food import FoodItem, ItemStatus
from app.repositories.base import BaseRepository


class FoodRepository(BaseRepository[FoodItem]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(FoodItem, db)

    async def get_with_category(self, id: int) -> FoodItem | None:
        result = await self.db.execute(
            select(FoodItem)
            .options(selectinload(FoodItem.category))
            .where(FoodItem.id == id)
        )
        return result.scalars().first()

    async def list_for_user(
        self,
        user_id: int,
        location: str | None = None,
        category_id: int | None = None,
        status: ItemStatus | None = None,
    ) -> Sequence[FoodItem]:
        q = (
            select(FoodItem)
            .options(selectinload(FoodItem.category))
            .where(FoodItem.owner_id == user_id)
        )
        if location:
            q = q.where(FoodItem.location == location)
        if category_id:
            q = q.where(FoodItem.category_id == category_id)
        if status:
            q = q.where(FoodItem.status == status)
        q = q.order_by(FoodItem.expiry_date.asc().nullslast())
        result = await self.db.execute(q)
        return result.scalars().all()

    async def expiring_soon(self, user_id: int, days: int = 3) -> Sequence[FoodItem]:
        cutoff = datetime.now(timezone.utc) + timedelta(days=days)
        result = await self.db.execute(
            select(FoodItem)
            .options(selectinload(FoodItem.category))
            .where(FoodItem.owner_id == user_id)
            .where(FoodItem.expiry_date <= cutoff)
            .order_by(FoodItem.expiry_date.asc())
        )
        return result.scalars().all()

    async def pending_verification(self, user_id: int) -> Sequence[FoodItem]:
        result = await self.db.execute(
            select(FoodItem)
            .options(selectinload(FoodItem.category))
            .where(FoodItem.owner_id == user_id)
            .where(FoodItem.ai_verified == False)  # noqa: E712
            .where(FoodItem.expiry_date.isnot(None))
            .order_by(FoodItem.expiry_date.asc())
        )
        return result.scalars().all()
