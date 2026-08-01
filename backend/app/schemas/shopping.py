from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ShoppingItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    quantity: float = Field(default=1.0, gt=0)
    unit: str = Field(default="szt.", max_length=30)


class ShoppingItemUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=200)
    quantity: Optional[float] = Field(default=None, gt=0)
    unit: Optional[str] = None
    is_checked: Optional[bool] = None


class ShoppingItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    quantity: float
    unit: str
    is_checked: bool
    created_at: datetime


class ShoppingListCreate(BaseModel):
    name: str = Field(default="Lista zakupów", min_length=1, max_length=120)


class ShoppingListOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    is_archived: bool
    created_at: datetime
    items: list[ShoppingItemOut] = []
