from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import date, datetime, timezone

from app.models.office import Office
from app.models.counter import Counter
from app.models.holiday import Holiday
from app.schemas.office import OfficeCreate, OfficeUpdate
from app.schemas.counter import CounterCreate, CounterUpdate
from app.schemas.holiday import HolidayCreate

# --- OFFICES CRUD ---
async def get_office_by_id(db: AsyncSession, office_id: int) -> Optional[Office]:
    stmt = select(Office).where(Office.id == office_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()

async def get_offices(db: AsyncSession, skip: int = 0, limit: int = 100, city: Optional[str] = None) -> List[Office]:
    stmt = select(Office).where(Office.is_active == True)
    if city:
        stmt = stmt.where(Office.city.ilike(f"%{city}%"))
    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())

async def create_office(db: AsyncSession, office_in: OfficeCreate) -> Office:
    db_office = Office(
        name=office_in.name,
        address=office_in.address,
        city=office_in.city,
        latitude=office_in.latitude,
        longitude=office_in.longitude,
        working_hours=office_in.working_hours,
        is_active=office_in.is_active
    )
    db.add(db_office)
    await db.commit()
    await db.refresh(db_office)
    return db_office

async def update_office(db: AsyncSession, office_id: int, office_in: OfficeUpdate) -> Optional[Office]:
    office = await get_office_by_id(db, office_id)
    if not office:
        return None
        
    update_data = office_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(office, field, value)
        
    office.updated_at = datetime.now(timezone.utc)
    db.add(office)
    await db.commit()
    await db.refresh(office)
    return office

async def delete_office(db: AsyncSession, office_id: int) -> bool:
    office = await get_office_by_id(db, office_id)
    if not office:
        return False
    # Soft delete
    office.is_active = False
    office.updated_at = datetime.now(timezone.utc)
    db.add(office)
    await db.commit()
    return True


# --- COUNTERS CRUD ---
async def get_counter_by_id(db: AsyncSession, counter_id: int) -> Optional[Counter]:
    stmt = select(Counter).where(Counter.id == counter_id).options(selectinload(Counter.assigned_staff))
    result = await db.execute(stmt)
    return result.scalar_one_or_none()

async def get_counters_by_office(db: AsyncSession, office_id: int) -> List[Counter]:
    stmt = select(Counter).where(Counter.office_id == office_id).options(selectinload(Counter.assigned_staff))
    result = await db.execute(stmt)
    return list(result.scalars().all())

async def create_counter(db: AsyncSession, counter_in: CounterCreate) -> Counter:
    db_counter = Counter(
        name=counter_in.name,
        office_id=counter_in.office_id,
        assigned_staff_id=counter_in.assigned_staff_id,
        is_active=counter_in.is_active
    )
    db.add(db_counter)
    await db.commit()
    await db.refresh(db_counter)
    return await get_counter_by_id(db, db_counter.id)  # type: ignore

async def update_counter(db: AsyncSession, counter_id: int, counter_in: CounterUpdate) -> Optional[Counter]:
    counter = await get_counter_by_id(db, counter_id)
    if not counter:
        return None
        
    update_data = counter_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(counter, field, value)
        
    counter.updated_at = datetime.now(timezone.utc)
    db.add(counter)
    await db.commit()
    await db.refresh(counter)
    return counter

async def delete_counter(db: AsyncSession, counter_id: int) -> bool:
    stmt = select(Counter).where(Counter.id == counter_id)
    result = await db.execute(stmt)
    counter = result.scalar_one_or_none()
    if not counter:
        return False
    await db.delete(counter)
    await db.commit()
    return True


# --- HOLIDAYS CRUD ---
async def get_holidays_by_office(db: AsyncSession, office_id: int) -> List[Holiday]:
    """
    Fetch all holidays relevant to an office: global holidays (office_id is null)
    and office-specific holidays.
    """
    stmt = select(Holiday).where(
        or_(
            Holiday.office_id == office_id,
            Holiday.office_id == None
        )
    ).order_by(Holiday.date.asc())
    result = await db.execute(stmt)
    return list(result.scalars().all())

async def create_holiday(db: AsyncSession, holiday_in: HolidayCreate) -> Holiday:
    db_holiday = Holiday(
        date=holiday_in.date,
        description=holiday_in.description,
        office_id=holiday_in.office_id
    )
    db.add(db_holiday)
    await db.commit()
    await db.refresh(db_holiday)
    return db_holiday

async def delete_holiday(db: AsyncSession, holiday_id: int) -> bool:
    stmt = select(Holiday).where(Holiday.id == holiday_id)
    result = await db.execute(stmt)
    holiday = result.scalar_one_or_none()
    if not holiday:
        return False
    await db.delete(holiday)
    await db.commit()
    return True
