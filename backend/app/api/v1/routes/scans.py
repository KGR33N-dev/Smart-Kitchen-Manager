from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.food import User
from app.repositories.scan_repo import ScanRepository
from app.schemas.food import ScanOut

router = APIRouter(prefix="/scans", tags=["Scan History"])


@router.get("/", response_model=list[ScanOut])
async def list_scans(
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the current user's recent scan history (receipts + camera frames)."""
    repo = ScanRepository(db)
    return await repo.list_for_user(current_user.id, limit=limit)
