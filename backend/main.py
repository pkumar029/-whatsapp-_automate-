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
    ]
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

    # Start the queue worker background loop
    import asyncio
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


# ─── CORS ─────────────────────────────────────────────────────
# In production, nginx serves everything on port 80 so "*" is safe for LAN
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
    db_ok = check_db_connection()
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
from routes.whatsapp import router as whatsapp_router
from routes.contacts import router as contacts_router
from routes.messages import router as messages_router
from routes.automations import router as automations_router
from routes.logs import router as logs_router
from routes.dashboard import router as dashboard_router
from routes.campaigns import router as campaigns_router

API_PREFIX = "/api/v1"

app.include_router(whatsapp_router, prefix=API_PREFIX)
app.include_router(contacts_router, prefix=API_PREFIX)
app.include_router(messages_router, prefix=API_PREFIX)
app.include_router(automations_router, prefix=API_PREFIX)
app.include_router(logs_router, prefix=API_PREFIX)
app.include_router(dashboard_router, prefix=API_PREFIX)
app.include_router(campaigns_router, prefix=API_PREFIX)

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
