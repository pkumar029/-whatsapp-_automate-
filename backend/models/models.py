"""
SQLAlchemy ORM Models for WhatsApp Automate
"""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime,
    Float, ForeignKey, Enum, JSON, Index
)
from sqlalchemy.orm import relationship
from database.connection import Base
import enum


# ─── Enums ────────────────────────────────────────────────────
class SessionStatus(str, enum.Enum):
    connected = "connected"
    disconnected = "disconnected"
    connecting = "connecting"
    expired = "expired"


class MessageDirection(str, enum.Enum):
    inbound = "inbound"
    outbound = "outbound"


class MessageStatus(str, enum.Enum):
    pending = "pending"
    sent = "sent"
    delivered = "delivered"
    read = "read"
    failed = "failed"


class AutomationStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    draft = "draft"


class TriggerType(str, enum.Enum):
    keyword = "keyword"
    schedule = "schedule"
    contact_added = "contact_added"
    message_received = "message_received"
    manual = "manual"


class StepType(str, enum.Enum):
    send_message = "send_message"
    delay = "delay"
    condition = "condition"
    update_contact = "update_contact"
    webhook = "webhook"
    log = "log"


class LogStatus(str, enum.Enum):
    running = "running"
    success = "success"
    failed = "failed"
    partial = "partial"


# ─── User ─────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sessions = relationship("WhatsappSession", back_populates="user")


# ─── WhatsApp Session ─────────────────────────────────────────
class WhatsappSession(Base):
    __tablename__ = "whatsapp_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    phone = Column(String(20), nullable=True)
    status = Column(Enum(SessionStatus), default=SessionStatus.disconnected, nullable=False)
    session_data = Column(JSON, nullable=True)
    qr_code = Column(Text, nullable=True)
    connected_at = Column(DateTime, nullable=True)
    disconnected_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="sessions")

    __table_args__ = (
        Index("idx_session_status", "status"),
        Index("idx_session_phone", "phone"),
    )


# ─── Contact ──────────────────────────────────────────────────
class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), unique=True, nullable=False)
    email = Column(String(150), nullable=True)
    notes = Column(Text, nullable=True)
    tags = Column(JSON, nullable=True)
    is_active = Column(Boolean, default=True)
    is_blocked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    messages = relationship("Message", back_populates="contact")

    __table_args__ = (
        Index("idx_contact_phone", "phone"),
        Index("idx_contact_name", "name"),
        Index("idx_contact_active", "is_active"),
    )


# ─── Message ──────────────────────────────────────────────────
class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    contact_id = Column(Integer, ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)
    phone = Column(String(20), nullable=False)
    direction = Column(Enum(MessageDirection), nullable=False)
    content = Column(Text, nullable=False)
    media_url = Column(String(500), nullable=True)
    media_type = Column(String(50), nullable=True)
    status = Column(Enum(MessageStatus), default=MessageStatus.pending)
    whatsapp_message_id = Column(String(100), nullable=True)
    automation_id = Column(Integer, ForeignKey("automations.id", ondelete="SET NULL"), nullable=True)
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    contact = relationship("Contact", back_populates="messages")

    __table_args__ = (
        Index("idx_message_phone", "phone"),
        Index("idx_message_direction", "direction"),
        Index("idx_message_status", "status"),
        Index("idx_message_contact", "contact_id"),
        Index("idx_message_created", "created_at"),
    )


# ─── Automation ───────────────────────────────────────────────
class Automation(Base):
    __tablename__ = "automations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    trigger_type = Column(Enum(TriggerType), default=TriggerType.manual, nullable=False)
    trigger_config = Column(JSON, nullable=True)
    is_active = Column(Boolean, default=False)
    run_count = Column(Integer, default=0)
    last_run = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    steps = relationship("AutomationStep", back_populates="automation", order_by="AutomationStep.step_order", cascade="all, delete-orphan")
    logs = relationship("AutomationLog", back_populates="automation", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_automation_active", "is_active"),
        Index("idx_automation_trigger", "trigger_type"),
    )


# ─── Automation Step ──────────────────────────────────────────
class AutomationStep(Base):
    __tablename__ = "automation_steps"

    id = Column(Integer, primary_key=True, autoincrement=True)
    automation_id = Column(Integer, ForeignKey("automations.id", ondelete="CASCADE"), nullable=False)
    step_type = Column(Enum(StepType), nullable=False)
    step_order = Column(Integer, nullable=False)
    name = Column(String(100), nullable=True)
    config = Column(JSON, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    automation = relationship("Automation", back_populates="steps")

    __table_args__ = (
        Index("idx_step_automation", "automation_id"),
        Index("idx_step_order", "automation_id", "step_order"),
    )


# ─── Automation Log ───────────────────────────────────────────
class AutomationLog(Base):
    __tablename__ = "automation_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    automation_id = Column(Integer, ForeignKey("automations.id", ondelete="CASCADE"), nullable=False)
    status = Column(Enum(LogStatus), default=LogStatus.running)
    trigger_data = Column(JSON, nullable=True)
    log_output = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    steps_executed = Column(Integer, default=0)
    total_steps = Column(Integer, default=0)
    execution_time = Column(Float, nullable=True)  # milliseconds
    started_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    automation = relationship("Automation", back_populates="logs")

    __table_args__ = (
        Index("idx_log_automation", "automation_id"),
        Index("idx_log_status", "status"),
        Index("idx_log_started", "started_at"),
    )
