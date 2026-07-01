"""
Pydantic Schemas for Request/Response validation
"""
from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, EmailStr, field_validator
import re


# ─── Contact Schemas ──────────────────────────────────────────
class ContactCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    wa_account: Optional[str] = None  # set by backend from current session if not provided

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v):
        cleaned = re.sub(r'[\s\-\(\)]', '', v)
        if '@' in cleaned:
            if not re.match(r'^[a-zA-Z0-9\.\-_]+@[a-zA-Z0-9\.\-_]+$', cleaned):
                raise ValueError('Invalid WhatsApp JID format')
            return cleaned
        if not re.match(r'^\+?[0-9]{7,15}$', cleaned):
            raise ValueError('Invalid phone number format')
        return cleaned

    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if len(v.strip()) < 1:
            raise ValueError('Name cannot be empty')
        return v.strip()


class ContactUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    is_active: Optional[bool] = None


class ContactResponse(BaseModel):
    id: int
    name: Optional[str] = None
    phone: str
    email: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    is_active: bool = True
    is_blocked: bool = False
    is_my_contact: bool = False
    wa_account: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ContactListResponse(BaseModel):
    contacts: List[ContactResponse]
    total: int
    page: int
    limit: int


# ─── Message Schemas ──────────────────────────────────────────
class MessageSend(BaseModel):
    contact_id: Optional[int] = None
    phone: Optional[str] = None
    message: str
    media_url: Optional[str] = None
    media_type: Optional[str] = None

    @field_validator('message')
    @classmethod
    def validate_message(cls, v):
        if not v.strip():
            raise ValueError('Message cannot be empty')
        if len(v) > 4096:
            raise ValueError('Message too long (max 4096 characters)')
        return v


class MessageResponse(BaseModel):
    id: int
    contact_id: Optional[int]
    phone: str
    direction: str
    content: str
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    status: str
    contact_name: Optional[str] = None
    error_message: Optional[str]
    sent_at: Optional[datetime]
    delivered_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class MessageListResponse(BaseModel):
    messages: List[MessageResponse]
    total: int
    page: int
    limit: int


# ─── Automation Schemas ───────────────────────────────────────
class StepSchema(BaseModel):
    id: Optional[int] = None
    step_type: str
    step_order: Optional[int] = None
    name: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = True


class AutomationCreate(BaseModel):
    name: str
    description: Optional[str] = None
    trigger_type: str = "manual"
    trigger_config: Optional[Dict[str, Any]] = None
    cooldown_minutes: Optional[int] = 0
    steps: Optional[List[StepSchema]] = None

    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if len(v.strip()) < 2:
            raise ValueError('Name must be at least 2 characters')
        return v.strip()


class AutomationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    trigger_type: Optional[str] = None
    trigger_config: Optional[Dict[str, Any]] = None
    cooldown_minutes: Optional[int] = None
    steps: Optional[List[StepSchema]] = None


class AutomationResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    trigger_type: str
    trigger_config: Optional[Dict[str, Any]]
    is_active: bool
    run_count: int
    last_run: Optional[datetime]
    step_count: Optional[int] = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AutomationListResponse(BaseModel):
    automations: List[AutomationResponse]
    total: int


# ─── Log Schemas ──────────────────────────────────────────────
class LogResponse(BaseModel):
    id: int
    automation_id: int
    automation_name: Optional[str] = None
    status: str
    log_output: Optional[str]
    error_message: Optional[str]
    steps_executed: int
    total_steps: int
    execution_time: Optional[float]
    started_at: datetime
    finished_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class LogListResponse(BaseModel):
    logs: List[LogResponse]
    total: int


# ─── WhatsApp Schemas ─────────────────────────────────────────
class WhatsAppConnectRequest(BaseModel):
    connection_type: str  # "dev", "meta", "bridge"
    phone: Optional[str] = None
    link_method: Optional[str] = "qr"  # "qr" or "otp"
    meta_token: Optional[str] = None
    meta_phone_number_id: Optional[str] = None
    meta_business_account_id: Optional[str] = None


class WhatsAppStatusResponse(BaseModel):
    status: str
    phone: Optional[str]
    connected_at: Optional[datetime]
    disconnected_at: Optional[datetime]
    error_message: Optional[str]
    session_id: Optional[int]
    connection_type: Optional[str] = None
    pairing_code: Optional[str] = None
    qr: Optional[str] = None


class WhatsAppConnectResponse(BaseModel):
    status: str
    message: str
    qr: Optional[str] = None
    session_id: Optional[int] = None



class WhatsAppSendRequest(BaseModel):
    phone: str
    message: str

    @field_validator('message')
    @classmethod
    def validate_message(cls, v):
        if not v.strip():
            raise ValueError('Message cannot be empty')
        return v


# ─── Dashboard Schemas ────────────────────────────────────────
class DashboardSummary(BaseModel):
    total_contacts: int
    sent_messages: int
    received_messages: Optional[int] = 0
    failed_messages: int
    active_automations: int
    active_campaigns: Optional[int] = 0
    queued_jobs: Optional[int] = 0
    recent_activity: Optional[List[Dict[str, Any]]] = []


# ─── Campaign & Message Job Schemas ───────────────────────────
class CampaignCreate(BaseModel):
    name: str
    delay_seconds: Optional[int] = 0
    concurrency: Optional[int] = 1
    contacts: List[int]
    template: str
    scheduled_at: datetime

    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if len(v.strip()) < 2:
            raise ValueError('Name must be at least 2 characters')
        return v.strip()

    @field_validator('delay_seconds')
    @classmethod
    def validate_delay(cls, v):
        if v < 0:
            raise ValueError('Delay seconds must be non-negative')
        return v

    @field_validator('concurrency')
    @classmethod
    def validate_concurrency(cls, v):
        if v < 1:
            raise ValueError('Concurrency must be at least 1')
        return v

    @field_validator('template')
    @classmethod
    def validate_template(cls, v):
        if not v.strip():
            raise ValueError('Template body cannot be empty')
        return v


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    delay_seconds: Optional[int] = None
    concurrency: Optional[int] = None
    template: Optional[str] = None


class MessageJobResponse(BaseModel):
    id: int
    campaign_id: Optional[int]
    contact_id: Optional[int]
    phone: str
    body: str
    scheduled_at: datetime
    status: str
    retry_count: int
    next_retry_time: Optional[datetime]
    lock_time: Optional[datetime]
    sent_time: Optional[datetime]
    provider_id: Optional[str]
    failure_reason: Optional[str]
    created_at: datetime
    updated_at: datetime
    contact_name: Optional[str] = None

    class Config:
        from_attributes = True


class CampaignResponse(BaseModel):
    id: int
    name: str
    status: str
    delay_seconds: int
    concurrency: int
    total_jobs: int
    completed_jobs: int
    failed_jobs: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CampaignListResponse(BaseModel):
    campaigns: List[CampaignResponse]
    total: int


class JobListResponse(BaseModel):
    jobs: List[MessageJobResponse]
    total: int


# ─── Common Response ──────────────────────────────────────────
class SuccessResponse(BaseModel):
    success: bool = True
    message: str
    data: Optional[Any] = None
