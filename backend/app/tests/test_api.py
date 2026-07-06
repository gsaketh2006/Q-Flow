import pytest
import asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.session import get_db
from app.db.base import Base
from app.core.security import get_password_hash
from app.models.role import Role
from app.models.user import User

DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = async_sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False
)

async def _setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    async with TestingSessionLocal() as session:
        citizen_role = Role(id=1, name="citizen")
        staff_role = Role(id=2, name="staff")
        admin_role = Role(id=3, name="admin")
        session.add_all([citizen_role, staff_role, admin_role])
        
        # Test users
        admin_user = User(
            id=1,
            email="admin@test.com",
            password_hash=get_password_hash("password123"),
            full_name="Admin User",
            role_id=3,
            is_active=True
        )
        citizen_user = User(
            id=2,
            email="citizen@test.com",
            password_hash=get_password_hash("password123"),
            full_name="Citizen User",
            role_id=1,
            is_active=True
        )
        session.add_all([admin_user, citizen_user])
        await session.commit()

async def _teardown_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.fixture(autouse=True)
def db_lifecycle():
    asyncio.run(_setup_db())
    yield
    asyncio.run(_teardown_db())

@pytest.fixture
def client():
    async def override_get_db():
        async with TestingSessionLocal() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as tc:
        yield tc
    app.dependency_overrides.clear()

# --- SYNC TEST CASES ---

def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "project": "QFlow", "version": "1.0.0"}

def test_register(client):
    register_data = {
        "email": "newcitizen@test.com",
        "full_name": "New Citizen",
        "password": "password123",
        "phone": "+1555123456",
        "language_pref": "en"
    }
    response = client.post("/api/v1/auth/register", json=register_data)
    assert response.status_code == 201
    assert response.json()["email"] == "newcitizen@test.com"

def test_login(client):
    login_data = {
        "username": "citizen@test.com",
        "password": "password123"
    }
    response = client.post("/api/v1/auth/login", data=login_data)
    assert response.status_code == 200
    assert "access_token" in response.json()

def test_create_office_unauthorized(client):
    office_data = {
        "name": "Branch Office A",
        "address": "123 Main St",
        "city": "Metropolis",
        "is_active": True
    }
    response = client.post("/api/v1/offices", json=office_data)
    assert response.status_code == 401
