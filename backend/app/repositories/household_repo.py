from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.household import Household, HouseholdMembership, MemberRole
from app.repositories.base import BaseRepository


class HouseholdRepository(BaseRepository[Household]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(Household, db)

    async def get_by_join_code(self, code: str) -> Household | None:
        result = await self.db.execute(
            select(Household).where(Household.join_code == code.upper())
        )
        return result.scalars().first()

    async def list_for_user(self, user_id: int) -> Sequence[Household]:
        result = await self.db.execute(
            select(Household)
            .join(HouseholdMembership, HouseholdMembership.household_id == Household.id)
            .where(HouseholdMembership.user_id == user_id)
            .order_by(Household.created_at.asc())
        )
        return result.scalars().all()

    async def members(self, household_id: int) -> Sequence[HouseholdMembership]:
        result = await self.db.execute(
            select(HouseholdMembership)
            .options(selectinload(HouseholdMembership.user))
            .where(HouseholdMembership.household_id == household_id)
            .order_by(HouseholdMembership.created_at.asc())
        )
        return result.scalars().all()

    async def get_membership(self, household_id: int, user_id: int) -> HouseholdMembership | None:
        result = await self.db.execute(
            select(HouseholdMembership)
            .where(HouseholdMembership.household_id == household_id)
            .where(HouseholdMembership.user_id == user_id)
        )
        return result.scalars().first()

    async def add_member(
        self, household_id: int, user_id: int, role: MemberRole = MemberRole.MEMBER
    ) -> HouseholdMembership:
        membership = HouseholdMembership(
            household_id=household_id, user_id=user_id, role=role
        )
        self.db.add(membership)
        await self.db.flush()
        return membership
