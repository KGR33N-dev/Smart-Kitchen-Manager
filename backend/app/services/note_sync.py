"""Note delta-sync — offline-first with last-write-wins conflict resolution.

Devices keep their notes locally (source of truth while offline) and periodically
push their changes + pull others'. Conflicts are resolved by the device clock
(`client_updated_at`): the most recently edited version wins. Deletions travel
as tombstones (`is_deleted=True`) so they propagate to every device.
"""
from datetime import datetime, timezone
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.note import Note
from app.schemas.note import NoteChange


def _to_naive_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


class NoteSyncService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _get(self, household_id: int, client_id: str) -> Note | None:
        result = await self.db.execute(
            select(Note)
            .where(Note.household_id == household_id)
            .where(Note.client_id == client_id)
        )
        return result.scalars().first()

    async def apply_changes(
        self, household_id: int, author_id: int, changes: Sequence[NoteChange]
    ) -> None:
        for change in changes:
            incoming_ts = _to_naive_utc(change.client_updated_at)
            existing = await self._get(household_id, change.client_id)
            if existing is None:
                self.db.add(
                    Note(
                        household_id=household_id,
                        author_id=author_id,
                        client_id=change.client_id,
                        title=change.title,
                        content=change.content,
                        color=change.color,
                        is_deleted=change.is_deleted,
                        client_updated_at=incoming_ts,
                    )
                )
            else:
                existing_ts = _to_naive_utc(existing.client_updated_at)
                # Last-write-wins: only apply if the incoming edit is newer.
                if existing_ts is None or incoming_ts >= existing_ts:
                    existing.title = change.title
                    existing.content = change.content
                    existing.color = change.color
                    existing.is_deleted = change.is_deleted
                    existing.client_updated_at = incoming_ts
        await self.db.flush()

    async def changed_since(self, household_id: int, since: datetime | None) -> Sequence[Note]:
        q = select(Note).where(Note.household_id == household_id)
        since_naive = _to_naive_utc(since)
        if since_naive is not None:
            # >= (not >) so we never miss rows written in the same second as `since`.
            q = q.where(Note.updated_at >= since_naive)
        q = q.order_by(Note.updated_at.asc())
        result = await self.db.execute(q)
        return result.scalars().all()

    async def sync(
        self, household_id: int, author_id: int, since: datetime | None, changes: Sequence[NoteChange]
    ) -> tuple[datetime, Sequence[Note]]:
        await self.apply_changes(household_id, author_id, changes)
        await self.db.commit()
        server_time = datetime.now(timezone.utc)
        notes = await self.changed_since(household_id, since)
        return server_time, notes
