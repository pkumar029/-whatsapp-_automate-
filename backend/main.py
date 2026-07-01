"""
WhatsApp Automate — FastAPI Main Application Entry Point
"""
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from config.settings import settings
from utils.helpers import setup_logging
from database.connection import check_db_connection, engine
from sqlalchemy import text as _sql

# ─── Setup Logging ────────────────────────────────────────────
setup_logging()
logger = logging.getLogger(__name__)


# ─── Startup / Shutdown ───────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """App startup and shutdown events."""
    logger.info(f"Starting {settings.APP_NAME} [{settings.APP_ENV}]")
    
    # Check database connectivity
    db_ok = check_db_connection()
    if db_ok:
        logger.info("✅ Database connected")
    else:
        logger.warning("⚠️  Database connection failed — check .env DB_ settings")

    # Safe schema migrations
    _migrations = [
        ("wa_account column",
         "ALTER TABLE contacts ADD COLUMN wa_account VARCHAR(100) NULL"),
        ("system_settings table",
         "CREATE TABLE IF NOT EXISTS system_settings ("
         "  id INT AUTO_INCREMENT PRIMARY KEY,"
         "  `key` VARCHAR(100) NOT NULL UNIQUE,"
         "  value TEXT,"
         "  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
         ")"),
        ("cooldown_minutes column",
         "ALTER TABLE automations ADD COLUMN cooldown_minutes INT NOT NULL DEFAULT 0"),
        ("trigger_type enum expand",
         "ALTER TABLE automations MODIFY COLUMN trigger_type "
         "ENUM('keyword','keyword_pattern','schedule','contact_added',"
         "'contact_tag_added','message_received','webhook_received','manual') "
         "NOT NULL DEFAULT 'manual'"),
        ("step_type enum expand",
         "ALTER TABLE automation_steps MODIFY COLUMN step_type "
         "ENUM('send_message','send_image','add_tag','remove_tag','react_message',"
         "'delay','condition','update_contact','webhook','log') NOT NULL"),
        ("messages wa_account column",
         "ALTER TABLE messages ADD COLUMN wa_account VARCHAR(100) NULL"),
        ("messages wa_account index",
         "ALTER TABLE messages ADD INDEX idx_message_wa_account (wa_account)"),
        ("messages whatsapp_message_id resize",
         "ALTER TABLE messages MODIFY COLUMN whatsapp_message_id VARCHAR(200) NULL"),
        ("messages whatsapp_id index",
         "ALTER TABLE messages ADD INDEX idx_message_wa_id (whatsapp_message_id)"),
        ("contacts is_valid column",
         "ALTER TABLE contacts ADD COLUMN is_valid TINYINT(1) NOT NULL DEFAULT 1"),
        ("contacts is_valid index",
         "ALTER TABLE contacts ADD INDEX idx_contact_valid (is_valid)"),
        ("contacts cleanup invalid phones",
         "UPDATE contacts SET is_valid = 0 WHERE "
         "(phone LIKE '%@%' AND phone NOT LIKE '%@g.us') "
         "OR phone NOT LIKE '+%' "
         "OR (phone NOT LIKE '%@g.us' AND CHAR_LENGTH(phone) > 14)"),
        ("contacts hide auto-created unsaved",
         "UPDATE contacts SET is_valid = 0 WHERE "
         "name LIKE 'WhatsApp User %' OR name = phone OR name REGEXP '^[0-9]{7,}$'"),
        ("contacts is_my_contact column",
         "ALTER TABLE contacts ADD COLUMN is_my_contact TINYINT(1) NOT NULL DEFAULT 0"),
        ("contacts is_my_contact backfill",
         "UPDATE contacts SET is_my_contact = 1 WHERE is_valid = 1 AND is_active = 1"),
        ("contacts is_my_contact index",
         "ALTER TABLE contacts ADD INDEX idx_contact_my_contact (is_my_contact)"),
        ("contacts restore valid unsaved",
         # Restore contacts that had is_valid=0 set by the webhook auto-create fix
         # but have a real name and valid phone — keep them visible in Messages.
         "UPDATE contacts SET is_valid = 1, is_my_contact = 0 "
         "WHERE is_valid = 0 "
         "AND phone REGEXP '^\\\\+[0-9]{7,13}$' "
         "AND name NOT LIKE 'WhatsApp User %' "
         "AND name NOT REGEXP '^[0-9]{7,}$' "
         "AND name != phone"),
        ("campaigns wa_account column",
         "ALTER TABLE campaigns ADD COLUMN wa_account VARCHAR(100) NULL"),
        ("campaigns wa_account index",
         "ALTER TABLE campaigns ADD INDEX idx_campaigns_wa_account (wa_account)"),
        ("automations wa_account column",
         "ALTER TABLE automations ADD COLUMN wa_account VARCHAR(100) NULL"),
        ("automations wa_account index",
         "ALTER TABLE automations ADD INDEX idx_automation_wa_account (wa_account)"),
        ("whatsapp_profiles table",
         "CREATE TABLE IF NOT EXISTS whatsapp_profiles ("
         "  id INT AUTO_INCREMENT PRIMARY KEY,"
         "  wa_account VARCHAR(100) NOT NULL UNIQUE,"
         "  display_name VARCHAR(200) NULL,"
         "  profile_pic_url TEXT NULL,"
         "  about TEXT NULL,"
         "  wid VARCHAR(200) NULL,"
         "  last_synced_at DATETIME NULL,"
         "  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,"
         "  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
         ")"),
        ("contacts profile_pic_url column",
         "ALTER TABLE contacts ADD COLUMN profile_pic_url TEXT NULL"),
        # Drop global phone uniqueness — same phone can exist under different wa_accounts
        ("contacts drop global phone unique index",
         "ALTER TABLE contacts DROP INDEX phone"),
        ("contacts composite phone+wa_account unique",
         "ALTER TABLE contacts ADD UNIQUE KEY uq_contact_phone_account (phone, wa_account)"),
    ]
    import asyncio
    def _run_migrations():
        for _name, _sql_str in _migrations:
            try:
                with engine.connect() as _conn:
                    _conn.execute(_sql(_sql_str))
                    _conn.commit()
                logger.info(f"✅ Migration OK: {_name}")
            except Exception as _e:
                _msg = str(_e)
                if "Duplicate column" not in _msg and "already exists" not in _msg.lower():
                    logger.warning(f"Migration note ({_name}): {_msg}")

    await asyncio.get_event_loop().run_in_executor(None, _run_migrations)

    # Seed default admin user if no users exist
    from database.connection import SessionLocal as _SL
    from services.auth_service import ensure_admin_user
    _seed_db = _SL()
    try:
        ensure_admin_user(_seed_db)
    finally:
        _seed_db.close()

    from services.queue_service import run_queue_worker_loop
    worker_task = asyncio.create_task(run_queue_worker_loop())
    
    yield
    
    # Cancel the queue worker background loop
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        logger.info("Queue worker background loop cancelled successfully")
        
    logger.info(f"Shutting down {settings.APP_NAME}")


