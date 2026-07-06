from sqlalchemy import String, DateTime, func, Boolean, Float, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.db.base_class import Base

class Office(Base):
    __tablename__ = "offices"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    working_hours: Mapped[dict | list | None] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    counters: Mapped[list["Counter"]] = relationship(back_populates="office", cascade="all, delete-orphan")  # type: ignore
    services: Mapped[list["Service"]] = relationship(back_populates="office", cascade="all, delete-orphan")  # type: ignore
    appointments: Mapped[list["Appointment"]] = relationship(back_populates="office", cascade="all, delete-orphan")  # type: ignore
    queue_entries: Mapped[list["QueueEntry"]] = relationship(back_populates="office", cascade="all, delete-orphan")  # type: ignore
    holidays: Mapped[list["Holiday"]] = relationship(back_populates="office", cascade="all, delete-orphan")  # type: ignore
