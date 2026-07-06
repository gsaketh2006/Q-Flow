from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import datetime

from app.db.session import get_db
from app.core.deps import get_current_active_user
from app.models.user import User
from app.schemas.appointment import AppointmentCreate, AppointmentResponse, AppointmentWithDetailsResponse
from app.schemas.queue_entry import QueueEntryResponse
from app.services import appointment as appointment_service
from app.services.notification import (
    send_appointment_confirmation_task,
    send_appointment_cancellation_task,
    send_check_in_confirmation_task,
)

router = APIRouter(prefix="/appointments", tags=["Appointments"])

@router.get("", response_model=List[AppointmentResponse])
async def list_appointments(
    office_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    user_id: Optional[int] = Query(None, description="Admin/Staff only: filter by user ID"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List appointments. Citizens will only see their own appointments.
    Staff and Admins can query globally and filter by any user ID.
    """
    is_staff_or_admin = current_user.role.name in ["staff", "admin"]
    
    # Enforce database isolation for citizen users
    target_user_id = None
    if not is_staff_or_admin:
        target_user_id = current_user.id
    elif user_id:
        target_user_id = user_id
        
    return await appointment_service.get_appointments(
        db,
        user_id=target_user_id,
        office_id=office_id,
        status_filter=status_filter,
        date_from=date_from,
        date_to=date_to
    )

@router.get("/{id}", response_model=AppointmentWithDetailsResponse)
async def read_appointment(
    id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get details of a specific appointment. Citizens can only view their own.
    """
    appt = await appointment_service.get_appointment_by_id(db, id)
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
        
    is_staff_or_admin = current_user.role.name in ["staff", "admin"]
    if not is_staff_or_admin and appt.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return {
        "id": appt.id,
        "office_id": appt.office_id,
        "service_id": appt.service_id,
        "scheduled_time": appt.scheduled_time,
        "user_id": appt.user_id,
        "counter_id": appt.counter_id,
        "status": appt.status,
        "qr_code_token": appt.qr_code_token,
        "created_at": appt.created_at,
        "updated_at": appt.updated_at,
        "citizen_name": appt.user.full_name,
        "office_name": appt.office.name,
        "service_name": appt.service.name,
        "counter_name": appt.counter.name if appt.counter else None
    }

@router.post("", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
async def add_appointment(
    appt_in: AppointmentCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Book a new appointment. Citizen books for themselves.
    Staff and Admins can book on behalf of citizens by specifying `user_id`.
    """
    is_staff_or_admin = current_user.role.name in ["staff", "admin"]
    
    # Resolve target booking user ID
    target_user_id = current_user.id
    if is_staff_or_admin and appt_in.user_id:
        target_user_id = appt_in.user_id
        
    appt = await appointment_service.create_appointment(db, target_user_id, appt_in)
    background_tasks.add_task(send_appointment_confirmation_task, appt.id)
    return appt

@router.put("/{id}/cancel", response_model=AppointmentResponse)
async def cancel_booking(
    id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Cancel an appointment. Citizens can only cancel their own.
    """
    is_staff_or_admin = current_user.role.name in ["staff", "admin"]
    appt = await appointment_service.cancel_appointment(
        db, appt_id=id, user_id=current_user.id, is_staff_or_admin=is_staff_or_admin
    )
    background_tasks.add_task(send_appointment_cancellation_task, appt.id)
    return appt

@router.put("/{id}/check-in", response_model=QueueEntryResponse)
async def check_in_booking(
    id: int,
    background_tasks: BackgroundTasks,
    qr_code_token: Optional[str] = Query(None, description="Required for citizen self check-in"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Check in for an appointment.
    - Citizen: Requires passing the correct QR Code Token. Can only check in within (-15m, +30m) window of scheduled time.
    - Staff/Admin: Can check in manually on behalf of any customer (no QR token or window checks required).
    """
    is_staff_or_admin = current_user.role.name in ["staff", "admin"]
    queue_entry = await appointment_service.check_in_appointment(
        db,
        appt_id=id,
        qr_code_token=qr_code_token,
        user_id=current_user.id,
        is_staff_or_admin=is_staff_or_admin
    )
    
    # Send check-in email confirmation with ticket and wait details
    background_tasks.add_task(
        send_check_in_confirmation_task,
        id,
        queue_entry.position,
        queue_entry.estimated_wait_minutes
    )
    
    return queue_entry

@router.get("/{id}/qr")
async def get_appointment_qr_token(
    id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve the secure QR code token string for an appointment (Citizen own, Staff, Admin).
    """
    appt = await appointment_service.get_appointment_by_id(db, id)
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
        
    is_staff_or_admin = current_user.role.name in ["staff", "admin"]
    if not is_staff_or_admin and appt.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return {"qr_code_token": appt.qr_code_token}
