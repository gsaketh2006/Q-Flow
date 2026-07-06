from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class QueueEntryBase(BaseModel):
    appointment_id: int
    office_id: int
    position: int
    status: str  # waiting, called, processing, completed, skipped
    estimated_wait_minutes: int
    called_at: Optional[datetime] = None

class QueueEntryCreate(BaseModel):
    appointment_id: int

class QueueEntryResponse(QueueEntryBase):
    id: int
    counter_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class QueueEntryWithDetailsResponse(QueueEntryResponse):
    citizen_name: str
    service_name: str
    ticket_number: str  # e.g., A-102 (constructed from service initials/id & position)
    counter_name: Optional[str] = None

    class Config:
        from_attributes = True
