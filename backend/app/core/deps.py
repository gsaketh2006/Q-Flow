from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import AsyncGenerator, List

from app.core.config import settings
from app.core.security import decode_token
from app.db.session import get_db, async_session_maker
from app.models.user import User
from app.schemas.auth import TokenPayload

# Setup OAuth2 token scheme for extracting bearer token from Authorization header
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login"
)

async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    """
    FastAPI dependency to extract, decode, and validate the access token,
    returning the authenticated User model with their Role eagerly loaded.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload_dict = decode_token(token, settings.JWT_SECRET_KEY)
    if not payload_dict:
        raise credentials_exception
        
    try:
        token_data = TokenPayload(
            sub=payload_dict.get("sub"),
            role=payload_dict.get("role")
        )
    except Exception:
        raise credentials_exception
        
    if token_data.sub is None:
        raise credentials_exception
        
    # Eagerly load the user's role to avoid lazy loading issues in async context
    stmt = select(User).where(User.id == int(token_data.sub)).options(selectinload(User.role))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if user is None:
        raise credentials_exception
        
    return user

async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Dependency checking that the authenticated user is currently active.
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user

def check_role(allowed_roles: List[str]):
    """
    Role-based authorization dependency guard creator.
    Usage: Depends(check_role(["admin", "staff"]))
    """
    async def role_checker(
        current_user: User = Depends(get_current_active_user)
    ) -> User:
        if current_user.role.name not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource"
            )
        return current_user
    return role_checker
