import os
import shutil
import uuid
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta

from app.core.database import get_db
from app.core.config import settings
from app.models.food import FoodItem as FoodItemModel, Category as CategoryModel, ItemStatus
from app.schemas.food import (
    FoodItemCreate,
    FoodItemUpdate,
    FoodItemVerify,
    FoodItemOut,
    CategoryCreate,
    CategoryOut,
)

router = APIRouter(prefix="/items", tags=["Food Items"])


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _get_item_or_404(item_id: int, db: Session) -> FoodItemModel:
    item = db.query(FoodItemModel).filter(FoodItemModel.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail=f"Item {item_id} not found")
    return item


def _refresh_status(item: FoodItemModel) -> FoodItemModel:
    """Auto-update status based on expiry date."""
    if item.expiry_date:
        now = datetime.now(timezone.utc)
        exp = item.expiry_date.replace(tzinfo=timezone.utc) if item.expiry_date.tzinfo is None else item.expiry_date
        days_left = (exp - now).days
        if days_left < 0:
            item.status = ItemStatus.EXPIRED
        elif days_left <= 3:
            item.status = ItemStatus.EXPIRING_SOON
        else:
            item.status = ItemStatus.FRESH
    return item


# ─── Categories ──────────────────────────────────────────────────────────────

@router.get("/categories", response_model=List[CategoryOut], summary="List all categories")
def list_categories(db: Session = Depends(get_db)):
    return db.query(CategoryModel).all()


@router.post("/categories", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db)):
    existing = db.query(CategoryModel).filter(CategoryModel.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=409, detail="Category already exists")
    cat = CategoryModel(**payload.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


# ─── Food Items CRUD ─────────────────────────────────────────────────────────

@router.post("/", response_model=FoodItemOut, status_code=status.HTTP_201_CREATED, summary="Add food item")
def create_item(payload: FoodItemCreate, db: Session = Depends(get_db)):
    item = FoodItemModel(**payload.model_dump())
    _refresh_status(item)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/", response_model=List[FoodItemOut], summary="List all food items")
def list_items(
    location: str | None = Query(default=None),
    category_id: int | None = Query(default=None),
    status: ItemStatus | None = Query(default=None),
    db: Session = Depends(get_db),
):
    q = db.query(FoodItemModel)
    if location:
        q = q.filter(FoodItemModel.location == location)
    if category_id:
        q = q.filter(FoodItemModel.category_id == category_id)
    if status:
        q = q.filter(FoodItemModel.status == status)
    return q.order_by(FoodItemModel.expiry_date.asc().nullslast()).all()


@router.get("/expiring", response_model=List[FoodItemOut], summary="Items expiring within N days")
def expiring_items(days: int = Query(default=3, ge=1, le=30), db: Session = Depends(get_db)):
    cutoff = datetime.now(timezone.utc) + timedelta(days=days)
    return (
        db.query(FoodItemModel)
        .filter(FoodItemModel.expiry_date <= cutoff)
        .order_by(FoodItemModel.expiry_date.asc())
        .all()
    )


@router.get("/{item_id}", response_model=FoodItemOut, summary="Get single item")
def get_item(item_id: int, db: Session = Depends(get_db)):
    return _get_item_or_404(item_id, db)


@router.patch("/{item_id}", response_model=FoodItemOut, summary="Update item")
def update_item(item_id: int, payload: FoodItemUpdate, db: Session = Depends(get_db)):
    item = _get_item_or_404(item_id, db)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(item, field, value)
    _refresh_status(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete item")
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = _get_item_or_404(item_id, db)
    db.delete(item)
    db.commit()


@router.post("/{item_id}/verify", response_model=FoodItemOut, summary="Daily Check – TAK/NIE verification")
def verify_item(item_id: int, payload: FoodItemVerify, db: Session = Depends(get_db)):
    """
    Called from the Daily Check screen.
    confirmed=True  → item is still fine (FRESH/EXPIRING_SOON kept)
    confirmed=False → item should be flagged / discarded
    """
    item = _get_item_or_404(item_id, db)
    item.ai_verified = True
    item.ai_confidence = payload.ai_confidence
    if not payload.confirmed:
        item.status = ItemStatus.EXPIRED
    db.commit()
    db.refresh(item)
    return item
