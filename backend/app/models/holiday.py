from sqlalchemy import String, ForeignKey, DateTime, func, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, date
from app.db.base_class import Base

class Holiday(Base):
    __tablename__ = "holidays"

    id: Mapped[int] = mapped_column(primary_key=True)
    office_id: Mapped[int | None] = mapped_column(
        ForeignKey("offices.id", ondelete="CASCADE"), nullable=True
    )  # if Null, it is a global holiday for all offices
    date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), nullable=False)

    # Relationships
    office: Mapped["Office"] = relationship(back_populates="holidays")  # type: ignore
