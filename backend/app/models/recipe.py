"""Recipes and their ingredients. System recipes are seeded and shared by all;
users may add household-scoped recipes too."""
from typing import Optional

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.food import TimestampMixin


class Recipe(TimestampMixin, Base):
    __tablename__ = "recipes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    instructions: Mapped[str] = mapped_column(Text, default="")
    servings: Mapped[int] = mapped_column(Integer, default=2)
    prep_minutes: Mapped[int] = mapped_column(Integer, default=30)
    # Comma-separated search aliases (e.g. "żeberka,ribs,żeberka bbq").
    aliases: Mapped[str] = mapped_column(String(400), default="")
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)

    # Null for global/system recipes; set for user-created ones.
    household_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=True, index=True
    )

    ingredients: Mapped[list["RecipeIngredient"]] = relationship(
        "RecipeIngredient", back_populates="recipe", cascade="all, delete-orphan"
    )


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, default=1.0)
    unit: Mapped[str] = mapped_column(String(30), default="szt.")
    # Pantry staples (salt, pepper, water) — usually assumed present, don't add
    # to the shopping list unless clearly missing.
    is_optional: Mapped[bool] = mapped_column(Boolean, default=False)

    recipe_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    recipe: Mapped["Recipe"] = relationship("Recipe", back_populates="ingredients")
