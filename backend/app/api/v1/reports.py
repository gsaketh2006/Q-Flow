from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import Dict, Any

from app.db.session import get_db
from app.core.deps import get_current_active_user, check_role
from app.models.user import User
from app.models.appointment import Appointment
from app.models.queue_entry import QueueEntry
from app.models.counter import Counter

router = APIRouter(prefix="/reports", tags=["Reports"])

@router.get("/summary")
async def get_system_summary_report(
    current_user: User = Depends(check_role(["admin"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Get system-wide analytics summary (Admin only).
    """
    # 1. Total appointments count
    stmt_total = select(func.count(Appointment.id))
    res_total = await db.execute(stmt_total)
    total_appts = res_total.scalar() or 0

    # 2. Status counts
    stmt_completed = select(func.count(Appointment.id)).where(Appointment.status == "completed")
    res_completed = await db.execute(stmt_completed)
    completed_appts = res_completed.scalar() or 0

    stmt_no_show = select(func.count(Appointment.id)).where(Appointment.status == "no_show")
    res_no_show = await db.execute(stmt_no_show)
    no_show_appts = res_no_show.scalar() or 0

    # 3. Calculate average wait time (created_at to called_at) for called tickets
    stmt_wait = select(QueueEntry.created_at, QueueEntry.called_at).where(QueueEntry.called_at != None)
    res_wait = await db.execute(stmt_wait)
    wait_records = res_wait.all()

    total_wait_minutes = 0.0
    for created, called in wait_records:
        total_wait_minutes += (called - created).total_seconds() / 60.0
    avg_wait = round(total_wait_minutes / len(wait_records), 1) if wait_records else 0.0

    # 4. Calculate average service duration (called_at to updated_at when completed)
    stmt_svc = select(QueueEntry.called_at, QueueEntry.updated_at).where(QueueEntry.status == "completed")
    res_svc = await db.execute(stmt_svc)
    svc_records = res_svc.all()

    total_svc_minutes = 0.0
    for called, updated in svc_records:
        total_svc_minutes += (updated - called).total_seconds() / 60.0
    avg_svc = round(total_svc_minutes / len(svc_records), 1) if svc_records else 0.0

    return {
        "total_appointments": total_appts,
        "completed_appointments": completed_appts,
        "no_show_appointments": no_show_appts,
        "no_show_rate_percent": round((no_show_appts / max(total_appts, 1)) * 100, 1),
        "average_wait_time_minutes": avg_wait,
        "average_service_time_minutes": avg_svc
    }

@router.get("/office/{id}")
async def get_office_analytics_report(
    id: int,
    current_user: User = Depends(check_role(["staff", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Get office-specific analytics summary (Staff and Admin only).
    """
    # 1. Total appointments count
    stmt_total = select(func.count(Appointment.id)).where(Appointment.office_id == id)
    res_total = await db.execute(stmt_total)
    total_appts = res_total.scalar() or 0

    # 2. Completed count
    stmt_completed = select(func.count(Appointment.id)).where(and_(Appointment.office_id == id, Appointment.status == "completed"))
    res_completed = await db.execute(stmt_completed)
    completed_appts = res_completed.scalar() or 0

    # 3. No Show count
    stmt_no_show = select(func.count(Appointment.id)).where(and_(Appointment.office_id == id, Appointment.status == "no_show"))
    res_no_show = await db.execute(stmt_no_show)
    no_show_appts = res_no_show.scalar() or 0

    # 4. Average wait time in this office
    stmt_wait = select(QueueEntry.created_at, QueueEntry.called_at).where(and_(QueueEntry.office_id == id, QueueEntry.called_at != None))
    res_wait = await db.execute(stmt_wait)
    wait_records = res_wait.all()

    total_wait_minutes = 0.0
    for created, called in wait_records:
        total_wait_minutes += (called - created).total_seconds() / 60.0
    avg_wait = round(total_wait_minutes / len(wait_records), 1) if wait_records else 0.0

    # 5. Average service duration in this office
    stmt_svc = select(QueueEntry.called_at, QueueEntry.updated_at).where(and_(QueueEntry.office_id == id, QueueEntry.status == "completed"))
    res_svc = await db.execute(stmt_svc)
    svc_records = res_svc.all()

    total_svc_minutes = 0.0
    for called, updated in svc_records:
        total_svc_minutes += (updated - called).total_seconds() / 60.0
    avg_svc = round(total_svc_minutes / len(svc_records), 1) if svc_records else 0.0

    return {
        "office_id": id,
        "total_appointments": total_appts,
        "completed_appointments": completed_appts,
        "no_show_appointments": no_show_appts,
        "no_show_rate_percent": round((no_show_appts / max(total_appts, 1)) * 100, 1),
        "average_wait_time_minutes": avg_wait,
        "average_service_time_minutes": avg_svc
    }

@router.get("/staff/{id}")
async def get_staff_performance_report(
    id: int,
    current_user: User = Depends(check_role(["staff", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Get staff performance metrics (Admins can view any; Staff can only view their own performance).
    """
    # Enforce access control: staff can only request their own ID
    if current_user.role.name == "staff" and current_user.id != id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Staff members can only view their own performance metrics."
        )

    # 1. Fetch counters assigned to this staff member
    stmt_counters = select(Counter.id).where(Counter.assigned_staff_id == id)
    res_counters = await db.execute(stmt_counters)
    counter_ids = list(res_counters.scalars().all())

    if not counter_ids:
        return {
            "staff_user_id": id,
            "tickets_completed": 0,
            "average_service_time_minutes": 0.0
        }

    # 2. Count tickets completed by this staff member's counters
    stmt_completed = select(func.count(QueueEntry.id)).where(
        and_(
            QueueEntry.counter_id.in_(counter_ids),
            QueueEntry.status == "completed"
        )
    )
    res_completed = await db.execute(stmt_completed)
    completed_count = res_completed.scalar() or 0

    # 3. Calculate average service duration by this staff's counters
    stmt_svc = select(QueueEntry.called_at, QueueEntry.updated_at).where(
        and_(
            QueueEntry.counter_id.in_(counter_ids),
            QueueEntry.status == "completed"
        )
    )
    res_svc = await db.execute(stmt_svc)
    svc_records = res_svc.all()

    total_svc_minutes = 0.0
    for called, updated in svc_records:
        total_svc_minutes += (updated - called).total_seconds() / 60.0
    avg_svc = round(total_svc_minutes / len(svc_records), 1) if svc_records else 0.0

    return {
        "staff_user_id": id,
        "tickets_completed": completed_count,
        "average_service_time_minutes": avg_svc
    }
