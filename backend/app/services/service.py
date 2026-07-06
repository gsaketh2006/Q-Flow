from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List
from datetime import datetime, timezone

from app.models.service import Service
from app.schemas.service import ServiceCreate, ServiceUpdate

async def get_service_by_id(db: AsyncSession, service_id: int) -> Optional[Service]:
    stmt = select(Service).where(Service.id == service_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()

async def get_services(db: AsyncSession, skip: int = 0, limit: int = 100, office_id: Optional[int] = None) -> List[Service]:
    stmt = select(Service).where(Service.is_active == True)
    if office_id:
        stmt = stmt.where(Service.office_id == office_id)
    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())

async def create_service(db: AsyncSession, service_in: ServiceCreate) -> Service:
    db_service = Service(
        name=service_in.name,
        office_id=service_in.office_id,
        avg_duration_minutes=service_in.avg_duration_minutes,
        is_active=service_in.is_active
    )
    db.add(db_service)
    await db.commit()
    await db.refresh(db_service)
    return db_service

async def update_service(db: AsyncSession, service_id: int, service_in: ServiceUpdate) -> Optional[Service]:
    service = await get_service_by_id(db, service_id)
    if not service:
        return None
        
    update_data = service_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(service, field, value)
        
    service.updated_at = datetime.now(timezone.utc)
    db.add(service)
    await db.commit()
    await db.refresh(service)
    return service

async def delete_service(db: AsyncSession, service_id: int) -> bool:
    service = await get_service_by_id(db, service_id)
    if not service:
        return False
    # Soft delete
    service.is_active = False
    service.updated_at = datetime.now(timezone.utc)
    db.add(service)
    await db.commit()
    return True
