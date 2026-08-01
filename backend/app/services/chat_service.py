"""AI cooking chat.

Understands messages like "chcę zrobić żeberka", finds the recipe, checks the
household fridge/pantry, tells the user what's missing and auto-adds it to the
shopping list. Uses LangChain (ChatOpenAI) to phrase replies when a real model
is configured; falls back to deterministic Polish templates in AI_DEMO_MODE so
the whole flow works with zero external infrastructure.
"""
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import log
from app.repositories.food_repo import FoodRepository
from app.services.cook_service import CookResult, CookService

_INVENTORY_HINTS = ("co mam", "co mamy", "lodow", "lodów", "spiżar", "spizar", "mam w", "zapas")


@dataclass
class ChatOutcome:
    reply: str
    intent: str
    result: CookResult
    inventory: list[str]


class ChatService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.cook = CookService(db)
        self.food = FoodRepository(db)

    async def chat(
        self, message: str, household_id: int, user_id: int, auto_add: bool = True
    ) -> ChatOutcome:
        # 1) Try to match a recipe — that's the primary intent.
        result = await self.cook.cook(message, household_id, user_id, auto_add=auto_add)
        if result.recipe is not None:
            reply = await self._reply_for_recipe(result)
            return ChatOutcome(reply=reply, intent="recipe", result=result, inventory=[])

        # 2) Inventory question?
        if any(h in message.lower() for h in _INVENTORY_HINTS):
            items = [i.name for i in await self.food.list_for_household(household_id)]
            reply = (
                "Twoja lodówka i spiżarnia są puste — dodaj produkty albo zeskanuj paragon."
                if not items
                else "Masz w domu: " + ", ".join(items) + "."
            )
            return ChatOutcome(reply=reply, intent="inventory", result=CookResult(), inventory=items)

        # 3) Fallback.
        reply = (
            "Jestem Twoim kuchennym asystentem 👨‍🍳. Napisz np. „chcę zrobić żeberka”, "
            "a sprawdzę przepis, zobaczę co masz w lodówce i dopiszę brakujące produkty do listy zakupów. "
            "Znam m.in.: żeberka, spaghetti bolognese, naleśniki, jajecznicę, sałatkę grecką, rosół."
        )
        return ChatOutcome(reply=reply, intent="unknown", result=CookResult(), inventory=[])

    # ── Reply phrasing ────────────────────────────────────────────────────────

    async def _reply_for_recipe(self, r: CookResult) -> str:
        # Prefer a real LLM (via LangChain) when configured; fall back to template.
        if not settings.AI_DEMO_MODE:
            llm_reply = self._llm_reply(r)
            if llm_reply:
                return llm_reply
        return self._template_reply(r)

    def _template_reply(self, r: CookResult) -> str:
        assert r.recipe is not None
        name = r.recipe.name
        if not r.missing:
            return f"Masz wszystko na danie „{name}”! Można gotować 👨‍🍳 (czas: ok. {r.recipe.prep_minutes} min)."
        missing_str = ", ".join(f"{m.name} ({m.quantity:g} {m.unit})" for m in r.missing)
        have_str = ", ".join(r.have) if r.have else "nic z listy"
        parts = [f"Na „{name}” masz już: {have_str}.", f"Brakuje: {missing_str}."]
        if r.added_to_shopping:
            parts.append("Dopisałem do listy zakupów: " + ", ".join(r.added_to_shopping) + " 🛒.")
        return " ".join(parts)

    def _llm_reply(self, r: CookResult) -> str | None:
        """LangChain phrasing of the computed facts. Returns None on any failure."""
        try:
            from langchain_core.output_parsers import StrOutputParser
            from langchain_core.prompts import ChatPromptTemplate
            from langchain_openai import ChatOpenAI

            assert r.recipe is not None
            llm = ChatOpenAI(
                base_url=settings.OPENAI_BASE_URL,
                api_key=settings.OPENAI_API_KEY,
                model=settings.OPENAI_MODEL,
                max_tokens=settings.AI_MAX_TOKENS,
                temperature=0.4,
            )
            prompt = ChatPromptTemplate.from_messages([
                ("system",
                 "Jesteś przyjaznym asystentem kuchennym. Odpowiadasz po polsku, zwięźle (2-3 zdania). "
                 "Na podstawie faktów powiedz użytkownikowi czego brakuje i że dopisałeś to do listy zakupów."),
                ("human",
                 "Danie: {name}\nMam w domu: {have}\nBrakuje: {missing}\n"
                 "Dopisane do listy zakupów: {added}"),
            ])
            chain = prompt | llm | StrOutputParser()
            text = chain.invoke({
                "name": r.recipe.name,
                "have": ", ".join(r.have) or "nic",
                "missing": ", ".join(f"{m.name} ({m.quantity:g} {m.unit})" for m in r.missing) or "nic",
                "added": ", ".join(r.added_to_shopping) or "nic",
            })
            return text.strip() or None
        except Exception as exc:  # noqa: BLE001
            log.warning("chat.llm_failed", error=str(exc))
            return None
