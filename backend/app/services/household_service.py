"""Household business logic: creation, join-by-code, membership + the shared
'active household' context used to scope fridge/pantry/lists/notes."""
import secrets
import string

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.food import User
from app.models.household import Household, MemberRole
from app.repositories.household_repo import HouseholdRepository

_CODE_ALPHABET = string.ascii_uppercase + string.digits  # unambiguous enough for sharing


def _generate_code(length: int = 6) -> str:
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(length))


class HouseholdService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = HouseholdRepository(db)

    async def _unique_code(self) -> str:
        for _ in range(10):
            code = _generate_code()
            if not await self.repo.get_by_join_code(code):
                return code
        return _generate_code(8)  # extremely unlikely fallback

    async def create_household(
        self, owner: User, name: str, *, is_personal: bool = False, make_active: bool = True
    ) -> Household:
        household = Household(
            name=name,
            join_code=await self._unique_code(),
            is_personal=is_personal,
            owner_id=owner.id,
        )
        self.db.add(household)
        await self.db.flush()
        await self.repo.add_member(household.id, owner.id, MemberRole.OWNER)
        if make_active or owner.active_household_id is None:
            owner.active_household_id = household.id
        await self.db.flush()
        return household

    async def ensure_personal_household(self, owner: User) -> Household:
        """Called on registration so every user always has a shared context."""
        name = f"Dom {owner.full_name.split(' ')[0]}" if owner.full_name else "Mój dom"
        return await self.create_household(owner, name, is_personal=True, make_active=True)

    async def join_by_code(self, user: User, code: str) -> Household:
        household = await self.repo.get_by_join_code(code.strip().upper())
        if not household:
            raise HTTPException(status_code=404, detail="Nieprawidłowy kod zaproszenia")
        existing = await self.repo.get_membership(household.id, user.id)
        if not existing:
            await self.repo.add_member(household.id, user.id, MemberRole.MEMBER)
        user.active_household_id = household.id
        await self.db.flush()
        return household

    async def require_membership(self, household_id: int, user_id: int) -> None:
        if not await self.repo.get_membership(household_id, user_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Nie jesteś członkiem tego gospodarstwa",
            )

    async def get_active_household_id(self, user: User) -> int:
        """Resolve the user's active household, self-healing if unset."""
        if user.active_household_id:
            membership = await self.repo.get_membership(user.active_household_id, user.id)
            if membership:
                return user.active_household_id
        # No / stale active household — fall back to first membership or create one.
        households = await self.repo.list_for_user(user.id)
        if households:
            user.active_household_id = households[0].id
            await self.db.flush()
            return households[0].id
        created = await self.ensure_personal_household(user)
        return created.id

    async def switch_active(self, user: User, household_id: int) -> None:
        await self.require_membership(household_id, user.id)
        user.active_household_id = household_id
        await self.db.flush()

    async def regenerate_code(self, user: User, household_id: int) -> str:
        household = await self.repo.get(household_id)
        if not household or household.owner_id != user.id:
            raise HTTPException(status_code=403, detail="Tylko właściciel może zmienić kod")
        household.join_code = await self._unique_code()
        await self.db.flush()
        return household.join_code
