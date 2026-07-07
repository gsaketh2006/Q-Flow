from fastapi import APIRouter, Depends, HTTPException, Request, Response, status, Cookie
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.db.session import get_db
from app.models.role import Role
from app.schemas.user import UserCreate, UserResponse, UserWithRoleResponse
from app.schemas.auth import Token, ForgotPasswordRequest, ResetPasswordRequest, MessageResponse
from app.services import user as user_service
from app.services import auth as auth_service
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=UserWithRoleResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new citizen account.
    """
    existing_user = await user_service.get_user_by_email(db, user_in.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists."
        )

    role_result = await db.execute(select(Role).where(Role.name == "citizen"))
    citizen_role = role_result.scalar_one_or_none()
    if citizen_role is None:
        citizen_role = Role(name="citizen")
        db.add(citizen_role)
        await db.flush()
    
    new_user = await user_service.create_user(db, user_in, role_id=citizen_role.id)
    return new_user

@router.post("/login", response_model=Token)
async def login(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """
    OAuth2 compatible token login. Access token is returned in the response body.
    Refresh token is securely set in an HTTP-only cookie.
    """
    user = await auth_service.authenticate_user(db, form_data.username, form_data.password)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    access_token, refresh_token = await auth_service.create_session(
        db, user.id, user.role.name
    )
    
    # Set the refresh token as a secure, httpOnly cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite="lax",
        max_age=7 * 24 * 60 * 60,  # 7 days in seconds
        path="/api/v1/auth"  # restrict scope to auth paths
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/refresh", response_model=Token)
async def refresh(
    response: Response,
    refresh_token: Optional[str] = Cookie(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Rotate session tokens using the secure HTTP-only refresh cookie.
    """
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid"
        )
        
    new_access_token, new_refresh_token = await auth_service.rotate_session(
        db, refresh_token
    )
    
    # Set the rotated refresh token as a secure, httpOnly cookie
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite="lax",
        max_age=7 * 24 * 60 * 60,  # 7 days
        path="/api/v1/auth"
    )
    
    return {"access_token": new_access_token, "token_type": "bearer"}

@router.post("/logout", response_model=MessageResponse)
async def logout(
    response: Response,
    refresh_token: Optional[str] = Cookie(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Logout user by revoking their current active session and clearing cookies.
    """
    if refresh_token:
        await auth_service.revoke_session(db, refresh_token)
        
    response.delete_cookie(
        key="refresh_token",
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite="lax",
        path="/api/v1/auth"
    )
    
    return {"message": "Logged out successfully"}

@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    request: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Initiate password reset. If the email exists, a signed reset link is generated and logged.
    """
    await auth_service.initiate_password_reset_flow(db, request.email)
    
    # Bulletproof message to prevent user enumeration
    return {
        "message": "If the email is registered, a password reset link has been sent to it."
    }

@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    request: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Validate the signed reset token and update user password.
    """
    await auth_service.complete_password_reset_flow(db, request.token, request.new_password)
    return {
        "message": "Password reset successfully. Please login with your new password."
    }
