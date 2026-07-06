from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

from app.models.queue_entry import QueueEntry
from app.models.appointment import Appointment
from app.models.counter import Counter
from app.models.service import Service
from app.models.user import User
from app.services.audit import log_action
from app.websocket.connection_manager import manager

async def get_queue_entry_by_id(db: AsyncSession, entry_id: int) -> Optional[QueueEntry]:
    stmt = (
        select(QueueEntry)
        .where(QueueEntry.id == entry_id)
        .options(
            selectinload(QueueEntry.appointment).selectinload(Appointment.user),
            selectinload(QueueEntry.appointment).selectinload(Appointment.service),
            selectinload(QueueEntry.office),
            selectinload(QueueEntry.counter)
        )
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()

async def get_live_queue(db: AsyncSession, office_id: int) -> Dict[str, Any]:
    """
    Fetch public, anonymized real-time queue listings:
    - 'now_serving': called/processing tickets.
    - 'waiting_list': upcoming tickets.
    """
    # 1. Fetch called or processing entries
    stmt_serving = (
        select(QueueEntry)
        .where(
            and_(
                QueueEntry.office_id == office_id,
                QueueEntry.status.in_(["called", "processing"])
            )
        )
        .options(
            selectinload(QueueEntry.appointment).selectinload(Appointment.service),
            selectinload(QueueEntry.counter)
        )
        .order_by(QueueEntry.called_at.desc())
    )
    res_serving = await db.execute(stmt_serving)
    serving_entries = res_serving.scalars().all()

    # 2. Fetch next 10 waiting entries
    stmt_waiting = (
        select(QueueEntry)
        .where(
            and_(
                QueueEntry.office_id == office_id,
                QueueEntry.status == "waiting"
            )
        )
        .options(
            selectinload(QueueEntry.appointment).selectinload(Appointment.service)
        )
        .order_by(QueueEntry.position.asc())
        .limit(10)
    )
    res_waiting = await db.execute(stmt_waiting)
    waiting_entries = res_waiting.scalars().all()

    # Helper function to construct ticket numbers (e.g. PR-104)
    def make_ticket(entry: QueueEntry) -> str:
        svc_name = entry.appointment.service.name
        # Use first two letters of service as prefix
        prefix = "".join([w[0] for w in svc_name.split() if w[0].isalnum()]).upper()[:2]
        if not prefix:
            prefix = "TK"
        return f"{prefix}-{entry.position}"

    return {
        "now_serving": [
            {
                "id": entry.id,
                "ticket_number": make_ticket(entry),
                "service_name": entry.appointment.service.name,
                "counter_name": entry.counter.name if entry.counter else "N/A",
                "status": entry.status,
                "called_at": entry.called_at
            }
            for entry in serving_entries
        ],
        "waiting_list": [
            {
                "id": entry.id,
                "ticket_number": make_ticket(entry),
                "service_name": entry.appointment.service.name,
                "estimated_wait_minutes": entry.estimated_wait_minutes,
                "position": entry.position
            }
            for entry in waiting_entries
        ]
    }

async def get_active_queue_for_office(db: AsyncSession, office_id: int) -> List[QueueEntry]:
    """
    Get full list of active (waiting, called, processing) queue entries for staff dashboards.
    """
    stmt = (
        select(QueueEntry)
        .where(
            and_(
                QueueEntry.office_id == office_id,
                QueueEntry.status.in_(["waiting", "called", "processing"])
            )
        )
        .options(
            selectinload(QueueEntry.appointment).selectinload(Appointment.user),
            selectinload(QueueEntry.appointment).selectinload(Appointment.service),
            selectinload(QueueEntry.counter)
        )
        .order_by(QueueEntry.position.asc())
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())

async def call_next_ticket(db: AsyncSession, staff_user_id: int, counter_id: int) -> Optional[QueueEntry]:
    """
    Call the next ticket in line for the counter's office.
    """
    # 1. Fetch counter details
    stmt_counter = select(Counter).where(Counter.id == counter_id, Counter.is_active == True)
    counter_res = await db.execute(stmt_counter)
    counter = counter_res.scalar_one_or_none()
    if not counter:
        return None

    # 2. Fetch oldest waiting ticket in the office
    stmt_next = (
        select(QueueEntry)
        .where(
            and_(
                QueueEntry.office_id == counter.office_id,
                QueueEntry.status == "waiting"
            )
        )
        .order_by(QueueEntry.position.asc())
        .limit(1)
    )
    next_res = await db.execute(stmt_next)
    entry = next_res.scalar_one_or_none()
    if not entry:
        return None

    # 3. Update entry and appointment status
    entry.status = "called"
    entry.called_at = datetime.now(timezone.utc)
    entry.counter_id = counter.id
    db.add(entry)
    
    # Also update appointment's active counter assignment
    appt = await db.get(Appointment, entry.appointment_id)
    if appt:
        appt.counter_id = counter.id
        db.add(appt)

    await db.commit()
    
    # Write audit log
    await log_action(
        db,
        user_id=staff_user_id,
        action="call_ticket",
        entity_type="queue_entries",
        entity_id=entry.id,
        action_metadata={"counter_id": counter.id, "appointment_id": entry.appointment_id}
    )

    # Recalculate wait times for all remaining waiting tickets in this office
    await recalculate_wait_times(db, counter.office_id)
    await broadcast_queue_update(db, counter.office_id)

    return await get_queue_entry_by_id(db, entry.id)

async def start_service(db: AsyncSession, entry_id: int, staff_user_id: int) -> Optional[QueueEntry]:
    entry = await get_queue_entry_by_id(db, entry_id)
    if not entry or entry.status != "called":
        return None

    entry.status = "processing"
    entry.updated_at = datetime.now(timezone.utc)
    db.add(entry)

    # Update appointment status
    appt = entry.appointment
    appt.status = "in_progress"
    appt.updated_at = datetime.now(timezone.utc)
    db.add(appt)

    await db.commit()

    await log_action(
        db,
        user_id=staff_user_id,
        action="start_service",
        entity_type="queue_entries",
        entity_id=entry.id,
        action_metadata={"appointment_id": entry.appointment_id}
    )
    await broadcast_queue_update(db, entry.office_id)

    return entry

async def complete_service(db: AsyncSession, entry_id: int, staff_user_id: int) -> Optional[QueueEntry]:
    entry = await get_queue_entry_by_id(db, entry_id)
    if not entry or entry.status != "processing":
        return None

    entry.status = "completed"
    entry.updated_at = datetime.now(timezone.utc)
    db.add(entry)

    # Update appointment status
    appt = entry.appointment
    appt.status = "completed"
    appt.updated_at = datetime.now(timezone.utc)
    db.add(appt)

    await db.commit()

    await log_action(
        db,
        user_id=staff_user_id,
        action="complete_service",
        entity_type="queue_entries",
        entity_id=entry.id,
        action_metadata={"appointment_id": entry.appointment_id}
    )
    await broadcast_queue_update(db, entry.office_id)

    return entry

async def skip_service(db: AsyncSession, entry_id: int, staff_user_id: int) -> Optional[QueueEntry]:
    """
    Mark ticket as skipped (Citizen was a no-show).
    """
    entry = await get_queue_entry_by_id(db, entry_id)
    if not entry or entry.status != "called":
        return None

    entry.status = "skipped"
    entry.updated_at = datetime.now(timezone.utc)
    db.add(entry)

    # Update appointment status
    appt = entry.appointment
    appt.status = "no_show"
    appt.updated_at = datetime.now(timezone.utc)
    db.add(appt)

    await db.commit()

    await log_action(
        db,
        user_id=staff_user_id,
        action="skip_ticket_no_show",
        entity_type="queue_entries",
        entity_id=entry.id,
        action_metadata={"appointment_id": entry.appointment_id}
    )
    await broadcast_queue_update(db, entry.office_id)

    return entry

async def reorder_queue(db: AsyncSession, office_id: int, entry_id: int, new_position: int, admin_user_id: int) -> List[QueueEntry]:
    """
    Manually shift a ticket's position. Updates positions of adjacent tickets.
    """
    entry = await db.get(QueueEntry, entry_id)
    if not entry or entry.office_id != office_id or entry.status != "waiting":
        return []

    old_position = entry.position
    if old_position == new_position:
        return await get_active_queue_for_office(db, office_id)

    # Get all waiting tickets in this office
    stmt = select(QueueEntry).where(
        and_(
            QueueEntry.office_id == office_id,
            QueueEntry.status == "waiting"
        )
    ).order_by(QueueEntry.position.asc())
    res = await db.execute(stmt)
    waiting_entries = res.scalars().all()

    # Re-calculate positions in memory
    for item in waiting_entries:
        if item.id == entry_id:
            item.position = new_position
        elif old_position < new_position:
            if old_position < item.position <= new_position:
                item.position -= 1
        elif new_position <= item.position < old_position:
            item.position += 1

    await db.commit()

    await log_action(
        db,
        user_id=admin_user_id,
        action="reorder_queue",
        entity_type="queue_entries",
        entity_id=entry_id,
        action_metadata={"old_position": old_position, "new_position": new_position}
    )

    await recalculate_wait_times(db, office_id)
    await broadcast_queue_update(db, office_id)

    return await get_active_queue_for_office(db, office_id)

async def recalculate_wait_times(db: AsyncSession, office_id: int) -> None:
    """
    Utility function to recalculate estimated wait times for all waiting tickets in an office.
    """
    # Fetch active counters
    stmt_cnt = select(func.count(Counter.id)).where(Counter.office_id == office_id, Counter.is_active == True)
    cnt_res = await db.execute(stmt_cnt)
    active_counters = cnt_res.scalar() or 1

    # Fetch all waiting tickets ordered by position
    stmt_wait = (
        select(QueueEntry)
        .where(QueueEntry.office_id == office_id, QueueEntry.status == "waiting")
        .options(selectinload(QueueEntry.appointment).selectinload(Appointment.service))
        .order_by(QueueEntry.position.asc())
    )
    wait_res = await db.execute(stmt_wait)
    waiting_tickets = wait_res.scalars().all()

    # Simple logic: wait time is index * average duration of the ticket's service / active counters
    for idx, item in enumerate(waiting_tickets):
        svc_duration = item.appointment.service.avg_duration_minutes
        item.estimated_wait_minutes = int((idx * svc_duration) / active_counters)
        db.add(item)
        
    await db.commit()

async def broadcast_queue_update(db: AsyncSession, office_id: int) -> None:
    """
    Fetch the latest public anonymized queue board and broadcast to all connected WebSocket clients.
    """
    live_data = await get_live_queue(db, office_id)
    await manager.broadcast_to_office(office_id, {
        "type": "queue_update",
        "data": live_data
    })
