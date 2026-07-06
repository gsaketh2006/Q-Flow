from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Any, Dict
from app.models.audit_log import AuditLog

async def log_action(
    db: AsyncSession,
    user_id: Optional[int],
    action: str,
    entity_type: str,
    entity_id: Optional[int],
    action_metadata: Optional[Dict[str, Any]] = None
) -> AuditLog:
    """
    Log an action performed by a user on an entity.
    """
    db_log = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        action_metadata=action_metadata
    )
    db.add(db_log)
    await db.commit()
    return db_log
