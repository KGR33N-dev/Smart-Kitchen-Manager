"""
Food Service — Business logic for pantry management
Items are scoped to a household (shared context); every member sees them.
"""
from datetime import datetime, timezone, timedelta
from typing import Sequence

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.food import FoodItem, ItemStatus
from app.repositories.food_repo import FoodRepository
from app.repositories.scan_repo import AIFeedbackRepository
from app.schemas.food import FoodItemCreate, FoodItemUpdate


def _compute_status(expiry_date: datetime | None) -> ItemStatus:
    if not expiry_date:
        return ItemStatus.FRESH
    now = datetime.now(timezone.utc)
    exp = expiry_date.replace(tzinfo=timezone.utc) if expiry_date.tzinfo is None else expiry_date
    days = (exp - now).days
    if days < 0:
        return ItemStatus.EXPIRED
    if days <= 3:
        return ItemStatus.EXPIRING_SOON
    return ItemStatus.FRESH


class FoodService:
    def __init__(self, db: AsyncSession) -> None:
        self.repo = FoodRepository(db)
        self.feedback_repo = AIFeedbackRepository(db)

    async def create(self, owner_id: int, household_id: int, payload: FoodItemCreate) -> FoodItem:
        data = payload.model_dump()
        data["owner_id"] = owner_id
        data["household_id"] = household_id
        data["status"] = _compute_status(payload.expiry_date)
        return await self.repo.create(**data)

    async def list_items(self, household_id: int, **filters) -> Sequence[FoodItem]:
        return await self.repo.list_for_household(household_id, **filters)

    async def get_item(self, item_id: int, household_id: int) -> FoodItem:
        item = await self.repo.get_with_category(item_id)
        if not item or item.household_id != household_id:
            raise HTTPException(status_code=404, detail="Item not found")
        return item

    async def update_item(self, item_id: int, household_id: int, payload: FoodItemUpdate) -> FoodItem:
        item = await self.get_item(item_id, household_id)
        data = payload.model_dump(exclude_none=True)
        if "expiry_date" in data:
            data["status"] = _compute_status(data["expiry_date"])
        updated = await self.repo.update(item.id, **data)
        return updated  # type: ignore

    async def delete_item(self, item_id: int, household_id: int) -> None:
        item = await self.get_item(item_id, household_id)
        await self.repo.delete(item.id)

    async def expiring_soon(self, household_id: int, days: int = 3) -> Sequence[FoodItem]:
        return await self.repo.expiring_soon(household_id, days)

    async def verify_item(
        self,
        item_id: int,
        household_id: int,
        user_id: int,
        confirmed: bool,
        ai_prediction: str,
        ai_confidence: float | None = None,
    ) -> FoodItem:
        """Daily Check TAK/NIE — stores correction for few-shot learning."""
        item = await self.get_item(item_id, household_id)

        user_correction = item.status.value if confirmed else ItemStatus.EXPIRED.value
        await self.feedback_repo.create(
            user_id=user_id,
            item_name=item.name,
            ai_prediction=ai_prediction,
            user_correction=user_correction,
            confirmed=confirmed,
            ai_confidence=ai_confidence,
        )

        new_status = item.status if confirmed else ItemStatus.EXPIRED
        updated = await self.repo.update(
            item.id,
            ai_verified=True,
            ai_confidence=ai_confidence,
            status=new_status,
        )
        return updated  # type: ignore

    async def bulk_create_from_receipt(
        self, owner_id: int, household_id: int, items_data: list[dict]
    ) -> list[FoodItem]:
        """Creates multiple FoodItems (in the household) from a parsed receipt.

        Links each item to an existing category by matching the AI-provided
        category name (case-insensitive), falling back to no category.
        """
        from app.repositories.category_repo import CategoryRepository

        cat_repo = CategoryRepository(self.repo.db)
        categories = {c.name.lower(): c.id for c in await cat_repo.list_all()}

        created = []
        for d in items_data:
            expiry_date = None
            if d.get("estimated_expiry_days") is not None:
                expiry_date = datetime.now(timezone.utc) + timedelta(days=d["estimated_expiry_days"])
            category_id = categories.get(str(d.get("category", "")).lower())
            item = await self.repo.create(
                owner_id=owner_id,
                household_id=household_id,
                name=d.get("name", "Unknown"),
                quantity=float(d.get("quantity", 1)),
                unit=d.get("unit", "szt."),
                status=_compute_status(expiry_date),
                expiry_date=expiry_date,
                category_id=category_id,
            )
            created.append(item)
        return created
