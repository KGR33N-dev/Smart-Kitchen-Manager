from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_active_household_id
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.food import User
from app.repositories.shopping_repo import ShoppingItemRepository, ShoppingListRepository
from app.schemas.shopping import (
    ShoppingItemCreate, ShoppingItemOut, ShoppingItemUpdate,
    ShoppingListCreate, ShoppingListOut,
)

router = APIRouter(prefix="/shopping", tags=["Shopping Lists"])


@router.get("/lists", response_model=list[ShoppingListOut])
async def list_lists(
    db: AsyncSession = Depends(get_db),
    household_id: int = Depends(get_active_household_id),
):
    repo = ShoppingListRepository(db)
    return await repo.list_for_household(household_id)


@router.post("/lists", response_model=ShoppingListOut, status_code=status.HTTP_201_CREATED)
async def create_list(
    payload: ShoppingListCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    household_id: int = Depends(get_active_household_id),
):
    repo = ShoppingListRepository(db)
    lst = await repo.create(
        name=payload.name, household_id=household_id, created_by=current_user.id
    )
    return await repo.get_for_household(lst.id, household_id)


@router.delete("/lists/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_list(
    list_id: int,
    db: AsyncSession = Depends(get_db),
    household_id: int = Depends(get_active_household_id),
):
    repo = ShoppingListRepository(db)
    lst = await repo.get_for_household(list_id, household_id)
    if not lst:
        raise HTTPException(status_code=404, detail="Lista nie znaleziona")
    await repo.delete(lst.id)


@router.post("/lists/{list_id}/items", response_model=ShoppingItemOut, status_code=status.HTTP_201_CREATED)
async def add_item(
    list_id: int,
    payload: ShoppingItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    household_id: int = Depends(get_active_household_id),
):
    list_repo = ShoppingListRepository(db)
    lst = await list_repo.get_for_household(list_id, household_id)
    if not lst:
        raise HTTPException(status_code=404, detail="Lista nie znaleziona")
    item_repo = ShoppingItemRepository(db)
    return await item_repo.create(
        list_id=list_id,
        name=payload.name,
        quantity=payload.quantity,
        unit=payload.unit,
        added_by=current_user.id,
    )


@router.patch("/items/{item_id}", response_model=ShoppingItemOut)
async def update_item(
    item_id: int,
    payload: ShoppingItemUpdate,
    db: AsyncSession = Depends(get_db),
    household_id: int = Depends(get_active_household_id),
):
    repo = ShoppingItemRepository(db)
    item = await repo.get_in_household(item_id, household_id)
    if not item:
        raise HTTPException(status_code=404, detail="Pozycja nie znaleziona")
    data = payload.model_dump(exclude_none=True)
    return await repo.update(item.id, **data)


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    household_id: int = Depends(get_active_household_id),
):
    repo = ShoppingItemRepository(db)
    item = await repo.get_in_household(item_id, household_id)
    if not item:
        raise HTTPException(status_code=404, detail="Pozycja nie znaleziona")
    await repo.delete(item.id)
