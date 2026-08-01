from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_active_household_id
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.food import User
from app.schemas.note import NoteOut, SyncRequest, SyncResponse
from app.services.note_sync import NoteSyncService

router = APIRouter(prefix="/notes", tags=["Notes"])


@router.post("/sync", response_model=SyncResponse)
async def sync_notes(
    payload: SyncRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    household_id: int = Depends(get_active_household_id),
):
    """Offline-first delta sync: push local changes, pull household changes.

    The client sends changes made since its last sync plus the `since` timestamp
    it received last time; the server merges (last-write-wins) and returns every
    note changed since then (including tombstones for deletions).
    """
    svc = NoteSyncService(db)
    server_time, notes = await svc.sync(
        household_id, current_user.id, payload.since, payload.changes
    )
    return SyncResponse(
        server_time=server_time,
        notes=[NoteOut.model_validate(n) for n in notes],
    )


@router.get("/", response_model=list[NoteOut])
async def list_notes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    household_id: int = Depends(get_active_household_id),
):
    """Convenience read of all live (non-deleted) notes for the active household."""
    svc = NoteSyncService(db)
    notes = await svc.changed_since(household_id, None)
    return [NoteOut.model_validate(n) for n in notes if not n.is_deleted]
