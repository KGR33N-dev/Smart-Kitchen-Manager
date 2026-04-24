from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.food import User
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(User, db)

    async def get_by_email(self, email: str) -> User | None:
        result = await self.db.execute(
            select(User).where(User.email == email.lower())
        )
        return result.scalars().first()

    async def get_by_stripe_customer(self, customer_id: str) -> User | None:
        result = await self.db.execute(
            select(User).where(User.stripe_customer_id == customer_id)
        )
        return result.scalars().first()

    async def increment_scan_count(self, user_id: int) -> None:
        from sqlalchemy import update
        await self.db.execute(
            update(User)
            .where(User.id == user_id)
            .values(scans_this_month=User.scans_this_month + 1)
        )
