from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.food import User
from app.repositories.household_repo import HouseholdRepository
from app.schemas.household import (
    HouseholdCreate, HouseholdJoin, HouseholdOut, JoinCodeOut, MemberOut,
)
from app.services.household_service import HouseholdService

router = APIRouter(prefix="/households", tags=["Households"])


async def _to_out(repo: HouseholdRepository, household, user: User) -> HouseholdOut:
    members = await repo.members(household.id)
    my_role = next((m.role for m in members if m.user_id == user.id), None)
    out = HouseholdOut.model_validate(household)
    out.role = my_role
    out.is_active = user.active_household_id == household.id
    out.member_count = len(members)
    return out


@router.get("/", response_model=list[HouseholdOut])
async def list_my_households(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = HouseholdRepository(db)
    households = await repo.list_for_user(current_user.id)
    return [await _to_out(repo, h, current_user) for h in households]


@router.post("/", response_model=HouseholdOut, status_code=status.HTTP_201_CREATED)
async def create_household(
    payload: HouseholdCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = HouseholdService(db)
    household = await svc.create_household(current_user, payload.name, make_active=True)
    return await _to_out(svc.repo, household, current_user)


@router.post("/join", response_model=HouseholdOut)
async def join_household(
    payload: HouseholdJoin,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = HouseholdService(db)
    household = await svc.join_by_code(current_user, payload.code)
    return await _to_out(svc.repo, household, current_user)


@router.get("/{household_id}/members", response_model=list[MemberOut])
async def household_members(
    household_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = HouseholdService(db)
    await svc.require_membership(household_id, current_user.id)
    members = await svc.repo.members(household_id)
    return [
        MemberOut(
            user_id=m.user_id, email=m.user.email, full_name=m.user.full_name, role=m.role
        )
        for m in members
    ]


@router.post("/{household_id}/switch", response_model=HouseholdOut)
async def switch_household(
    household_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = HouseholdService(db)
    await svc.switch_active(current_user, household_id)
    household = await svc.repo.get(household_id)
    return await _to_out(svc.repo, household, current_user)


@router.post("/{household_id}/regenerate-code", response_model=JoinCodeOut)
async def regenerate_code(
    household_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = HouseholdService(db)
    code = await svc.regenerate_code(current_user, household_id)
    return JoinCodeOut(join_code=code)
