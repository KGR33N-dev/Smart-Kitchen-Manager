"""
SQLAlchemy ORM Models — Production Schema
Covers: users, products/food_items, categories, iot_devices, scans_history
"""
import datetime
import enum
from typing import Optional

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float, ForeignKey,
    Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


# ─── Enums ────────────────────────────────────────────────────────────────────

class ItemStatus(str, enum.Enum):
    FRESH = "fresh"
    EXPIRING_SOON = "expiring_soon"
    EXPIRED = "expired"
    PENDING_VERIFICATION = "pending_verification"


class SubscriptionTier(str, enum.Enum):
    FREE = "free"
    PREMIUM = "premium"


class ScanType(str, enum.Enum):
    RECEIPT = "receipt"
    CAMERA = "camera"
    BARCODE = "barcode"


class DeviceStatus(str, enum.Enum):
    ACTIVE = "active"
    OFFLINE = "offline"
    MAINTENANCE = "maintenance"


# ─── Timestamp mixin ─────────────────────────────────────────────────────────

class TimestampMixin:
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


# ─── User ─────────────────────────────────────────────────────────────────────

class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Subscription
    subscription_tier: Mapped[SubscriptionTier] = mapped_column(
        Enum(SubscriptionTier), default=SubscriptionTier.FREE, nullable=False
    )
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    subscription_valid_until: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Usage tracking (Freemium)
    scans_this_month: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    scans_reset_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    @property
    def is_premium(self) -> bool:
        if self.subscription_tier == SubscriptionTier.PREMIUM:
            if self.subscription_valid_until and self.subscription_valid_until > datetime.datetime.now(datetime.timezone.utc):
                return True
        return False

    # Relations
    food_items: Mapped[list["FoodItem"]] = relationship("FoodItem", back_populates="owner", cascade="all, delete-orphan")
    iot_devices: Mapped[list["IoTDevice"]] = relationship("IoTDevice", back_populates="owner", cascade="all, delete-orphan")
    scans: Mapped[list["ScanHistory"]] = relationship("ScanHistory", back_populates="user", cascade="all, delete-orphan")
    ai_feedback: Mapped[list["AIFeedback"]] = relationship("AIFeedback", back_populates="user", cascade="all, delete-orphan")


# ─── Category ─────────────────────────────────────────────────────────────────

class Category(TimestampMixin, Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    icon: Mapped[str] = mapped_column(String(10), default="🍽️")
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)

    food_items: Mapped[list["FoodItem"]] = relationship("FoodItem", back_populates="category")


# ─── FoodItem (Product) ───────────────────────────────────────────────────────

class FoodItem(TimestampMixin, Base):
    __tablename__ = "food_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    quantity: Mapped[float] = mapped_column(Float, default=1.0)
    unit: Mapped[str] = mapped_column(String(30), default="szt.")
    location: Mapped[str] = mapped_column(String(100), default="Lodówka", index=True)

    # Expiry
    expiry_date: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )

    # Status
    status: Mapped[ItemStatus] = mapped_column(
        Enum(ItemStatus), default=ItemStatus.FRESH, nullable=False, index=True
    )

    # AI verification data
    ai_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    ai_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # FK relations
    owner_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )

    owner: Mapped["User"] = relationship("User", back_populates="food_items")
    category: Mapped[Optional["Category"]] = relationship("Category", back_populates="food_items")


# ─── IoT Device ───────────────────────────────────────────────────────────────

class IoTDevice(TimestampMixin, Base):
    __tablename__ = "iot_devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    device_uid: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    device_type: Mapped[str] = mapped_column(String(50), default="camera")
    location_label: Mapped[str] = mapped_column(String(100), default="Lodówka – górna półka")
    firmware_version: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    status: Mapped[DeviceStatus] = mapped_column(
        Enum(DeviceStatus), default=DeviceStatus.ACTIVE
    )
    last_seen_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    owner_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    owner: Mapped["User"] = relationship("User", back_populates="iot_devices")
    scans: Mapped[list["ScanHistory"]] = relationship("ScanHistory", back_populates="device")


# ─── Scan History ─────────────────────────────────────────────────────────────

class ScanHistory(TimestampMixin, Base):
    __tablename__ = "scans_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    scan_type: Mapped[ScanType] = mapped_column(Enum(ScanType), nullable=False, index=True)
    original_filename: Mapped[str] = mapped_column(String(300), nullable=False)
    stored_path: Mapped[str] = mapped_column(String(500), nullable=False)

    # Results
    raw_ocr_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    parsed_items_count: Mapped[int] = mapped_column(Integer, default=0)
    ai_response_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Celery task tracking
    task_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    task_status: Mapped[str] = mapped_column(String(30), default="pending")

    # FK
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    device_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("iot_devices.id", ondelete="SET NULL"), nullable=True
    )

    user: Mapped["User"] = relationship("User", back_populates="scans")
    device: Mapped[Optional["IoTDevice"]] = relationship("IoTDevice", back_populates="scans")


# ─── AI Feedback (Few-Shot training data) ────────────────────────────────────

class AIFeedback(TimestampMixin, Base):
    """Stores Daily Check corrections to build few-shot prompting context."""
    __tablename__ = "ai_feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    item_name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    ai_prediction: Mapped[str] = mapped_column(String(50))   # e.g. "fresh"
    user_correction: Mapped[str] = mapped_column(String(50))  # e.g. "expired"
    confirmed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    ai_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user: Mapped["User"] = relationship("User", back_populates="ai_feedback")
