from sqlalchemy import String, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.db.base_class import Base

class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    office_id: Mapped[int] = mapped_column(ForeignKey("offices.id", ondelete="CASCADE"), nullable=False)
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id", ondelete="CASCADE"), nullable=False)
    counter_id: Mapped[int | None] = mapped_column(
        ForeignKey("counters.id", ondelete="SET NULL"), nullable=True
    )
    scheduled_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), default="pending", nullable=False
    )  # pending, confirmed, checked_in, in_progress, completed, cancelled, no_show
    qr_code_token: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="appointments")  # type: ignore
    office: Mapped["Office"] = relationship(back_populates="appointments")  # type: ignore
    service: Mapped["Service"] = relationship(back_populates="appointments")  # type: ignore
    counter: Mapped["Counter"] = relationship(back_populates="appointments")  # type: ignore
    queue_entries: Mapped[list["QueueEntry"]] = relationship(back_populates="appointment", cascade="all, delete-orphan")  # type: ignore
    notifications: Mapped[list["Notification"]] = relationship(back_populates="appointment", cascade="all, delete-orphan")  # type: ignore
