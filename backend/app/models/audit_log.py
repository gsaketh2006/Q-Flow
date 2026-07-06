from sqlalchemy import String, ForeignKey, DateTime, func, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.db.base_class import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)  # login, create_appointment, etc.
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)  # users, appointments, etc.
    entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    
    # Map Python 'action_metadata' to DB column 'metadata' to bypass reserved word conflict
    action_metadata: Mapped[dict | list | None] = mapped_column("metadata", JSON, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), nullable=False)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="audit_logs")  # type: ignore
