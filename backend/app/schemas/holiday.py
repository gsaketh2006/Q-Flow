from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional

class HolidayBase(BaseModel):
    date: date
    description: str = Field(..., min_length=1, max_length=255)
    office_id: Optional[int] = None

class HolidayCreate(HolidayBase):
    pass

class HolidayResponse(HolidayBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
