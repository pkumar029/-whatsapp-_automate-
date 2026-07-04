"""
WhatsApp Automate — Application Configuration
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "WhatsApp Automate"
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    APP_PORT: int = 8000

    # Frontend (comma-separated for multiple origins, or * for all)
    FRONTEND_URL: str = "http://localhost:5173"
    CORS_ORIGINS: str = "*"

    # WhatsApp Bridge internal URL
    BRIDGE_URL: str = "http://localhost:7002"

    # Database
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_NAME: str = "whatsapp_automate"
    DB_USER: str = "root"
    DB_PASSWORD: str = ""
    DB_POOL_SIZE: int = 10

    # JWT — set JWT_SECRET in .env for production
    JWT_SECRET: str = "dev_secret_key"
    # There's no password to log back in with anymore (device-bound auth, see
    # /auth/device) — the token IS the account, so it needs to last effectively
    # forever rather than expire like a short login session.
    JWT_EXPIRE_MINUTES: int = 525600  # 365 days default

    # WhatsApp
    WHATSAPP_PHONE_ID: Optional[str] = None
    WHATSAPP_TOKEN: Optional[str] = None
    WHATSAPP_SESSION_DIR: str = "./whatsapp_session"
    WHATSAPP_WEBHOOK_URL: Optional[str] = None

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/app.log"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


settings = Settings()
