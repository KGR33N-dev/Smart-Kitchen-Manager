"""Shared FastAPI dependencies."""
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.food import User
from app.services.household_service import HouseholdService


async def get_active_household_id(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> int:
    """Resolve (and self-heal) the caller's active household id."""
    svc = HouseholdService(db)
    return await svc.get_active_household_id(current_user)
