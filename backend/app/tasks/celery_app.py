"""
Celery application factory — shared between workers and the FastAPI app.
"""
from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "smart_kitchen",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.tasks.ai_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,          # Re-queue on worker crash
    worker_prefetch_multiplier=1,  # Fair distribution across workers
    result_expires=60 * 60 * 24,  # Results kept 24h

    # Retry policy for transient failures
    task_annotations={
        "*": {
            "max_retries": 3,
            "default_retry_delay": 60,
        }
    },

    # Beat schedule (periodic tasks)
    beat_schedule={
        "reset-monthly-scans": {
            "task": "app.tasks.ai_tasks.reset_monthly_scan_counts",
            "schedule": 60 * 60 * 24,  # daily, real check inside task
        },
        "expire-items-check": {
            "task": "app.tasks.ai_tasks.update_expiry_statuses",
            "schedule": 60 * 60 * 6,  # every 6 hours
        },
    },
)
