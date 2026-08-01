from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.household import MemberRole


class HouseholdCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)


class HouseholdJoin(BaseModel):
    code: str = Field(..., min_length=4, max_length=12)


class MemberOut(BaseModel):
    user_id: int
    email: str
    full_name: str
    role: MemberRole


class HouseholdOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    join_code: str
    is_personal: bool
    owner_id: int
    created_at: datetime
    # Contextual, filled per request:
    role: Optional[MemberRole] = None
    is_active: bool = False
    member_count: int = 0


class JoinCodeOut(BaseModel):
    join_code: str
