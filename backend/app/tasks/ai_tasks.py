"""
Celery Tasks — Heavy background processing
- process_receipt_image: OCR + AI parse → bulk create FoodItems
- process_camera_frame: IoT freshness analysis
- reset_monthly_scan_counts: Freemium quota reset (daily beat)
- update_expiry_statuses: Auto-expire stale items (6h beat)
"""
import asyncio
from datetime import datetime, timezone

from celery.utils.log import get_task_logger
from sqlalchemy import update

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
    """Background receipt OCR + parse → bulk-create FoodItems (shared logic)."""
    async def _inner():
        from app.core.database import AsyncSessionLocal
        from app.services.scan_processing import run_receipt_processing

        async with AsyncSessionLocal() as db:
            try:
                return await run_receipt_processing(
                    db, scan_id, user_id, image_path, task_id=self.request.id
                )
            except Exception as exc:  # noqa: BLE001
                raise self.retry(exc=exc, countdown=30)

    return _run(_inner())


@celery_app.task(bind=True, name="app.tasks.ai_tasks.process_camera_frame")
def process_camera_frame(self, scan_id: int, user_id: int, image_path: str, item_name: str):
    """IoT camera freshness analysis (shared logic)."""
    async def _inner():
        from app.core.database import AsyncSessionLocal
        from app.services.scan_processing import run_camera_processing

        async with AsyncSessionLocal() as db:
            try:
                return await run_camera_processing(
                    db, scan_id, user_id, image_path, item_name, task_id=self.request.id
                )
            except Exception as exc:  # noqa: BLE001
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
