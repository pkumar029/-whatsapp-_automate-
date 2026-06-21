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

    # Frontend
    FRONTEND_URL: str = "http://localhost:5173"

    # Database
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_NAME: str = "whatsapp_automate"
    DB_USER: str = "root"
    DB_PASSWORD: str = ""
    DB_POOL_SIZE: int = 10

    # JWT
    JWT_SECRET: str = "dev_secret_key"
    JWT_EXPIRE_MINUTES: int = 60

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
