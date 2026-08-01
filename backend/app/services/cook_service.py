"""Cooking assistant core logic (deterministic, LLM-independent):

- match a recipe from free text,
- diff its ingredients against what the household has in the fridge/pantry,
- auto-add the missing ones to the shopping list.

This is the engine the AI chat drives; keeping it here means the behaviour is
testable and identical whether or not a real LLM is configured.
"""
from dataclasses import dataclass, field
from typing import Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.food import FoodItem
from app.models.recipe import Recipe, RecipeIngredient
from app.repositories.food_repo import FoodRepository
from app.repositories.recipe_repo import RecipeRepository
from app.repositories.shopping_repo import ShoppingItemRepository, ShoppingListRepository

# Polish diacritics → ASCII, so "żeberka" matches "zeberka".
_FOLD = str.maketrans("ąćęłńóśźż", "acelnoszz")


def _fold(s: str) -> str:
    return s.lower().translate(_FOLD).strip()


def _tokens(s: str, min_len: int = 3) -> set[str]:
    return {t for t in _fold(s).replace(",", " ").split() if len(t) >= min_len}


def _ingredient_present(ingredient_name: str, item_names_folded: list[tuple[str, set[str]]]) -> bool:
    ing_full = _fold(ingredient_name)
    ing_tokens = _tokens(ingredient_name)
    for item_full, item_tokens in item_names_folded:
        # whole-token overlap (papryka ↔ papryka słodka)
        if ing_tokens & item_tokens:
            return True
        # substring either way for longer names (żeberka ↔ żeberka wieprzowe)
        if len(ing_full) >= 4 and (ing_full in item_full or item_full in ing_full):
            return True
    return False


@dataclass
class CookResult:
    recipe: Recipe | None = None
    have: list[str] = field(default_factory=list)
    missing: list[RecipeIngredient] = field(default_factory=list)
    added_to_shopping: list[str] = field(default_factory=list)
    shopping_list_id: int | None = None


class CookService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.recipes = RecipeRepository(db)
        self.food = FoodRepository(db)
        self.lists = ShoppingListRepository(db)
        self.items = ShoppingItemRepository(db)

    async def match_recipe(self, text: str) -> Recipe | None:
        """Find the recipe whose name/alias best matches the free text."""
        folded = _fold(text)
        all_recipes = await self.recipes.all_with_ingredients()
        best: tuple[int, Recipe] | None = None
        for recipe in all_recipes:
            candidates = [recipe.name] + [a for a in recipe.aliases.split(",") if a.strip()]
            for cand in candidates:
                cf = _fold(cand)
                if not cf:
                    continue
                # alias appears in the text, or the text shares a name token
                if cf in folded or (_tokens(cand) & _tokens(text)):
                    score = len(cf)
                    if best is None or score > best[0]:
                        best = (score, recipe)
        return best[1] if best else None

    async def diff_pantry(
        self, recipe: Recipe, household_id: int
    ) -> tuple[list[str], list[RecipeIngredient]]:
        items: Sequence[FoodItem] = await self.food.list_for_household(household_id)
        folded_items = [(_fold(i.name), _tokens(i.name)) for i in items]
        have: list[str] = []
        missing: list[RecipeIngredient] = []
        for ing in recipe.ingredients:
            if _ingredient_present(ing.name, folded_items):
                have.append(ing.name)
            elif not ing.is_optional:
                missing.append(ing)
        return have, missing

    async def _ensure_list(self, household_id: int, user_id: int):
        lists = await self.lists.list_for_household(household_id)
        if lists:
            return lists[0]
        return await self.lists.create(
            name="Lista zakupów", household_id=household_id, created_by=user_id
        )

    async def add_missing_to_shopping(
        self, household_id: int, user_id: int, missing: list[RecipeIngredient]
    ) -> tuple[int | None, list[str]]:
        if not missing:
            return None, []
        lst = await self._ensure_list(household_id, user_id)
        # avoid duplicates already on the list
        full = await self.lists.get_for_household(lst.id, household_id)
        existing = {_fold(i.name) for i in (full.items if full else [])}
        added: list[str] = []
        for ing in missing:
            if _fold(ing.name) in existing:
                continue
            await self.items.create(
                list_id=lst.id, name=ing.name, quantity=ing.quantity, unit=ing.unit,
                added_by=user_id,
            )
            existing.add(_fold(ing.name))
            added.append(ing.name)
        return lst.id, added

    async def cook(
        self, text: str, household_id: int, user_id: int, auto_add: bool = True
    ) -> CookResult:
        recipe = await self.match_recipe(text)
        if not recipe:
            return CookResult()
        have, missing = await self.diff_pantry(recipe, household_id)
        result = CookResult(recipe=recipe, have=have, missing=missing)
        if auto_add and missing:
            list_id, added = await self.add_missing_to_shopping(household_id, user_id, missing)
            result.shopping_list_id = list_id
            result.added_to_shopping = added
        return result
