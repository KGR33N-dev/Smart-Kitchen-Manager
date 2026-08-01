"""
Shared scan-processing logic used by BOTH the Celery workers and the inline
(no-Celery) code path in the upload routes. Keeping it here means there is a
single implementation regardless of how processing is dispatched.
"""
import json

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import log
from app.models.food import ItemStatus, ScanHistory
from app.repositories.scan_repo import AIFeedbackRepository, ScanRepository
from app.services.ai_service import analyse_freshness, analyse_receipt
from app.services.food_service import FoodService


async def _few_shot_history(db: AsyncSession, user_id: int) -> list[dict]:
    fb_repo = AIFeedbackRepository(db)
    history = await fb_repo.get_recent_for_user(user_id)
    return [
        {
            "item_name": f.item_name,
            "ai_prediction": f.ai_prediction,
            "user_correction": f.user_correction,
            "confirmed": f.confirmed,
        }
        for f in history
    ]


async def run_receipt_processing(
    db: AsyncSession,
    scan_id: int,
    user_id: int,
    image_path: str,
    task_id: str | None = None,
) -> dict:
    """Parse a receipt image and bulk-create food items. Commits its own work."""
    scan_repo = ScanRepository(db)
    await scan_repo.update_task(scan_id, task_id or "", "processing")
    await db.commit()

    history = await _few_shot_history(db, user_id)
    try:
        result = await analyse_receipt(image_path, history)
        items_data = result.get("items", [])

        food_svc = FoodService(db)
        created = await food_svc.bulk_create_from_receipt(user_id, items_data)

        await db.execute(
            update(ScanHistory)
            .where(ScanHistory.id == scan_id)
            .values(
                parsed_items_count=len(created),
                ai_response_json=json.dumps(result, ensure_ascii=False),
                task_status="completed",
            )
        )
        await db.commit()
        log.info("scan.receipt.done", user_id=user_id, created=len(created))
        return {"created": len(created), "items": items_data}
    except Exception as exc:  # noqa: BLE001
        await db.rollback()
        await scan_repo.update_task(scan_id, task_id or "", "failed")
        await db.commit()
        log.error("scan.receipt.failed", error=str(exc))
        raise


async def run_camera_processing(
    db: AsyncSession,
    scan_id: int,
    user_id: int,
    image_path: str,
    item_name: str,
    task_id: str | None = None,
) -> dict:
    """Analyse an IoT camera frame for freshness. Commits its own work."""
    scan_repo = ScanRepository(db)
    await scan_repo.update_task(scan_id, task_id or "", "processing")
    await db.commit()

    history = await _few_shot_history(db, user_id)
    try:
        result = await analyse_freshness(image_path, item_name, history)
        ai_status = result.get("status", "fresh")
        confidence = result.get("confidence", 0.0)

        status_map = {
            "fresh": ItemStatus.FRESH,
            "expiring_soon": ItemStatus.EXPIRING_SOON,
            "expired": ItemStatus.EXPIRED,
        }
        _ = status_map.get(ai_status, ItemStatus.PENDING_VERIFICATION)

        await db.execute(
            update(ScanHistory)
            .where(ScanHistory.id == scan_id)
            .values(
                ai_response_json=json.dumps(result, ensure_ascii=False),
                task_status="completed",
            )
        )
        await db.commit()
        log.info("scan.camera.done", item=item_name, status=ai_status)
        return {"status": ai_status, "confidence": confidence}
    except Exception as exc:  # noqa: BLE001
        await db.rollback()
        await scan_repo.update_task(scan_id, task_id or "", "failed")
        await db.commit()
        log.error("scan.camera.failed", error=str(exc))
        raise
