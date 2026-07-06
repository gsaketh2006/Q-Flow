import hashlib
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import Optional, Tuple

from app.core.config import settings
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token, decode_token
from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.services.user import get_user_by_email, get_user_by_id

def hash_token(token: str) -> str:
    """
    Generate a SHA-256 hash of a raw token string for secure database storage.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

async def authenticate_user(db: AsyncSession, email: str, password: str) -> Optional[User]:
    """
    Authenticate a user by email and password. Returns the User model if authenticated, else None.
    """
    user = await get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user

async def create_session(db: AsyncSession, user_id: int, role_name: str, device_info: Optional[str] = None) -> Tuple[str, str]:
    """
    Create a new session: generate access and refresh tokens, store the refresh token hash, and return both tokens.
    """
    access_token = create_access_token(subject=user_id, role=role_name)
    refresh_token = create_refresh_token(subject=user_id)
    
    token_hash = hash_token(refresh_token)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    db_refresh_token = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at,
        device_info=device_info,
        issued_at=datetime.now(timezone.utc)
    )
    db.add(db_refresh_token)
    await db.commit()
    
    return access_token, refresh_token

async def rotate_session(db: AsyncSession, old_refresh_token: str, device_info: Optional[str] = None) -> Tuple[str, str]:
    """
    Rotate refresh tokens: Validate old token hash, mark it revoked, generate and store a new access/refresh token pair.
    Implements Refresh Token Rotation (RTR) to protect against replay attacks.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired session",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # 1. Decode token to check expiration and get user_id
    payload = decode_token(old_refresh_token, settings.JWT_REFRESH_SECRET_KEY)
    if not payload or not payload.get("sub"):
        raise credentials_exception
        
    user_id = int(payload.get("sub"))
    old_hash = hash_token(old_refresh_token)
    
    # 2. Fetch the refresh token from database
    stmt = select(RefreshToken).where(
        RefreshToken.token_hash == old_hash,
        RefreshToken.user_id == user_id
    )
    result = await db.execute(stmt)
    db_token = result.scalar_one_or_none()
    
    # 3. Security checks
    if not db_token:
        raise credentials_exception
        
    if db_token.revoked_at is not None:
        # Security Alert: A token was reused! Revoke all tokens for this user as a precaution
        print(f"WARNING: Revoked refresh token reuse detected for user {user_id}! Revoking all sessions.")
        await revoke_all_user_sessions(db, user_id)
        raise credentials_exception
        
    if db_token.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise credentials_exception
        
    # 4. Revoke old token
    db_token.revoked_at = datetime.now(timezone.utc)
    db.add(db_token)
    
    # 5. Fetch user role
    user = await get_user_by_id(db, user_id)
    if not user or not user.is_active:
        await db.commit()
        raise credentials_exception
        
    # 6. Create new rotated tokens
    new_access_token = create_access_token(subject=user_id, role=user.role.name)
    new_refresh_token = create_refresh_token(subject=user_id)
    new_hash = hash_token(new_refresh_token)
    new_expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    db_new_token = RefreshToken(
        user_id=user_id,
        token_hash=new_hash,
        expires_at=new_expires_at,
        device_info=device_info or db_token.device_info,
        issued_at=datetime.now(timezone.utc)
    )
    db.add(db_new_token)
    await db.commit()
    
    return new_access_token, new_refresh_token

async def revoke_session(db: AsyncSession, refresh_token: str) -> None:
    """
    Revoke a single active session (used during logout).
    """
    token_hash = hash_token(refresh_token)
    stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    result = await db.execute(stmt)
    db_token = result.scalar_one_or_none()
    
    if db_token:
        db_token.revoked_at = datetime.now(timezone.utc)
        db.add(db_token)
        await db.commit()

async def revoke_all_user_sessions(db: AsyncSession, user_id: int) -> None:
    """
    Revoke all active sessions for a user (used on security breaches or password resets).
    """
    stmt = (
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at == None)
        .values(revoked_at=datetime.now(timezone.utc))
    )
    await db.execute(stmt)
    await db.commit()

async def initiate_password_reset_flow(db: AsyncSession, email: str) -> None:
    """
    Initiate the password reset flow: generate a secure signed reset token,
    and log it to the console as a swappable fallback.
    """
    user = await get_user_by_email(db, email)
    if not user:
        # Prevent user enumeration: fail silently / return success message in router
        return
        
    # Generate stateless short-lived (1 hour) reset token signed with the JWT key
    reset_token = create_access_token(
        subject=user.email,
        role="password_reset_token",
        expires_delta=timedelta(hours=1)
    )
    
    # Mock Notification / Console logging fallback
    print(f"\n==================================================")
    print(f"PASSWORD RESET REQUEST FOR USER: {email}")
    print(f"Token: {reset_token}")
    print(f"Reset Link: http://localhost:5173/reset-password?token={reset_token}")
    print(f"==================================================\n")

async def complete_password_reset_flow(db: AsyncSession, token: str, new_password: str) -> None:
    """
    Consume the reset token, update the user password, and invalidate all existing sessions.
    """
    invalid_token_exception = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid or expired reset token"
    )
    
    payload = decode_token(token, settings.JWT_SECRET_KEY)
    if not payload or payload.get("role") != "password_reset_token":
        raise invalid_token_exception
        
    email = payload.get("sub")
    if not email:
        raise invalid_token_exception
        
    user = await get_user_by_email(db, email)
    if not user or not user.is_active:
        raise invalid_token_exception
        
    # Update password and revoke all active refresh tokens to force logout everywhere
    user.password_hash = get_password_hash(new_password)
    db.add(user)
    await revoke_all_user_sessions(db, user.id)
    await db.commit()
