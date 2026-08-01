"""
AI Service — Few-Shot Prompting with OpenAI GPT-4o
Handles: receipt OCR, food freshness analysis, personalized few-shot context
"""
import json
import base64
from pathlib import Path
from typing import Any

import httpx
from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.core.logging import log

client = AsyncOpenAI(
    api_key=settings.OPENAI_API_KEY,
    base_url=settings.OPENAI_BASE_URL
)


# ─── Schema for AI-parsed items ──────────────────────────────────────────────

RECEIPT_SYSTEM_PROMPT = """\
You are a smart kitchen assistant. The user uploads a supermarket receipt image.
Extract ALL food items with their names, quantities, units, and estimated expiry dates.
Return ONLY valid JSON matching this schema:
{
  "items": [
    {
      "name": "string",
      "quantity": number,
      "unit": "string (e.g. g, kg, L, szt.)",
      "category": "string (e.g. Dairy, Vegetables, Meat, Bakery, Fruit, Drinks, Other)",
      "estimated_expiry_days": number (days from today, or null if non-perishable)
    }
  ],
  "store_name": "string or null",
  "purchase_date": "ISO date string or null"
}
"""

FRESHNESS_SYSTEM_PROMPT = """\
You are a food freshness inspector. Analyse the provided image of a food item.
Return ONLY valid JSON:
{
  "status": "fresh" | "expiring_soon" | "expired",
  "confidence": number between 0.0 and 1.0,
  "reasoning": "brief explanation",
  "recommended_action": "keep" | "use_today" | "discard"
}
"""


# ─── Demo mode (no external model required) ──────────────────────────────────

_DEMO_BASKET = [
    {"name": "Mleko 3,2%", "quantity": 1, "unit": "L", "category": "Dairy", "estimated_expiry_days": 5},
    {"name": "Jogurt naturalny", "quantity": 2, "unit": "szt.", "category": "Dairy", "estimated_expiry_days": 10},
    {"name": "Chleb pszenny", "quantity": 1, "unit": "szt.", "category": "Bakery", "estimated_expiry_days": 3},
    {"name": "Pomidory", "quantity": 0.5, "unit": "kg", "category": "Vegetables", "estimated_expiry_days": 6},
    {"name": "Jabłka", "quantity": 6, "unit": "szt.", "category": "Fruit", "estimated_expiry_days": 14},
    {"name": "Filet z kurczaka", "quantity": 0.4, "unit": "kg", "category": "Meat", "estimated_expiry_days": 2},
    {"name": "Sok pomarańczowy", "quantity": 1, "unit": "L", "category": "Drinks", "estimated_expiry_days": 20},
]


def _demo_receipt(image_path: str) -> dict[str, Any]:
    """Deterministic heuristic 'parse' used when AI_DEMO_MODE is on.

    Picks a subset of a demo basket based on the image file size so different
    uploads yield slightly different results without any external model.
    """
    try:
        size = Path(image_path).stat().st_size
    except OSError:
        size = 0
    count = 3 + (size % 5)  # 3..7 items
    items = [dict(x) for x in _DEMO_BASKET[:count]]
    log.info("ai.receipt.demo", items_found=len(items))
    return {"items": items, "store_name": "Demo Market", "purchase_date": None}


def _demo_freshness(item_name: str) -> dict[str, Any]:
    log.info("ai.freshness.demo", item=item_name)
    return {
        "status": "fresh",
        "confidence": 0.75,
        "reasoning": "Demo mode — no vision model configured.",
        "recommended_action": "keep",
    }


def _build_few_shot_context(feedback_history: list[dict]) -> str:
    """Convert stored correction history into few-shot examples for the prompt."""
    if not feedback_history:
        return ""

    examples = []
    for fb in feedback_history[-settings.AI_FEW_SHOT_HISTORY_COUNT:]:
        examples.append(
            f"Item: {fb['item_name']} | "
            f"AI predicted: {fb['ai_prediction']} | "
            f"User corrected to: {fb['user_correction']} | "
            f"Confirmed: {'Yes' if fb['confirmed'] else 'No'}"
        )

    return (
        "\n\nUser correction history (learn from these):\n"
        + "\n".join(examples)
        + "\n\nApply these learnings to improve your predictions for similar items.\n"
    )


