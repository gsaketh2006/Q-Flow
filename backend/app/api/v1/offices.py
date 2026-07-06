from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.db.session import get_db
from app.core.deps import get_current_active_user, check_role
from app.models.user import User
from app.schemas.office import OfficeCreate, OfficeUpdate, OfficeResponse
from app.schemas.counter import CounterCreate, CounterUpdate, CounterResponse
from app.schemas.holiday import HolidayCreate, HolidayResponse
from app.services import office as office_service

router = APIRouter(prefix="/offices", tags=["Offices"])

# --- OFFICES ENDPOINTS ---

@router.get("", response_model=List[OfficeResponse])
async def list_offices(
    skip: int = 0,
    limit: int = 100,
    city: Optional[str] = Query(None, description="Filter offices by city name"),
    db: AsyncSession = Depends(get_db)
):
    """
    List all active offices (supports pagination and filtering by city).
    """
    return await office_service.get_offices(db, skip=skip, limit=limit, city=city)

@router.get("/{id}", response_model=OfficeResponse)
async def read_office(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve details for a specific office.
    """
    office = await office_service.get_office_by_id(db, id)
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")
    return office

@router.post("", response_model=OfficeResponse, status_code=status.HTTP_201_CREATED)
async def add_office(
    office_in: OfficeCreate,
    current_user: User = Depends(check_role(["admin"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new office (Admin only).
    """
    return await office_service.create_office(db, office_in)

@router.put("/{id}", response_model=OfficeResponse)
async def edit_office(
    id: int,
    office_in: OfficeUpdate,
    current_user: User = Depends(check_role(["admin"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Update office details (Admin only).
    """
    office = await office_service.update_office(db, id, office_in)
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")
    return office

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_office(
    id: int,
    current_user: User = Depends(check_role(["admin"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Soft-delete/deactivate an office (Admin only).
    """
    success = await office_service.delete_office(db, id)
    if not success:
        raise HTTPException(status_code=404, detail="Office not found")
    return

# --- COUNTERS ENDPOINTS ---

@router.get("/{id}/counters", response_model=List[CounterResponse])
async def list_office_counters(
    id: int,
    current_user: User = Depends(check_role(["staff", "admin"])),
    db: AsyncSession = Depends(get_db)
):
    """
    List all counters for a specific office (Staff and Admin only).
    """
    return await office_service.get_counters_by_office(db, id)

@router.post("/{id}/counters", response_model=CounterResponse, status_code=status.HTTP_201_CREATED)
async def add_counter(
    id: int,
    counter_name: str = Query(..., min_length=1, max_length=100),
    assigned_staff_id: Optional[int] = Query(None),
    current_user: User = Depends(check_role(["admin"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Add a new window/counter to an office (Admin only).
    """
    counter_in = CounterCreate(name=counter_name, office_id=id, assigned_staff_id=assigned_staff_id, is_active=True)
    return await office_service.create_counter(db, counter_in)

@router.put("/{id}/counters/{counter_id}", response_model=CounterResponse)
async def edit_counter(
    id: int,
    counter_id: int,
    counter_in: CounterUpdate,
    current_user: User = Depends(check_role(["admin"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Update counter configuration or reassign staff (Admin only).
    """
    counter = await office_service.update_counter(db, counter_id, counter_in)
    if not counter or counter.office_id != id:
        raise HTTPException(status_code=404, detail="Counter not found for this office")
    return counter

@router.delete("/{id}/counters/{counter_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_counter(
    id: int,
    counter_id: int,
    current_user: User = Depends(check_role(["admin"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Remove a counter from an office (Admin only).
    """
    counter = await office_service.get_counter_by_id(db, counter_id)
    if not counter or counter.office_id != id:
        raise HTTPException(status_code=404, detail="Counter not found for this office")
    await office_service.delete_counter(db, counter_id)
    return

# --- HOLIDAYS ENDPOINTS ---

@router.get("/{id}/holidays", response_model=List[HolidayResponse])
async def list_office_holidays(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    List all holidays (global and office-specific) for an office.
    """
    return await office_service.get_holidays_by_office(db, id)

@router.post("/{id}/holidays", response_model=HolidayResponse, status_code=status.HTTP_201_CREATED)
async def add_holiday(
    id: int,
    holiday_in: HolidayCreate,
    current_user: User = Depends(check_role(["admin"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Add a holiday closing the office on a specific date (Admin only).
    """
    # Override office_id in schema input to match URL parameter
    holiday_in.office_id = id
    return await office_service.create_holiday(db, holiday_in)

@router.delete("/{id}/holidays/{holiday_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_holiday(
    id: int,
    holiday_id: int,
    current_user: User = Depends(check_role(["admin"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a holiday (Admin only).
    """
    success = await office_service.delete_holiday(db, holiday_id)
    if not success:
        raise HTTPException(status_code=404, detail="Holiday not found")
    return
