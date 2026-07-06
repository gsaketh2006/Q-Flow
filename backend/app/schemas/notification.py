from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class NotificationResponse(BaseModel):
    id: int
    user_id: int
    appointment_id: Optional[int]
    type: str  # email, sms, whatsapp
    status: str  # pending, sent, failed
    recipient_address: str
    message_body: str
    sent_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True
