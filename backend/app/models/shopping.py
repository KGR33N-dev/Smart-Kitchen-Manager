"""Shared shopping lists scoped to a household."""
from typing import Optional

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.food import TimestampMixin


class ShoppingList(TimestampMixin, Base):
    __tablename__ = "shopping_lists"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, default="Lista zakupów")
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    household_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    items: Mapped[list["ShoppingItem"]] = relationship(
        "ShoppingItem", back_populates="list", cascade="all, delete-orphan"
    )


class ShoppingItem(TimestampMixin, Base):
    __tablename__ = "shopping_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, default=1.0)
    unit: Mapped[str] = mapped_column(String(30), default="szt.")
    is_checked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)

    list_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("shopping_lists.id", ondelete="CASCADE"), nullable=False, index=True
    )
    added_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    list: Mapped["ShoppingList"] = relationship("ShoppingList", back_populates="items")
