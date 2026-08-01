from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


Period = Literal["daily", "weekly", "monthly"]


class NoteChange(BaseModel):
    """A single note/task change pushed from a device during sync."""
    client_id: str = Field(..., min_length=1, max_length=64)
    title: str = Field(default="", max_length=200)
    content: str = Field(default="")
    color: Optional[str] = Field(default=None, max_length=20)
    is_deleted: bool = False
    period: Period = "daily"
    is_done: bool = False
    remind_at: Optional[str] = Field(default=None, max_length=5)  # "HH:MM"
    client_updated_at: datetime


class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    client_id: str
    title: str
    content: str
    color: Optional[str]
    is_deleted: bool
    period: str
    is_done: bool
    remind_at: Optional[str]
    client_updated_at: datetime
    updated_at: datetime
    author_id: Optional[int] = None


class SyncRequest(BaseModel):
    # Timestamp of the client's last successful sync (server clock). None = full pull.
    since: Optional[datetime] = None
    changes: list[NoteChange] = []


class SyncResponse(BaseModel):
    server_time: datetime
    notes: list[NoteOut]
