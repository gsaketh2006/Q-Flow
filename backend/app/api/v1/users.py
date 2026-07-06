from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.deps import get_current_active_user
from app.models.user import User
from app.schemas.user import UserResponse, UserUpdate, UserWithRoleResponse

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/me", response_model=UserWithRoleResponse)
async def read_user_me(
    current_user: User = Depends(get_current_active_user)
):
    """
    Get current logged-in user profile details (including their role).
    """
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "phone": current_user.phone,
        "language_pref": current_user.language_pref,
        "role_id": current_user.role_id,
        "role_name": current_user.role.name,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at,
        "updated_at": current_user.updated_at,
    }

@router.put("/me", response_model=UserResponse)
async def update_user_me(
    user_in: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update current logged-in user profile fields.
    """
    if user_in.full_name is not None:
        current_user.full_name = user_in.full_name
    if user_in.phone is not None:
        current_user.phone = user_in.phone
    if user_in.language_pref is not None:
        current_user.language_pref = user_in.language_pref
        
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return current_user
