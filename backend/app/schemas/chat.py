from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.recipe import RecipeIngredientOut, RecipeOut


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    # When True, missing ingredients are auto-added to the shopping list.
    auto_add: bool = True


class ChatResponse(BaseModel):
    reply: str
    intent: Literal["recipe", "inventory", "unknown"]
    recipe: Optional[RecipeOut] = None
    have: list[str] = []
    missing: list[RecipeIngredientOut] = []
    added_to_shopping: list[str] = []
    shopping_list_id: Optional[int] = None
