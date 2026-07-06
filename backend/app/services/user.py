from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import Optional

from app.models.user import User
from app.models.role import Role
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import get_password_hash

async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    """
    Fetch a user by email, eagerly loading their role.
    """
    stmt = select(User).where(User.email == email).options(selectinload(User.role))
    result = await db.execute(stmt)
    return result.scalar_one_or_none()

async def get_user_by_id(db: AsyncSession, user_id: int) -> Optional[User]:
    """
    Fetch a user by ID, eagerly loading their role.
    """
    stmt = select(User).where(User.id == user_id).options(selectinload(User.role))
    result = await db.execute(stmt)
    return result.scalar_one_or_none()

async def create_user(db: AsyncSession, user_in: UserCreate, role_id: int = 1) -> User:
    """
    Create a new user (defaults to role_id=1, which is 'citizen') and hash their password.
    """
    password_hash = get_password_hash(user_in.password)
    db_user = User(
        email=user_in.email,
        full_name=user_in.full_name,
        phone=user_in.phone,
        language_pref=user_in.language_pref,
        password_hash=password_hash,
        role_id=role_id,
        is_active=True
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    
    # Reload with role relationship loaded
    return await get_user_by_id(db, db_user.id)  # type: ignore
