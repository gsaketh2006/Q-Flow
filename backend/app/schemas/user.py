from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional

class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    language_pref: str = Field("en", max_length=10)

class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=100)

class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    language_pref: Optional[str] = Field(None, max_length=10)
    password: Optional[str] = Field(None, min_length=6, max_length=100)
    is_active: Optional[bool] = None

class UserAdminUpdate(UserUpdate):
    role_id: Optional[int] = None

class UserResponse(UserBase):
    id: int
    role_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        
class UserWithRoleResponse(UserResponse):
    role_name: str

    class Config:
        from_attributes = True
