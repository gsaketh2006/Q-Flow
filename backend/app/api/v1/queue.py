from fastapi import APIRouter, Depends, HTTPException, status, Query, WebSocket, WebSocketDisconnect, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any

from app.db.session import get_db
from app.core.deps import get_current_active_user, check_role
from app.models.user import User
from app.schemas.queue_entry import QueueEntryResponse, QueueEntryWithDetailsResponse
from app.services import queue as queue_service
from app.websocket.connection_manager import manager
from app.services.notification import send_ticket_called_task

router = APIRouter(prefix="/queue", tags=["Queue"])

@router.get("/live")
async def get_live_public_queue(
    office_id: int = Query(..., description="Office ID to fetch public queue board for"),
    db: AsyncSession = Depends(get_db)
):
    """
    Public, anonymized real-time queue board (shows called tickets and upcoming waitlist).
    Does not require authentication.
    """
    return await queue_service.get_live_queue(db, office_id)

@router.get("/active", response_model=List[QueueEntryWithDetailsResponse])
async def list_active_queue_entries(
    office_id: int = Query(..., description="Office ID to fetch active entries for"),
    current_user: User = Depends(check_role(["staff", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    """
    List all active (waiting, called, processing) queue entries (Staff/Admin only).
    """
    entries = await queue_service.get_active_queue_for_office(db, office_id)
    
    # Helper to construct ticket number
    def make_ticket(entry) -> str:
        svc_name = entry.appointment.service.name
        prefix = "".join([w[0] for w in svc_name.split() if w[0].isalnum()]).upper()[:2]
        if not prefix:
            prefix = "TK"
        return f"{prefix}-{entry.position}"

    return [
        {
            "id": entry.id,
            "appointment_id": entry.appointment_id,
            "office_id": entry.office_id,
            "counter_id": entry.counter_id,
            "position": entry.position,
            "status": entry.status,
            "estimated_wait_minutes": entry.estimated_wait_minutes,
            "called_at": entry.called_at,
            "created_at": entry.created_at,
            "updated_at": entry.updated_at,
            "citizen_name": entry.appointment.user.full_name,
            "service_name": entry.appointment.service.name,
            "ticket_number": make_ticket(entry),
            "counter_name": entry.counter.name if entry.counter else None
        }
        for entry in entries
    ]

@router.post("/call-next", response_model=QueueEntryWithDetailsResponse)
async def call_next_waiting_citizen(
    background_tasks: BackgroundTasks,
    counter_id: int = Query(..., description="Counter calling the next citizen"),
    current_user: User = Depends(check_role(["staff", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Call the next citizen in line for this counter's office (Staff/Admin only).
    Sets the status to 'called' and updates wait times.
    """
    entry = await queue_service.call_next_ticket(db, current_user.id, counter_id)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No citizens waiting in queue for this office."
        )
        
    def make_ticket(e) -> str:
        svc_name = e.appointment.service.name
        prefix = "".join([w[0] for w in svc_name.split() if w[0].isalnum()]).upper()[:2]
        return f"{prefix}-{e.position}"

    ticket_num = make_ticket(entry)
    counter_name = entry.counter.name if entry.counter else f"Counter #{entry.counter_id}"
    
    # Asynchronously dispatch email to let citizen know they are called
    background_tasks.add_task(
        send_ticket_called_task,
        entry.appointment_id,
        ticket_num,
        counter_name
    )

    return {
        "id": entry.id,
        "appointment_id": entry.appointment_id,
        "office_id": entry.office_id,
        "counter_id": entry.counter_id,
        "position": entry.position,
        "status": entry.status,
        "estimated_wait_minutes": entry.estimated_wait_minutes,
        "called_at": entry.called_at,
        "created_at": entry.created_at,
        "updated_at": entry.updated_at,
        "citizen_name": entry.appointment.user.full_name,
        "service_name": entry.appointment.service.name,
        "ticket_number": ticket_num,
        "counter_name": counter_name
    }

@router.post("/{id}/start-service", response_model=QueueEntryResponse)
async def start_service_processing(
    id: int,
    current_user: User = Depends(check_role(["staff", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Mark ticket status as 'processing' when service begins (Staff/Admin only).
    """
    entry = await queue_service.start_service(db, id, current_user.id)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot start service. Ticket must be in 'called' status."
        )
    return entry

@router.post("/{id}/complete", response_model=QueueEntryResponse)
async def complete_citizen_service(
    id: int,
    current_user: User = Depends(check_role(["staff", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Mark ticket status as 'completed' once service completes (Staff/Admin only).
    """
    entry = await queue_service.complete_service(db, id, current_user.id)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot complete service. Ticket must be in 'processing' status."
        )
    return entry

@router.post("/{id}/skip", response_model=QueueEntryResponse)
async def skip_no_show_citizen(
    id: int,
    current_user: User = Depends(check_role(["staff", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Mark ticket status as 'skipped' if the citizen failed to report (Staff/Admin only).
    """
    entry = await queue_service.skip_service(db, id, current_user.id)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot skip ticket. Ticket must be in 'called' status."
        )
    return entry

@router.post("/reorder", response_model=List[QueueEntryWithDetailsResponse])
async def reorder_waiting_queue(
    office_id: int = Query(...),
    entry_id: int = Query(...),
    new_position: int = Query(...),
    current_user: User = Depends(check_role(["admin"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Manually shift a ticket's position in queue (Admin only).
    """
    entries = await queue_service.reorder_queue(db, office_id, entry_id, new_position, current_user.id)
    if not entries:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid request. Check office ID, entry ID, and queue status."
        )
        
    def make_ticket(e) -> str:
        svc_name = e.appointment.service.name
        prefix = "".join([w[0] for w in svc_name.split() if w[0].isalnum()]).upper()[:2]
        return f"{prefix}-{e.position}"

    return [
        {
            "id": entry.id,
            "appointment_id": entry.appointment_id,
            "office_id": entry.office_id,
            "counter_id": entry.counter_id,
            "position": entry.position,
            "status": entry.status,
            "estimated_wait_minutes": entry.estimated_wait_minutes,
            "called_at": entry.called_at,
            "created_at": entry.created_at,
            "updated_at": entry.updated_at,
            "citizen_name": entry.appointment.user.full_name,
            "service_name": entry.appointment.service.name,
            "ticket_number": make_ticket(entry),
            "counter_name": entry.counter.name if entry.counter else None
        }
        for entry in entries
    ]

@router.websocket("/ws/{office_id}")
async def websocket_queue_endpoint(websocket: WebSocket, office_id: int):
    """
    WebSocket endpoint for real-time anonymized queue updates.
    """
    await manager.connect(websocket, office_id)
    try:
        while True:
            # Keep socket alive and listen for heartbeat/messages
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, office_id)
