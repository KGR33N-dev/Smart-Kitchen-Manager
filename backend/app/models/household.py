"""Household (family group) + membership models — enables shared fridges,
pantries, shopping lists and notes across multiple users."""
import datetime
import enum
from typing import Optional

from sqlalchemy import (
    Boolean, DateTime, Enum, ForeignKey, Integer, String, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base
from app.models.food import TimestampMixin


class MemberRole(str, enum.Enum):
    OWNER = "owner"
    MEMBER = "member"


class Household(TimestampMixin, Base):
    __tablename__ = "households"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    # Short human-shareable code others use to join the household.
    join_code: Mapped[str] = mapped_column(String(12), unique=True, index=True, nullable=False)
    is_personal: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    owner_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    memberships: Mapped[list["HouseholdMembership"]] = relationship(
        "HouseholdMembership", back_populates="household", cascade="all, delete-orphan"
    )


class HouseholdMembership(TimestampMixin, Base):
    __tablename__ = "household_memberships"
    __table_args__ = (UniqueConstraint("household_id", "user_id", name="uq_household_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    household_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[MemberRole] = mapped_column(Enum(MemberRole), default=MemberRole.MEMBER, nullable=False)

    household: Mapped["Household"] = relationship("Household", back_populates="memberships")
    user: Mapped["User"] = relationship("User", back_populates="memberships")  # noqa: F821
