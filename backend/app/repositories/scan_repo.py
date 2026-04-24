from typing import Sequence
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.food import ScanHistory, AIFeedback
from app.repositories.base import BaseRepository


class ScanRepository(BaseRepository[ScanHistory]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(ScanHistory, db)

    async def list_for_user(self, user_id: int, limit: int = 50) -> Sequence[ScanHistory]:
        result = await self.db.execute(
            select(ScanHistory)
            .where(ScanHistory.user_id == user_id)
            .order_by(ScanHistory.created_at.desc())
            .limit(limit)
        )
        return result.scalars().all()

    async def update_task(self, scan_id: int, task_id: str, status: str = "processing") -> None:
        from sqlalchemy import update
        await self.db.execute(
            update(ScanHistory)
            .where(ScanHistory.id == scan_id)
            .values(task_id=task_id, task_status=status)
        )


class AIFeedbackRepository(BaseRepository[AIFeedback]):
    def __init__(self, db: AsyncSession) -> None:
        super().__init__(AIFeedback, db)

    async def get_recent_for_user(self, user_id: int, limit: int = 10) -> Sequence[AIFeedback]:
        """Returns the most recent N corrections – used for few-shot prompting."""
        result = await self.db.execute(
            select(AIFeedback)
            .where(AIFeedback.user_id == user_id)
            .order_by(AIFeedback.created_at.desc())
            .limit(limit)
        )
        return result.scalars().all()
