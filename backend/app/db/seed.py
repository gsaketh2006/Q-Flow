import asyncio
from datetime import datetime, date
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select, delete

from app.core.config import settings
from app.core.security import get_password_hash

# Import all models to ensure they are loaded in SQLAlchemy registry
from app.models.role import Role
from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.models.office import Office
from app.models.service import Service
from app.models.counter import Counter
from app.models.holiday import Holiday
from app.models.appointment import Appointment
from app.models.queue_entry import QueueEntry
from app.models.notification import Notification
from app.models.audit_log import AuditLog

async def seed_db() -> None:
    print("Connecting to database for seeding...")
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        
    engine = create_async_engine(db_url, echo=True)
    async_session = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        try:
            # 1. Clear existing data in reverse order of dependencies
            print("Clearing existing data...")
            await session.execute(delete(Holiday))
            await session.execute(delete(Counter))
            await session.execute(delete(Service))
            await session.execute(delete(Office))
            await session.execute(delete(User))
            await session.execute(delete(Role))
            await session.commit()

            # 2. Seed Roles
            print("Seeding roles...")
            role_citizen = Role(id=1, name="citizen")
            role_staff = Role(id=2, name="staff")
            role_admin = Role(id=3, name="admin")
            session.add_all([role_citizen, role_staff, role_admin])
            await session.commit()

            # 3. Seed Users
            print("Seeding users...")
            admin_pwd = get_password_hash("admin123")
            staff_pwd = get_password_hash("staff123")
            citizen_pwd = get_password_hash("citizen123")

            user_admin = User(
                id=1,
                full_name="System Admin",
                email="admin@qflow.com",
                phone="+15550100",
                password_hash=admin_pwd,
                role_id=3,
                language_pref="en",
                is_active=True
            )
            user_staff = User(
                id=2,
                full_name="Counter Operator Jane",
                email="staff@qflow.com",
                phone="+15550200",
                password_hash=staff_pwd,
                role_id=2,
                language_pref="en",
                is_active=True
            )
            user_citizen = User(
                id=3,
                full_name="John Citizen",
                email="citizen@qflow.com",
                phone="+15550300",
                password_hash=citizen_pwd,
                role_id=1,
                language_pref="en",
                is_active=True
            )
            session.add_all([user_admin, user_staff, user_citizen])
            await session.commit()

            # 4. Seed Offices
            print("Seeding offices...")
            office_main = Office(
                id=1,
                name="Main Downtown Office",
                address="123 Plaza St",
                city="Metropolis",
                latitude=40.7128,
                longitude=-74.0060,
                working_hours={"mon-fri": "08:00-17:00", "sat": "09:00-13:00"},
                is_active=True
            )
            office_north = Office(
                id=2,
                name="North Branch Office",
                address="789 Boulevard Rd",
                city="Metropolis",
                latitude=40.7589,
                longitude=-73.9851,
                working_hours={"mon-fri": "09:00-16:00"},
                is_active=True
            )
            session.add_all([office_main, office_north])
            await session.commit()

            # 5. Seed Services
            print("Seeding services...")
            service_passport = Service(
                id=1,
                office_id=1,
                name="Passport Renewal & Issuance",
                avg_duration_minutes=30,
                is_active=True
            )
            service_license = Service(
                id=2,
                office_id=1,
                name="Driver's License Renewal",
                avg_duration_minutes=15,
                is_active=True
            )
            service_vehicle = Service(
                id=3,
                office_id=2,
                name="Vehicle Registration & Title",
                avg_duration_minutes=20,
                is_active=True
            )
            session.add_all([service_passport, service_license, service_vehicle])
            await session.commit()

            # 6. Seed Counters
            print("Seeding counters...")
            counter_1 = Counter(
                id=1,
                office_id=1,
                name="Counter A (Passports)",
                assigned_staff_id=2,  # Jane Staff
                is_active=True
            )
            counter_2 = Counter(
                id=2,
                office_id=1,
                name="Counter B (Licenses)",
                assigned_staff_id=None,
                is_active=True
            )
            counter_3 = Counter(
                id=3,
                office_id=2,
                name="Window 1 (General)",
                assigned_staff_id=None,
                is_active=True
            )
            session.add_all([counter_1, counter_2, counter_3])
            await session.commit()

            # 7. Seed Holidays
            print("Seeding holidays...")
            holiday_global = Holiday(
                id=1,
                office_id=None,  # global
                date=date(2026, 7, 4),
                description="Independence Day"
            )
            holiday_local = Holiday(
                id=2,
                office_id=1,  # office specific
                date=date(2026, 11, 26),
                description="Local Branch Renovation Day"
            )
            session.add_all([holiday_global, holiday_local])
            await session.commit()

            print("Database successfully seeded!")
        except Exception as e:
            print(f"Error during seeding: {e}")
            await session.rollback()
            raise
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(seed_db())
