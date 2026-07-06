from sqlalchemy import ForeignKey, DateTime, func, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.db.base_class import Base

class QueueEntry(Base):
    __tablename__ = "queue_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    appointment_id: Mapped[int] = mapped_column(
        ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False
    )
    office_id: Mapped[int] = mapped_column(ForeignKey("offices.id", ondelete="CASCADE"), nullable=False)
    counter_id: Mapped[int | None] = mapped_column(
        ForeignKey("counters.id", ondelete="SET NULL"), nullable=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), default="waiting", nullable=False
    )  # waiting, called, processing, completed, skipped
    estimated_wait_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    called_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    appointment: Mapped["Appointment"] = relationship(back_populates="queue_entries")  # type: ignore
    office: Mapped["Office"] = relationship(back_populates="queue_entries")  # type: ignore
    counter: Mapped["Counter"] = relationship(back_populates="queue_entries")  # type: ignore
