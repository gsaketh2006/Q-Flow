import secrets
from datetime import datetime, date, timezone
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from typing import Optional, List

from app.models.appointment import Appointment
from app.models.queue_entry import QueueEntry
from app.models.office import Office
from app.models.service import Service
from app.models.counter import Counter
from app.models.holiday import Holiday
from app.schemas.appointment import AppointmentCreate, AppointmentUpdate
from app.services.office import get_holidays_by_office
from app.services.audit import log_action
from app.services.queue import broadcast_queue_update

async def get_appointment_by_id(db: AsyncSession, appt_id: int) -> Optional[Appointment]:
    stmt = (
        select(Appointment)
        .where(Appointment.id == appt_id)
        .options(
            selectinload(Appointment.user),
            selectinload(Appointment.office),
            selectinload(Appointment.service),
            selectinload(Appointment.counter)
        )
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()

async def get_appointments(
    db: AsyncSession,
    user_id: Optional[int] = None,
    office_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 100
) -> List[Appointment]:
    stmt = select(Appointment).options(
        selectinload(Appointment.user),
        selectinload(Appointment.office),
        selectinload(Appointment.service),
        selectinload(Appointment.counter)
    )
    
    if user_id:
        stmt = stmt.where(Appointment.user_id == user_id)
    if office_id:
        stmt = stmt.where(Appointment.office_id == office_id)
    if status_filter:
        stmt = stmt.where(Appointment.status == status_filter)
    if date_from:
        stmt = stmt.where(Appointment.scheduled_time >= date_from)
    if date_to:
        stmt = stmt.where(Appointment.scheduled_time <= date_to)
        
    stmt = stmt.order_by(Appointment.scheduled_time.asc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())

async def create_appointment(db: AsyncSession, user_id: int, appt_in: AppointmentCreate) -> Appointment:
    # 1. Verify office and service exist and are active
    stmt_office = select(Office).where(Office.id == appt_in.office_id, Office.is_active == True)
    office_res = await db.execute(stmt_office)
    office = office_res.scalar_one_or_none()
    if not office:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Office not found or inactive")
        
    stmt_service = select(Service).where(
        Service.id == appt_in.service_id,
        Service.office_id == appt_in.office_id,
        Service.is_active == True
    )
    service_res = await db.execute(stmt_service)
    service = service_res.scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found or inactive for this office")

    # 2. Check if the scheduled date falls on a holiday
    scheduled_date = appt_in.scheduled_time.date()
    holidays = await get_holidays_by_office(db, appt_in.office_id)
    for holiday in holidays:
        if holiday.date == scheduled_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot book appointment: Selected date is a holiday ({holiday.description})."
            )

    # 3. Generate secure signed-like random URL-safe QR token
    qr_token = secrets.token_urlsafe(32)

    db_appt = Appointment(
        user_id=user_id,
        office_id=appt_in.office_id,
        service_id=appt_in.service_id,
        scheduled_time=appt_in.scheduled_time,
        status="confirmed",  # bookings are auto-confirmed on creation
        qr_code_token=qr_token
    )
    db.add(db_appt)
    await db.commit()
    await db.refresh(db_appt)
    
    # Write audit log
    await log_action(
        db,
        user_id=user_id,
        action="create_appointment",
        entity_type="appointments",
        entity_id=db_appt.id,
        action_metadata={"office_id": appt_in.office_id, "service_id": appt_in.service_id}
    )

    return await get_appointment_by_id(db, db_appt.id)  # type: ignore

async def cancel_appointment(db: AsyncSession, appt_id: int, user_id: int, is_staff_or_admin: bool) -> Appointment:
    appt = await get_appointment_by_id(db, appt_id)
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    if not is_staff_or_admin and appt.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only cancel your own appointments")

    if appt.status in ["cancelled", "completed", "no_show"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot cancel appointment with status: {appt.status}")

    appt.status = "cancelled"
    appt.updated_at = datetime.now(timezone.utc)
    db.add(appt)
    await db.commit()
    await db.refresh(appt)

    # Write audit log
    await log_action(
        db,
        user_id=user_id,
        action="cancel_appointment",
        entity_type="appointments",
        entity_id=appt.id,
        action_metadata={"cancelled_by": "staff" if is_staff_or_admin else "citizen"}
    )

    return appt

async def check_in_appointment(
    db: AsyncSession,
    appt_id: int,
    qr_code_token: Optional[str],
    user_id: int,
    is_staff_or_admin: bool
) -> QueueEntry:
    """
    Check in for an appointment. If verified, transition status to 'checked_in'
    and insert a new QueueEntry calculating estimated wait.
    """
    appt = await get_appointment_by_id(db, appt_id)
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    if appt.status != "confirmed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Check-in failed. Appointment is currently in status: {appt.status}"
        )

    # If citizen is checking in, verify QR token
    if not is_staff_or_admin:
        if not qr_code_token or appt.qr_code_token != qr_code_token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid QR Code Token")
        
        # Check-in time window check (e.g. maximum 15m before and up to 30m after scheduled time)
        time_diff_sec = (datetime.now(timezone.utc) - appt.scheduled_time.replace(tzinfo=timezone.utc)).total_seconds()
        # 15 minutes before is -900 seconds. 30 minutes after is +1800 seconds.
        if time_diff_sec < -900:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Too early to check in. Please check in starting 15 minutes before your slot."
            )
        if time_diff_sec > 1800:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Too late to check in. Your slot expired 30 minutes ago. Please schedule a new appointment."
            )

    # 1. Update appointment status
    appt.status = "checked_in"
    appt.updated_at = datetime.now(timezone.utc)
    db.add(appt)

    # 2. Get current daily queue position
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    stmt_pos = select(func.count(QueueEntry.id)).where(
        and_(
            QueueEntry.office_id == appt.office_id,
            QueueEntry.created_at >= today_start
        )
    )
    res_pos = await db.execute(stmt_pos)
    today_count = res_pos.scalar() or 0
    new_position = today_count + 1

    # 3. Calculate waiting time estimation: (Waiting tickets * service duration) / Active counters
    stmt_waiting = select(func.count(QueueEntry.id)).where(
        and_(
            QueueEntry.office_id == appt.office_id,
            QueueEntry.status == "waiting"
        )
    )
    res_waiting = await db.execute(stmt_waiting)
    waiting_count = res_waiting.scalar() or 0

    stmt_counters = select(func.count(Counter.id)).where(
        and_(
            Counter.office_id == appt.office_id,
            Counter.is_active == True
        )
    )
    res_counters = await db.execute(stmt_counters)
    active_counters = res_counters.scalar() or 1
    
    # Calculate estimated wait
    estimated_wait = int((waiting_count * appt.service.avg_duration_minutes) / max(active_counters, 1))

    # 4. Create QueueEntry
    db_queue = QueueEntry(
        appointment_id=appt.id,
        office_id=appt.office_id,
        position=new_position,
        status="waiting",
        estimated_wait_minutes=estimated_wait,
        created_at=datetime.now(timezone.utc)
    )
    db.add(db_queue)
    await db.commit()
    await db.refresh(db_queue)

    # Log action
    await log_action(
        db,
        user_id=user_id,
        action="check_in",
        entity_type="appointments",
        entity_id=appt.id,
        action_metadata={"queue_entry_id": db_queue.id, "position": new_position}
    )
    await broadcast_queue_update(db, appt.office_id)

    return db_queue
