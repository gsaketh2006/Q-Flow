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

# Use in-memory SQLite for fast isolated tests
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
        # Seed roles
        citizen_role = Role(id=1, name="citizen")
        staff_role = Role(id=2, name="staff")
        admin_role = Role(id=3, name="admin")
        session.add_all([citizen_role, staff_role, admin_role])

        # Seed test users
        admin_user = User(
            id=1,
            email="admin@test.com",
            password_hash=get_password_hash("password123"),
            full_name="Admin User",
            role_id=3,
            is_active=True,
        )
        staff_user = User(
            id=2,
            email="staff@test.com",
            password_hash=get_password_hash("password123"),
            full_name="Staff User",
            role_id=2,
            is_active=True,
        )
        citizen_user = User(
            id=3,
            email="citizen@test.com",
            password_hash=get_password_hash("password123"),
            full_name="Citizen User",
            role_id=1,
            is_active=True,
        )
        inactive_user = User(
            id=4,
            email="inactive@test.com",
            password_hash=get_password_hash("password123"),
            full_name="Inactive User",
            role_id=1,
            is_active=False,
        )
        session.add_all([admin_user, staff_user, citizen_user, inactive_user])
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


# ─── Helper ────────────────────────────────────────────────────────────────────

def get_citizen_token(client):
    """Helper: log in as citizen and return access token."""
    resp = client.post(
        "/api/v1/auth/login",
        data={"username": "citizen@test.com", "password": "password123"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def get_admin_token(client):
    """Helper: log in as admin and return access token."""
    resp = client.post(
        "/api/v1/auth/login",
        data={"username": "admin@test.com", "password": "password123"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def get_staff_token(client):
    """Helper: log in as staff and return access token."""
    resp = client.post(
        "/api/v1/auth/login",
        data={"username": "staff@test.com", "password": "password123"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


# ─── Health Check ──────────────────────────────────────────────────────────────

def test_health_check(client):
    """GET /health returns healthy status."""
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    assert body["project"] == "QFlow"
    assert body["version"] == "1.0.0"


# ─── Registration ──────────────────────────────────────────────────────────────

def test_register_new_citizen(client):
    """POST /auth/register creates a new citizen account."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "newcitizen@test.com",
            "full_name": "New Citizen",
            "password": "password123",
            "phone": "+1555123456",
            "language_pref": "en",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "newcitizen@test.com"
    assert body["full_name"] == "New Citizen"
    assert "id" in body
    assert "password_hash" not in body  # password must never be returned

def test_register_duplicate_email_fails(client):
    """POST /auth/register with an existing email returns 400."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "citizen@test.com",  # already seeded
            "full_name": "Duplicate User",
            "password": "password123",
        },
    )
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"].lower()

def test_register_short_password_fails(client):
    """POST /auth/register with a password shorter than 6 chars returns 422."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "short@test.com",
            "full_name": "Short Password",
            "password": "abc",  # too short
        },
    )
    assert response.status_code == 422

def test_register_invalid_email_fails(client):
    """POST /auth/register with an invalid email returns 422."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "not-an-email",
            "full_name": "Bad Email",
            "password": "password123",
        },
    )
    assert response.status_code == 422


# ─── Login ─────────────────────────────────────────────────────────────────────

def test_login_citizen_success(client):
    """POST /auth/login with valid credentials returns access_token."""
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "citizen@test.com", "password": "password123"},
    )
    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"

def test_login_admin_success(client):
    """POST /auth/login works for admin users."""
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "admin@test.com", "password": "password123"},
    )
    assert response.status_code == 200
    assert "access_token" in response.json()

def test_login_wrong_password_fails(client):
    """POST /auth/login with wrong password returns 401."""
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "citizen@test.com", "password": "wrongpassword"},
    )
    assert response.status_code == 401

def test_login_nonexistent_user_fails(client):
    """POST /auth/login with unknown email returns 401."""
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "ghost@test.com", "password": "password123"},
    )
    assert response.status_code == 401

def test_login_inactive_user_fails(client):
    """POST /auth/login for an inactive account returns 401."""
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "inactive@test.com", "password": "password123"},
    )
    assert response.status_code == 401


# ─── /users/me ─────────────────────────────────────────────────────────────────

def test_get_me_citizen(client):
    """GET /users/me returns the authenticated citizen's profile."""
    token = get_citizen_token(client)
    response = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "citizen@test.com"
    assert body["role_name"] == "citizen"

def test_get_me_admin(client):
    """GET /users/me returns admin role correctly."""
    token = get_admin_token(client)
    response = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["role_name"] == "admin"

