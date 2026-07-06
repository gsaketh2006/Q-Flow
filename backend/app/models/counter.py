from sqlalchemy import String, ForeignKey, DateTime, func, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.db.base_class import Base

class Counter(Base):
    __tablename__ = "counters"

    id: Mapped[int] = mapped_column(primary_key=True)
    office_id: Mapped[int] = mapped_column(ForeignKey("offices.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    assigned_staff_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    office: Mapped["Office"] = relationship(back_populates="counters")  # type: ignore
    assigned_staff: Mapped["User"] = relationship(back_populates="assigned_counters")  # type: ignore
    appointments: Mapped[list["Appointment"]] = relationship(back_populates="counter")  # type: ignore
    queue_entries: Mapped[list["QueueEntry"]] = relationship(back_populates="counter")  # type: ignore
