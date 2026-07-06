from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime

class OfficeBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    address: str = Field(..., min_length=1, max_length=255)
    city: str = Field(..., min_length=1, max_length=100)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    working_hours: Optional[Dict[str, Any]] = None
    is_active: bool = True

class OfficeCreate(OfficeBase):
    pass

class OfficeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    address: Optional[str] = Field(None, min_length=1, max_length=255)
    city: Optional[str] = Field(None, min_length=1, max_length=100)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    working_hours: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

class OfficeResponse(OfficeBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
