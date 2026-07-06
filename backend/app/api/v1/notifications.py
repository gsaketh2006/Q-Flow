from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.db.session import get_db
from app.core.deps import get_current_active_user, check_role
from app.models.user import User
from app.schemas.notification import NotificationResponse
from app.services import notification as notification_service

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("", response_model=List[NotificationResponse])
async def list_notifications(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List notifications. Citizens see only their own notifications.
    Admins see global notification logs.
    """
    is_admin = current_user.role.name == "admin"
    
    # Filter by user ID if not admin
    target_user_id = None if is_admin else current_user.id
    
    return await notification_service.get_notifications(
        db, user_id=target_user_id, skip=skip, limit=limit
    )

@router.get("/{id}", response_model=NotificationResponse)
async def read_notification(
    id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve specific notification details. Citizens can only view their own.
    """
    notif = await notification_service.get_notification_by_id(db, id)
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    is_admin = current_user.role.name == "admin"
    if not is_admin and notif.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
        
    return notif

@router.post("/resend/{id}", status_code=status.HTTP_200_OK)
async def resend_notification(
    id: int,
    current_user: User = Depends(check_role(["staff", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Manually retry sending a failed notification (Staff and Admin only).
    """
    success = await notification_service.trigger_resend(db, id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    return {"message": "Notification resent successfully"}
