from typing import Sequence
from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.food import User
from app.schemas.food import FoodItemCreate, FoodItemUpdate, FoodItemVerify, FoodItemOut
from app.services.food_service import FoodService

router = APIRouter(prefix="/items", tags=["Food Items"])


@router.post("/", response_model=FoodItemOut, status_code=status.HTTP_201_CREATED)
async def create_item(
    payload: FoodItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = FoodService(db)
    return await svc.create(owner_id=current_user.id, payload=payload)


@router.get("/", response_model=list[FoodItemOut])
async def list_items(
    location: str | None = Query(default=None),
    category_id: int | None = Query(default=None),
    status: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.food import ItemStatus
    svc = FoodService(db)
    status_enum = ItemStatus(status) if status else None
    return await svc.list_items(
        owner_id=current_user.id,
        location=location,
        category_id=category_id,
        status=status_enum,
    )


@router.get("/expiring", response_model=list[FoodItemOut])
async def expiring_items(
    days: int = Query(default=3, ge=1, le=30),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = FoodService(db)
    return await svc.expiring_soon(owner_id=current_user.id, days=days)


@router.get("/pending-verification", response_model=list[FoodItemOut])
async def pending_verification(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.repositories.food_repo import FoodRepository
    repo = FoodRepository(db)
    return await repo.pending_verification(current_user.id)


@router.get("/{item_id}", response_model=FoodItemOut)
async def get_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = FoodService(db)
    return await svc.get_item(item_id, current_user.id)


@router.patch("/{item_id}", response_model=FoodItemOut)
async def update_item(
    item_id: int,
    payload: FoodItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = FoodService(db)
    return await svc.update_item(item_id, current_user.id, payload)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = FoodService(db)
    await svc.delete_item(item_id, current_user.id)


@router.post("/{item_id}/verify", response_model=FoodItemOut)
async def verify_item(
    item_id: int,
    payload: FoodItemVerify,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Daily Check endpoint — TAK/NIE. Stores correction for few-shot AI learning."""
    svc = FoodService(db)
    return await svc.verify_item(
        item_id=item_id,
        owner_id=current_user.id,
        confirmed=payload.confirmed,
        ai_prediction=payload.ai_prediction,
        ai_confidence=payload.ai_confidence,
    )
