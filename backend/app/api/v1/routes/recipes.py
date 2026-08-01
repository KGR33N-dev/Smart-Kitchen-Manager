from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.food import User
from app.repositories.recipe_repo import RecipeRepository
from app.schemas.recipe import RecipeOut, RecipeSummary

router = APIRouter(prefix="/recipes", tags=["Recipes"])


@router.get("/", response_model=list[RecipeSummary])
async def list_recipes(
    q: str | None = Query(default=None, description="Search by name or alias"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = RecipeRepository(db)
    return await repo.list_all(q)


@router.get("/{recipe_id}", response_model=RecipeOut)
async def get_recipe(
    recipe_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = RecipeRepository(db)
    recipe = await repo.get_with_ingredients(recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Przepis nie znaleziony")
    return recipe
