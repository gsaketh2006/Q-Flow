from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "QFlow"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/qflow",
        validation_alias="DATABASE_URL"
    )
    # Sync DB URL for Alembic migrations
    SYNC_DATABASE_URL: str = Field(
        default="postgresql://postgres:postgres@localhost:5432/qflow",
        validation_alias="SYNC_DATABASE_URL"
    )

    # Redis
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        validation_alias="REDIS_URL"
    )

    # JWT Security
    JWT_SECRET_KEY: str = Field(
        default="SUPER_SECRET_KEY_FOR_LOCAL_DEV_NEVER_USE_IN_PROD_1234567890",
        validation_alias="JWT_SECRET_KEY"
    )
    JWT_REFRESH_SECRET_KEY: str = Field(
        default="SUPER_SECRET_REFRESH_KEY_FOR_LOCAL_DEV_NEVER_USE_IN_PROD_0987654321",
        validation_alias="JWT_REFRESH_SECRET_KEY"
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    AUTH_COOKIE_SECURE: bool = Field(default=False, validation_alias="AUTH_COOKIE_SECURE")

    # Frontend URL — set this in Render env vars to your full Vercel deployment URL
    # e.g. FRONTEND_URL=https://q-flow.vercel.app
    FRONTEND_URL: str = Field(default="", validation_alias="FRONTEND_URL")

    # CORS — always includes localhost dev origins; adds FRONTEND_URL if provided
    @property
    def BACKEND_CORS_ORIGINS(self) -> List[str]:
        origins = [
            "http://localhost:5173",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000",
        ]
        if self.FRONTEND_URL:
            origins.append(self.FRONTEND_URL.rstrip("/"))
        return origins

    # SMTP Configuration
    SMTP_HOST: str = Field(default="", validation_alias="SMTP_HOST")
    SMTP_PORT: int = Field(default=587, validation_alias="SMTP_PORT")
    SMTP_USER: str = Field(default="", validation_alias="SMTP_USER")
    SMTP_PASSWORD: str = Field(default="", validation_alias="SMTP_PASSWORD")
    SMTP_FROM_EMAIL: str = Field(default="noreply@qflow.com", validation_alias="SMTP_FROM_EMAIL")

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
