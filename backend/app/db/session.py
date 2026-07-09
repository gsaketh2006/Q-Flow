from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from typing import AsyncGenerator
from app.core.config import settings

import os

# Automatically adapt postgresql:// prefix to postgresql+asyncpg:// for async compatibility
db_url = settings.DATABASE_URL
if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
elif db_url.startswith("sqlite"):
    # If the SQLite URL is a relative path (e.g. sqlite:///qflow.db or sqlite+aiosqlite:///qflow.db),
    # resolve it to be an absolute path relative to the backend root directory.
    if ":///" in db_url and not db_url.startswith("sqlite:////"):
        backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        db_name = db_url.split(":///")[1]
        db_path = os.path.join(backend_dir, db_name)
        db_path_clean = db_path.replace("\\", "/")
        db_url = f"{db_url.split(':///')[0]}:///{db_path_clean}"


# Create async engine for Postgres using asyncpg
engine = create_async_engine(
    db_url,
    echo=False,
    future=True,
    pool_pre_ping=True,
)

# Async session maker for transactions
async_session_maker = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that yields an AsyncSession and closes it on cleanup.
    """
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