async def analyse_receipt(
    image_path: str,
    feedback_history: list[dict] | None = None,
) -> dict[str, Any]:
    """Public entrypoint — dispatches to demo or the real vision model."""
    if settings.AI_DEMO_MODE:
        return _demo_receipt(image_path)
    return await _analyse_receipt_model(image_path, feedback_history)


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def _analyse_receipt_model(
    image_path: str,
    feedback_history: list[dict] | None = None,
) -> dict[str, Any]:
    """
    Sends receipt image to GPT-4o Vision and returns structured list of food items.
    Includes few-shot context from user correction history.
    """
    log.info("ai.receipt.start", path=image_path)

    # Encode image as base64
    img_bytes = Path(image_path).read_bytes()
    b64 = base64.standard_b64encode(img_bytes).decode()
    ext = Path(image_path).suffix.lstrip(".")
    mime = f"image/{ext}" if ext in ("jpeg", "jpg", "png", "webp") else "image/jpeg"

    few_shot = _build_few_shot_context(feedback_history or [])
    system = RECEIPT_SYSTEM_PROMPT + few_shot

    response = await client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        max_tokens=settings.AI_MAX_TOKENS,
        messages=[
            {"role": "system", "content": system},
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime};base64,{b64}", "detail": "high"},
                    },
                    {"type": "text", "text": "Parse all food items from this receipt."},
                ],
            },
        ],
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content or "{}"
    result = json.loads(raw)
    log.info("ai.receipt.done", items_found=len(result.get("items", [])))
    return result


async def analyse_freshness(
    image_path: str,
    item_name: str,
    feedback_history: list[dict] | None = None,
) -> dict[str, Any]:
    """Public entrypoint — dispatches to demo or the real vision model."""
    if settings.AI_DEMO_MODE:
        return _demo_freshness(item_name)
    return await _analyse_freshness_model(image_path, item_name, feedback_history)


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def _analyse_freshness_model(
    image_path: str,
    item_name: str,
    feedback_history: list[dict] | None = None,
) -> dict[str, Any]:
    """
    Sends a food item image to GPT-4o Vision and predicts its freshness status.
    Uses few-shot personalisation from past Daily Check corrections.
    """
    log.info("ai.freshness.start", item=item_name, path=image_path)

    img_bytes = Path(image_path).read_bytes()
    b64 = base64.standard_b64encode(img_bytes).decode()
    ext = Path(image_path).suffix.lstrip(".")
    mime = f"image/{ext}" if ext in ("jpeg", "jpg", "png", "webp") else "image/jpeg"

    few_shot = _build_few_shot_context(feedback_history or [])
    system = FRESHNESS_SYSTEM_PROMPT + few_shot

    response = await client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        max_tokens=300,
        messages=[
            {"role": "system", "content": system},
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime};base64,{b64}", "detail": "auto"},
                    },
                    {
                        "type": "text",
                        "text": f"Evaluate the freshness of this item: '{item_name}'",
                    },
                ],
            },
        ],
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content or "{}"
    result = json.loads(raw)
    log.info("ai.freshness.done", status=result.get("status"), confidence=result.get("confidence"))
    return result


async def generate_savings_report(items: list[dict]) -> str:
    """Generates a human-readable savings/waste report for the current inventory."""
    prompt = (
        "Based on the following pantry snapshot, generate a brief, friendly zero-waste "
        "savings report in 2-3 sentences. Include estimated CO2 and money saved.\n\n"
        f"Inventory: {json.dumps(items, ensure_ascii=False)}"
    )
    response = await client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        max_tokens=200,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content or ""
