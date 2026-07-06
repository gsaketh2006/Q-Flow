from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.db.session import get_db
from app.core.deps import get_current_active_user, check_role
from app.models.user import User
from app.schemas.service import ServiceCreate, ServiceUpdate, ServiceResponse
from app.services import service as service_operations

router = APIRouter(prefix="/services", tags=["Services"])

@router.get("", response_model=List[ServiceResponse])
async def list_services(
    skip: int = 0,
    limit: int = 100,
    office_id: Optional[int] = Query(None, description="Filter services by office ID"),
    db: AsyncSession = Depends(get_db)
):
    """
    List all active services, optionally filtered by office ID.
    """
    return await service_operations.get_services(db, skip=skip, limit=limit, office_id=office_id)

@router.get("/{id}", response_model=ServiceResponse)
async def read_service(
    id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve details for a specific service.
    """
    service = await service_operations.get_service_by_id(db, id)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return service

@router.post("", response_model=ServiceResponse, status_code=status.HTTP_201_CREATED)
async def add_service(
    service_in: ServiceCreate,
    current_user: User = Depends(check_role(["admin"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new service offered by an office (Admin only).
    """
    return await service_operations.create_service(db, service_in)

@router.put("/{id}", response_model=ServiceResponse)
async def edit_service(
    id: int,
    service_in: ServiceUpdate,
    current_user: User = Depends(check_role(["admin"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Update service details (Admin only).
    """
    service = await service_operations.update_service(db, id, service_in)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return service

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_service(
    id: int,
    current_user: User = Depends(check_role(["admin"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Soft-delete/deactivate a service (Admin only).
    """
    success = await service_operations.delete_service(db, id)
    if not success:
        raise HTTPException(status_code=404, detail="Service not found")
    return
