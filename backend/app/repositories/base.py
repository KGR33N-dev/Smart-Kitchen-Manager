"""Generic async repository base — all other repos inherit from this."""
from typing import Any, Generic, Sequence, Type, TypeVar

from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import Base

ModelT = TypeVar("ModelT", bound=Base)  # type: ignore[type-arg]


class BaseRepository(Generic[ModelT]):
    def __init__(self, model: Type[ModelT], db: AsyncSession) -> None:
        self.model = model
        self.db = db

    async def get(self, id: int) -> ModelT | None:
        result = await self.db.execute(select(self.model).where(self.model.id == id))  # type: ignore
        return result.scalars().first()

    async def list(self, **filters: Any) -> Sequence[ModelT]:
        q = select(self.model)
        for attr, val in filters.items():
            q = q.where(getattr(self.model, attr) == val)
        result = await self.db.execute(q)
        return result.scalars().all()

    async def create(self, **kwargs: Any) -> ModelT:
        obj = self.model(**kwargs)
        self.db.add(obj)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def update(self, id: int, **kwargs: Any) -> ModelT | None:
        await self.db.execute(
            update(self.model)
            .where(self.model.id == id)  # type: ignore
            .values(**kwargs)
        )
        return await self.get(id)

    async def delete(self, id: int) -> bool:
        result = await self.db.execute(
            delete(self.model).where(self.model.id == id)  # type: ignore
        )
        return result.rowcount > 0
