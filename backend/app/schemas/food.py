from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime
from enum import Enum


class ItemStatus(str, Enum):
    FRESH = "fresh"
    EXPIRING_SOON = "expiring_soon"
    EXPIRED = "expired"
    PENDING_VERIFICATION = "pending_verification"


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    icon: str


class FoodItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    quantity: float = Field(default=1.0, gt=0)
    unit: str = Field(default="szt.", max_length=30)
    location: str = Field(default="Lodówka", max_length=100)
    expiry_date: Optional[datetime] = None
    category_id: Optional[int] = None
    image_url: Optional[str] = None


class FoodItemUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=200)
    quantity: Optional[float] = Field(default=None, gt=0)
    unit: Optional[str] = None
    location: Optional[str] = None
    expiry_date: Optional[datetime] = None
    category_id: Optional[int] = None
    status: Optional[ItemStatus] = None


class FoodItemVerify(BaseModel):
    confirmed: bool
    ai_prediction: str = Field(default="fresh")
    ai_confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)


class FoodItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    quantity: float
    unit: str
    location: str
    expiry_date: Optional[datetime]
    status: ItemStatus
    ai_verified: bool
    ai_confidence: Optional[float]
    image_url: Optional[str]
    category: Optional[CategoryOut]
    created_at: datetime
    updated_at: datetime


class ScanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    scan_type: str
    original_filename: str
    parsed_items_count: int
    task_id: Optional[str]
    task_status: str
    created_at: datetime


class CheckoutSessionOut(BaseModel):
    checkout_url: str


class PortalSessionOut(BaseModel):
    portal_url: str
