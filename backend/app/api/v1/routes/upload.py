import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.food import User, ScanType
from app.repositories.scan_repo import ScanRepository
from app.repositories.user_repo import UserRepository
from app.schemas.food import ScanOut
from app.services.payment_service import check_scan_quota

router = APIRouter(prefix="/upload", tags=["File Upload"])


async def _save(upload: UploadFile, folder: str) -> str:
    if upload.content_type not in settings.ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail=f"Unsupported type: {upload.content_type}")
    dest = Path(settings.UPLOAD_DIR) / folder
    dest.mkdir(parents=True, exist_ok=True)
    ext = Path(upload.filename or "img.jpg").suffix or ".jpg"
    name = f"{uuid.uuid4().hex}{ext}"
    path = dest / name
    content = await upload.read()
    if len(content) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large")
    path.write_bytes(content)
    return str(path)


@router.post("/receipt", response_model=ScanOut, status_code=status.HTTP_202_ACCEPTED)
async def upload_receipt(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Accepts a receipt image. Saves it, creates a ScanHistory record,
    then dispatches the Celery task for AI processing.
    Returns immediately with task_id for polling.
    """
    check_scan_quota(current_user)

    stored_path = await _save(file, "receipts")

    scan_repo = ScanRepository(db)
    scan = await scan_repo.create(
        user_id=current_user.id,
        scan_type=ScanType.RECEIPT,
        original_filename=file.filename or "receipt.jpg",
        stored_path=stored_path,
        task_status="queued",
    )
    await db.commit()

    # Dispatch Celery task (deferred import to avoid circular)
    from app.tasks.ai_tasks import process_receipt_image
    task = process_receipt_image.delay(scan.id, current_user.id, stored_path)

    # Update task_id
    await scan_repo.update_task(scan.id, task.id, "queued")
    await db.commit()

    # Increment scan usage counter
    user_repo = UserRepository(db)
    await user_repo.increment_scan_count(current_user.id)
    await db.commit()

    await db.refresh(scan)
    return scan


@router.post("/camera", response_model=ScanOut, status_code=status.HTTP_202_ACCEPTED)
async def upload_camera_frame(
    file: UploadFile = File(...),
    item_name: str = "Unknown item",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """IoT camera frame — dispatches freshness analysis Celery task."""
    stored_path = await _save(file, "camera")

    scan_repo = ScanRepository(db)
    scan = await scan_repo.create(
        user_id=current_user.id,
        scan_type=ScanType.CAMERA,
        original_filename=file.filename or "frame.jpg",
        stored_path=stored_path,
        task_status="queued",
    )
    await db.commit()

    from app.tasks.ai_tasks import process_camera_frame
    task = process_camera_frame.delay(scan.id, current_user.id, stored_path, item_name)
    await scan_repo.update_task(scan.id, task.id, "queued")
    await db.commit()

    await db.refresh(scan)
    return scan


@router.get("/status/{task_id}")
async def task_status(task_id: str, current_user: User = Depends(get_current_user)):
    """Poll Celery task status."""
    from app.tasks.celery_app import celery_app
    result = celery_app.AsyncResult(task_id)
    return {
        "task_id": task_id,
        "status": result.status,
        "result": result.result if result.ready() else None,
    }
