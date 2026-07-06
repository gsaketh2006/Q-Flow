from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class AppointmentBase(BaseModel):
    office_id: int
    service_id: int
    scheduled_time: datetime

class AppointmentCreate(AppointmentBase):
    user_id: Optional[int] = None  # Optional, so staff/admin can book on behalf of a citizen

class AppointmentUpdate(BaseModel):
    status: Optional[str] = Field(None, pattern="^(pending|confirmed|checked_in|in_progress|completed|cancelled|no_show)$")
    counter_id: Optional[int] = None

class AppointmentResponse(AppointmentBase):
    id: int
    user_id: int
    counter_id: Optional[int]
    status: str
    qr_code_token: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class AppointmentWithDetailsResponse(AppointmentResponse):
    citizen_name: str
    office_name: str
    service_name: str
    counter_name: Optional[str] = None

    class Config:
        from_attributes = True
