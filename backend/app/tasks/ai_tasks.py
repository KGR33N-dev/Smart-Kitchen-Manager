"""
Celery Tasks — Heavy background processing
- process_receipt_image: OCR + AI parse → bulk create FoodItems
- process_camera_frame: IoT freshness analysis
- reset_monthly_scan_counts: Freemium quota reset (daily beat)
- update_expiry_statuses: Auto-expire stale items (6h beat)
"""
import asyncio
import json
from datetime import datetime, timezone

from celery import shared_task
from celery.utils.log import get_task_logger
from sqlalchemy import select, update

from app.tasks.celery_app import celery_app

logger = get_task_logger(__name__)


def _run(coro):
    """Run an async coroutine from synchronous Celery task context."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(bind=True, name="app.tasks.ai_tasks.process_receipt_image")
def process_receipt_image(self, scan_id: int, user_id: int, image_path: str):
    """
    Background task:
    1. Fetches user's AI feedback history for few-shot context
    2. Calls GPT-4o Vision to parse receipt
    3. Bulk-creates FoodItems for the user
    4. Updates ScanHistory record with results
    """
    async def _inner():
        from app.core.database import AsyncSessionLocal
        from app.repositories.scan_repo import ScanRepository, AIFeedbackRepository
        from app.services.ai_service import analyse_receipt
        from app.services.food_service import FoodService
        from app.models.food import ScanHistory

        async with AsyncSessionLocal() as db:
            # Update task status
            scan_repo = ScanRepository(db)
            await scan_repo.update_task(scan_id, self.request.id, "processing")
            await db.commit()

            # Get few-shot history
            fb_repo = AIFeedbackRepository(db)
            history = await fb_repo.get_recent_for_user(user_id)
            history_dicts = [
                {
                    "item_name": f.item_name,
                    "ai_prediction": f.ai_prediction,
                    "user_correction": f.user_correction,
                    "confirmed": f.confirmed,
                }
                for f in history
            ]

            # Call AI
            try:
                result = await analyse_receipt(image_path, history_dicts)
                items_data = result.get("items", [])

                # Bulk create food items
                food_svc = FoodService(db)
                created = await food_svc.bulk_create_from_receipt(user_id, items_data)

                # Update scan record
                await scan_repo.update_task(scan_id, self.request.id, "completed")
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
                logger.info(f"Receipt processed: {len(created)} items created for user {user_id}")
                return {"created": len(created)}

            except Exception as exc:
                await scan_repo.update_task(scan_id, self.request.id, "failed")
                await db.commit()
                logger.error(f"Receipt AI failed: {exc}")
                raise self.retry(exc=exc, countdown=30)

    return _run(_inner())


@celery_app.task(bind=True, name="app.tasks.ai_tasks.process_camera_frame")
def process_camera_frame(self, scan_id: int, user_id: int, image_path: str, item_name: str):
    """
    IoT camera freshness analysis — updates the related FoodItem status.
    """
    async def _inner():
        from app.core.database import AsyncSessionLocal
        from app.repositories.scan_repo import ScanRepository, AIFeedbackRepository
        from app.services.ai_service import analyse_freshness
        from app.models.food import ScanHistory, FoodItem, ItemStatus
        from sqlalchemy import update

        async with AsyncSessionLocal() as db:
            fb_repo = AIFeedbackRepository(db)
            history = await fb_repo.get_recent_for_user(user_id)
            history_dicts = [
                {
                    "item_name": f.item_name,
                    "ai_prediction": f.ai_prediction,
                    "user_correction": f.user_correction,
                    "confirmed": f.confirmed,
                }
                for f in history
            ]

            try:
                result = await analyse_freshness(image_path, item_name, history_dicts)
                ai_status = result.get("status", "fresh")
                confidence = result.get("confidence", 0.0)

                status_map = {
                    "fresh": ItemStatus.FRESH,
                    "expiring_soon": ItemStatus.EXPIRING_SOON,
                    "expired": ItemStatus.EXPIRED,
                }
                new_status = status_map.get(ai_status, ItemStatus.PENDING_VERIFICATION)

                # Mark item as pending AI verification
                await db.execute(
                    update(ScanHistory)
                    .where(ScanHistory.id == scan_id)
                    .values(
                        ai_response_json=json.dumps(result),
                        task_status="completed",
                    )
                )
                await db.commit()
                logger.info(f"Camera frame analysed: {item_name} → {ai_status}")
                return {"status": ai_status, "confidence": confidence}

            except Exception as exc:
                logger.error(f"Camera AI failed: {exc}")
                raise self.retry(exc=exc, countdown=60)

    return _run(_inner())


@celery_app.task(name="app.tasks.ai_tasks.reset_monthly_scan_counts")
def reset_monthly_scan_counts():
    """Resets per-user monthly scan counter on the 1st of each month."""
    async def _inner():
        from app.core.database import AsyncSessionLocal
        from app.models.food import User

        now = datetime.now(timezone.utc)
        if now.day != 1:
            return {"skipped": True}

        async with AsyncSessionLocal() as db:
            await db.execute(
                update(User).values(scans_this_month=0, scans_reset_at=now)
            )
            await db.commit()
            logger.info("Monthly scan counts reset")
        return {"reset": True}

    return _run(_inner())


@celery_app.task(name="app.tasks.ai_tasks.update_expiry_statuses")
def update_expiry_statuses():
    """
    Periodic task: recalculates ItemStatus for all non-expired items
    based on current date vs. expiry_date.
    """
    async def _inner():
        from app.core.database import AsyncSessionLocal
        from app.models.food import FoodItem, ItemStatus
        from sqlalchemy import select
        from datetime import timedelta

        async with AsyncSessionLocal() as db:
            now = datetime.now(timezone.utc)
            result = await db.execute(
                select(FoodItem).where(FoodItem.expiry_date.isnot(None))
            )
            items = result.scalars().all()

            updated = 0
            for item in items:
                exp = item.expiry_date
                if exp.tzinfo is None:
                    exp = exp.replace(tzinfo=timezone.utc)
                days = (exp - now).days
                if days < 0:
                    new_status = ItemStatus.EXPIRED
                elif days <= 3:
                    new_status = ItemStatus.EXPIRING_SOON
                else:
                    new_status = ItemStatus.FRESH

                if item.status != new_status:
                    item.status = new_status
                    updated += 1

            await db.commit()
            logger.info(f"Expiry statuses updated: {updated} items changed")
            return {"updated": updated}

    return _run(_inner())
