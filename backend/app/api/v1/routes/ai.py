from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_active_household_id
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.food import User
from app.schemas.chat import ChatRequest, ChatResponse
from app.schemas.recipe import RecipeIngredientOut, RecipeOut
from app.services.chat_service import ChatService

router = APIRouter(prefix="/ai", tags=["AI Assistant"])


@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    household_id: int = Depends(get_active_household_id),
):
    """Cooking assistant: matches a recipe, diffs the fridge/pantry, and
    auto-adds missing ingredients to the shopping list."""
    svc = ChatService(db)
    outcome = await svc.chat(
        payload.message, household_id, current_user.id, auto_add=payload.auto_add
    )
    r = outcome.result
    return ChatResponse(
        reply=outcome.reply,
        intent=outcome.intent,  # type: ignore[arg-type]
        recipe=RecipeOut.model_validate(r.recipe) if r.recipe else None,
        have=r.have,
        missing=[RecipeIngredientOut.model_validate(m) for m in r.missing],
        added_to_shopping=r.added_to_shopping,
        shopping_list_id=r.shopping_list_id,
    )