# ─── FastAPI App ──────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    description="WhatsApp Automation Platform API — n8n-style workflow automation for WhatsApp",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


# ─── JWT Auth Middleware ───────────────────────────────────────
# Starlette applies middlewares in LIFO order — add JWT first so it runs INSIDE CORS.
# That way CORS headers are present even on 401 responses.
from middleware.jwt_auth import JWTAuthMiddleware
app.add_middleware(JWTAuthMiddleware)

# ─── CORS ─────────────────────────────────────────────────────
# Added last → outermost middleware → runs first on every request.
_cors_origins = (
    ["*"] if settings.CORS_ORIGINS == "*"
    else [o.strip() for o in settings.CORS_ORIGINS.split(",")]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False if "*" in _cors_origins else True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health Check ─────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health_check():
    """Health check endpoint — returns service status."""
    import asyncio
    # Run the synchronous DB ping in a thread so it never blocks the event loop
    loop = asyncio.get_event_loop()
    db_ok = await loop.run_in_executor(None, check_db_connection)
    return {
        "status": "healthy" if db_ok else "degraded",
        "service": settings.APP_NAME,
        "version": "1.0.0",
        "environment": settings.APP_ENV,
        "database": "connected" if db_ok else "disconnected",
    }


@app.get("/api/v1/health", tags=["System"])
async def health_check_v1():
    """Health check under API prefix — same as /health."""
    return await health_check()


@app.get("/", tags=["System"])
async def root():
    """Root endpoint — API info."""
    return {
        "name": settings.APP_NAME,
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }


# ─── Register Routes ──────────────────────────────────────────
from routes.auth import router as auth_router
from routes.whatsapp import router as whatsapp_router
from routes.contacts import router as contacts_router
from routes.messages import router as messages_router
from routes.automations import router as automations_router
from routes.logs import router as logs_router
from routes.dashboard import router as dashboard_router
from routes.campaigns import router as campaigns_router
from routes.ai import router as ai_router

API_PREFIX = "/api/v1"

app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(whatsapp_router, prefix=API_PREFIX)
app.include_router(contacts_router, prefix=API_PREFIX)
app.include_router(messages_router, prefix=API_PREFIX)
app.include_router(automations_router, prefix=API_PREFIX)
app.include_router(logs_router, prefix=API_PREFIX)
app.include_router(dashboard_router, prefix=API_PREFIX)
app.include_router(campaigns_router, prefix=API_PREFIX)
app.include_router(ai_router, prefix=API_PREFIX)

logger.info("✅ All API routes registered")


# ─── Run directly ─────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.APP_PORT,
        reload=settings.APP_DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )
