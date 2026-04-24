import os
import uuid
import shutil
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException, status
from app.core.config import settings
from app.schemas.food import ReceiptScanOut, CameraScanOut

router = APIRouter(prefix="/upload", tags=["File Upload"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic"}
MAX_BYTES = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024


def _save_upload(upload: UploadFile, subfolder: str) -> tuple[str, str]:
    """Save uploaded file to disk, return (stored_path, unique_filename)."""
    if upload.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {upload.content_type}. Allowed: {ALLOWED_IMAGE_TYPES}",
        )

    dest_dir = Path(settings.UPLOAD_DIR) / subfolder
    dest_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(upload.filename or "image.jpg").suffix or ".jpg"
    unique_name = f"{uuid.uuid4().hex}{ext}"
    dest_path = dest_dir / unique_name

    with dest_path.open("wb") as out:
        content = upload.file.read(MAX_BYTES + 1)
        if len(content) > MAX_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds max size of {settings.MAX_UPLOAD_SIZE_MB} MB",
            )
        out.write(content)

    return str(dest_path), unique_name


# ─── Receipt upload ───────────────────────────────────────────────────────────

@router.post(
    "/receipt",
    response_model=ReceiptScanOut,
    status_code=status.HTTP_201_CREATED,
    summary="Upload receipt image for OCR parsing",
)
async def upload_receipt(file: UploadFile = File(..., description="JPEG/PNG photo of a shopping receipt")):
    """
    Accepts a receipt photo.
    In a real implementation this would be forwarded to an OCR / AI service.
    Returns a stub ReceiptScanOut – hook in your AI layer here.
    """
    stored_path, unique_name = _save_upload(file, "receipts")

    # --- TODO: call OCR / OpenAI Vision here and parse items ---
    parsed_count = 0  # placeholder

    return {
        "id": 1,  # In production: save to DB and return real ID
        "original_filename": file.filename or unique_name,
        "parsed_items_count": parsed_count,
        "scanned_at": __import__("datetime").datetime.utcnow(),
    }


# ─── IoT Camera frame upload ──────────────────────────────────────────────────

@router.post(
    "/camera",
    response_model=CameraScanOut,
    status_code=status.HTTP_201_CREATED,
    summary="Upload IoT camera frame for AI analysis",
)
async def upload_camera_frame(file: UploadFile = File(..., description="Camera snapshot from IoT fridge/pantry sensor")):
    """
    Accepts a camera frame from an IoT device.
    In a real implementation this would run object detection /
    food freshness analysis.
    """
    stored_path, unique_name = _save_upload(file, "camera")

    # --- TODO: call AI vision model here ---
    detected: str = "[]"  # JSON list placeholder

    return {
        "id": 1,
        "original_filename": file.filename or unique_name,
        "detected_items": detected,
        "analysed_at": __import__("datetime").datetime.utcnow(),
    }