def test_get_me_unauthenticated(client):
    """GET /users/me without token returns 401."""
    response = client.get("/api/v1/users/me")
    assert response.status_code == 401

def test_get_me_invalid_token(client):
    """GET /users/me with garbage token returns 401."""
    response = client.get(
        "/api/v1/users/me",
        headers={"Authorization": "Bearer not_a_real_token"},
    )
    assert response.status_code == 401


# ─── Offices (Role Guards) ─────────────────────────────────────────────────────

def test_list_offices_public(client):
    """GET /offices is public (no auth required)."""
    response = client.get("/api/v1/offices")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_create_office_unauthenticated(client):
    """POST /offices without auth returns 401."""
    response = client.post(
        "/api/v1/offices",
        json={"name": "Test Office", "address": "123 Main St", "city": "City"},
    )
    assert response.status_code == 401

def test_create_office_as_citizen_forbidden(client):
    """POST /offices as citizen returns 403."""
    token = get_citizen_token(client)
    response = client.post(
        "/api/v1/offices",
        json={"name": "Test Office", "address": "123 Main St", "city": "City"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403

def test_create_office_as_admin(client):
    """POST /offices as admin creates a new office."""
    token = get_admin_token(client)
    response = client.post(
        "/api/v1/offices",
        json={"name": "Admin Office", "address": "1 Admin St", "city": "Metro"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Admin Office"
    assert "id" in body


# ─── Reports (Role Guards) ─────────────────────────────────────────────────────

def test_summary_report_unauthenticated(client):
    """GET /reports/summary without auth returns 401."""
    response = client.get("/api/v1/reports/summary")
    assert response.status_code == 401

def test_summary_report_as_citizen_forbidden(client):
    """GET /reports/summary as citizen returns 403."""
    token = get_citizen_token(client)
    response = client.get(
        "/api/v1/reports/summary",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403

def test_summary_report_as_admin(client):
    """GET /reports/summary as admin returns expected analytics shape."""
    token = get_admin_token(client)
    response = client.get(
        "/api/v1/reports/summary",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert "total_appointments" in body
    assert "completed_appointments" in body
    assert "no_show_rate_percent" in body
    assert "average_wait_time_minutes" in body
    assert "average_service_time_minutes" in body


# ─── Queue (Role Guards) ────────────────────────────────────────────────────────

def test_queue_live_public(client):
    """GET /queue/live is public and returns empty board on fresh DB."""
    response = client.get("/api/v1/queue/live?office_id=999")
    assert response.status_code == 200
    body = response.json()
    assert "now_serving" in body
    assert "waiting_list" in body

def test_queue_active_unauthenticated(client):
    """GET /queue/active without auth returns 401."""
    response = client.get("/api/v1/queue/active?office_id=1")
    assert response.status_code == 401

def test_queue_active_as_citizen_forbidden(client):
    """GET /queue/active as citizen returns 403."""
    token = get_citizen_token(client)
    response = client.get(
        "/api/v1/queue/active?office_id=1",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403

def test_queue_call_next_as_citizen_forbidden(client):
    """POST /queue/call-next as citizen returns 403."""
    token = get_citizen_token(client)
    response = client.post(
        "/api/v1/queue/call-next?counter_id=1",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403


# ─── Appointments (Authorization) ─────────────────────────────────────────────

def test_list_appointments_unauthenticated(client):
    """GET /appointments without auth returns 401."""
    response = client.get("/api/v1/appointments")
    assert response.status_code == 401

def test_list_own_appointments_citizen(client):
    """GET /appointments as citizen returns their own (empty) list."""
    token = get_citizen_token(client)
    response = client.get(
        "/api/v1/appointments",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_create_appointment_requires_auth(client):
    """POST /appointments without auth returns 401."""
    response = client.post(
        "/api/v1/appointments",
        json={"office_id": 1, "service_id": 1, "scheduled_time": "2030-01-01T10:00:00"},
    )
    assert response.status_code == 401


# ─── Forgot Password ───────────────────────────────────────────────────────────

def test_forgot_password_existing_email(client):
    """POST /auth/forgot-password always returns 200 (no enumeration)."""
    response = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "citizen@test.com"},
    )
    assert response.status_code == 200
    assert "message" in response.json()

def test_forgot_password_nonexistent_email(client):
    """POST /auth/forgot-password with unknown email also returns 200 (prevents user enumeration)."""
    response = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "ghost@nobody.com"},
    )
    assert response.status_code == 200
    assert "message" in response.json()
