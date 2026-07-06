from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class CounterBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    office_id: int
    assigned_staff_id: Optional[int] = None
    is_active: bool = True

class CounterCreate(CounterBase):
    pass

class CounterUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    assigned_staff_id: Optional[int] = None
    is_active: Optional[bool] = None

class CounterResponse(CounterBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
