"""
Contacts Service — CRUD, search, filtering, sync with progress tracking
"""
import re
import json
import logging
import threading
from typing import Optional, Callable
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from models.models import Contact
from models.schemas import ContactCreate, ContactUpdate

logger = logging.getLogger(__name__)

# ─── Phone / contact validation ───────────────────────────────

def is_valid_contact_phone(phone: str) -> bool:
    if not phone:
        return False
    if phone.endswith('@g.us'):
        return True
    if '@' in phone:
        return False
    return bool(re.match(r'^\+\d{7,15}$', phone))


# ─── Sync progress (thread-safe, per user) ────────────────────
# Keyed by user_id so two users syncing at once don't see each other's
# progress. The SSE endpoint is public (EventSource can't send auth headers)
# so the caller must pass user_id explicitly — see routes/contacts.py.

_sync_lock = threading.Lock()
_sync_states: dict[int, dict] = {}
_DEFAULT_SYNC_STATE = {"status": "idle", "current": 0, "total": 0, "message": "", "error": ""}


def _update_sync(user_id: int, current: int = 0, total: int = 0, message: str = "", status: str = "running", error: str = ""):
    with _sync_lock:
        _sync_states.setdefault(user_id, dict(_DEFAULT_SYNC_STATE)).update(
            {"status": status, "current": current, "total": total, "message": message, "error": error}
        )


def get_sync_progress(user_id: int) -> dict:
    with _sync_lock:
        return dict(_sync_states.get(user_id, _DEFAULT_SYNC_STATE))


# ─── Queries ─────────────────────────────────────────────────

def claim_orphan_contacts(db: Session, wa_account: str, user_id: int) -> int:
    """Stamp this user's own not-yet-tagged contacts with their wa_account.
    Scoped to `user_id` so one user connecting can never claim another
    user's contacts — only rows that already belong to them."""
    updated = db.query(Contact).filter(
        Contact.wa_account.is_(None),
        Contact.user_id == user_id,
        Contact.is_valid == True,
    ).update({"wa_account": wa_account}, synchronize_session=False)
    if updated:
        db.commit()
        logger.info(f"Claimed {updated} orphan contacts for account {wa_account} (user {user_id})")
    return updated


def get_contacts(
    db: Session,
    user_id: int,
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    wa_account: Optional[str] = None,
    saved_only: bool = False,
) -> dict:
    if not wa_account:
        return {"contacts": [], "total": 0, "page": page, "limit": limit}

    query = db.query(Contact).filter(
        Contact.user_id == user_id,
        Contact.wa_account == wa_account,
        Contact.is_valid == True,
        Contact.phone != None,
    )
    if saved_only:
        query = query.filter(Contact.is_my_contact == True)

    if search:
        term = f"%{search}%"
        query = query.filter(
            or_(
                Contact.name.ilike(term),
                Contact.phone.ilike(term),
                Contact.email.ilike(term),
            )
        )

    if is_active is not None:
        query = query.filter(Contact.is_active == is_active)

    total = query.count()
    contacts = query.order_by(Contact.name).offset((page - 1) * limit).limit(limit).all()

    return {"contacts": contacts, "total": total, "page": page, "limit": limit}


def get_contact_by_id(db: Session, contact_id: int, user_id: int) -> Optional[Contact]:
    return db.query(Contact).filter(Contact.id == contact_id, Contact.user_id == user_id).first()


def get_contact_by_phone(db: Session, phone: str, user_id: int, wa_account: Optional[str] = None) -> Optional[Contact]:
    """Look up a contact by phone (scoped to this user), preferring a wa_account-scoped match."""
    q = db.query(Contact).filter(Contact.phone == phone, Contact.user_id == user_id)
    if wa_account:
        scoped = q.filter(Contact.wa_account == wa_account).first()
        if scoped:
            return scoped
    return q.first()


def fire_contact_event(db: Session, user_id: int, wa_account: Optional[str], trigger_type_value: str, trigger_data: dict) -> None:
    """Fire contact_added / contact_tag_added automations for this user in the
    background. Mirrors the pattern used for inbound-message triggers
    (routes/whatsapp.py webhook) and scheduled triggers (queue_service.py) —
    those fire correctly; this event type previously had no caller at all,
    so contact_added/contact_tag_added automations never ran."""
    import threading
    from models.models import Automation, TriggerType

    try:
        trigger_enum = TriggerType(trigger_type_value)
    except ValueError:
        return

    try:
        automations = db.query(Automation).filter(
            Automation.is_active == True,
            Automation.user_id == user_id,
            Automation.trigger_type == trigger_enum,
        ).filter(
            (Automation.wa_account == wa_account) | Automation.wa_account.is_(None)
        ).all()
    except Exception as e:
        logger.error(f"fire_contact_event: lookup failed for {trigger_type_value}: {e}")
        return

    for automation in automations:
        if trigger_enum == TriggerType.contact_tag_added:
            wanted_tag = (automation.trigger_config or {}).get("tag")
            if wanted_tag and wanted_tag != trigger_data.get("tag"):
                continue

        def run_bg(auto_id=automation.id, auto_name=automation.name, trig=dict(trigger_data)):
            from database.connection import SessionLocal
            from services.automation_runner import run_automation
            bg_db = SessionLocal()
            try:
                logger.info(f"Triggering automation '{auto_name}' (ID: {auto_id}) via {trigger_type_value}")
                run_automation(bg_db, auto_id, trig)
            except Exception as e:
                logger.error(f"Background automation run failed (auto {auto_id}): {e}")
            finally:
                bg_db.close()

        t = threading.Thread(target=run_bg)
        t.daemon = True
        t.start()


def create_contact(
    db: Session,
    data: ContactCreate,
    user_id: int,
    wa_account: Optional[str] = None,
    is_my_contact: bool = True,
) -> Contact:
    resolved_wa = data.wa_account or wa_account
    if not resolved_wa:
        from models.models import WhatsappSession, SessionStatus
        session = db.query(WhatsappSession).filter(
            WhatsappSession.user_id == user_id, WhatsappSession.status == SessionStatus.connected
        ).first()
        resolved_wa = session.phone if session else None

    existing = get_contact_by_phone(db, data.phone, user_id, resolved_wa)
    if existing:
        existing.is_valid = True
        existing.is_active = True
        if is_my_contact:
            existing.is_my_contact = True
        if resolved_wa:
            existing.wa_account = resolved_wa
        if data.name:
            existing.name = data.name
        if data.email:
            existing.email = data.email
        if data.notes:
            existing.notes = data.notes
        if data.tags:
            existing.tags = data.tags
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing

    contact = Contact(
        user_id=user_id,
        name=data.name,
        phone=data.phone,
        email=data.email,
        notes=data.notes,
        tags=data.tags,
        wa_account=resolved_wa,
        is_my_contact=is_my_contact,
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    fire_contact_event(db, user_id, resolved_wa, "contact_added", {
        "contact_id": contact.id, "phone": contact.phone, "name": contact.name,
    })
    return contact


def update_contact(db: Session, contact_id: int, data: ContactUpdate, user_id: int) -> Optional[Contact]:
    contact = get_contact_by_id(db, contact_id, user_id)
    if not contact:
        return None
    old_tags = list(contact.tags or [])
    updates = data.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(contact, key, value)
    db.commit()
    db.refresh(contact)
    if "tags" in updates:
        added_tags = [t for t in (contact.tags or []) if t not in old_tags]
        for tag in added_tags:
            fire_contact_event(db, user_id, contact.wa_account, "contact_tag_added", {
                "contact_id": contact.id, "phone": contact.phone, "tag": tag,
            })
    return contact


def delete_contact(db: Session, contact_id: int, user_id: int) -> bool:
    contact = get_contact_by_id(db, contact_id, user_id)
    if not contact:
        return False
    db.delete(contact)
    db.commit()
    return True


def get_total_contacts(db: Session, user_id: int, wa_account: Optional[str] = None) -> int:
    query = db.query(func.count(Contact.id)).filter(Contact.user_id == user_id, Contact.is_valid == True)
    if wa_account:
        query = query.filter(Contact.wa_account == wa_account)
    return query.scalar() or 0


# ─── Sync ─────────────────────────────────────────────────────

def sync_whatsapp_contacts(db: Session, user_id: int, progress_callback: Optional[Callable] = None) -> dict:
    """Sync ALL WhatsApp contacts (address-book + chat-only) from the bridge.

    Attempts the /contacts/sync-stream SSE endpoint for live progress;
    falls back to the plain /contacts endpoint.
    """
    from services import whatsapp_service
    from models.models import WhatsappSession, SessionStatus

    _update_sync(user_id, status="running", message="Starting sync...")

    session = whatsapp_service.get_or_create_session(db, user_id)
    if session.status != SessionStatus.connected:
        _update_sync(user_id, status="error", error="WhatsApp is not connected")
        raise ValueError("WhatsApp session is not connected. Connect first.")

    connection_type = session.session_data.get("connection_type") if session.session_data else "dev"

    if connection_type == "dev":
        dummy = [
            {"name": "Alice Smith",  "phone": "+919876543210", "type": "User",  "is_my_contact": True},
            {"name": "Bob Johnson",  "phone": "+919876543211", "type": "User",  "is_my_contact": True},
            {"name": "Dev Group",    "phone": "123456789@g.us","type": "Group", "is_my_contact": False},
        ]
        _upsert_contacts(db, dummy, session.phone or "", user_id, progress_callback)
        _update_sync(user_id, status="complete", current=len(dummy), total=len(dummy), message="Dev sync complete")
        return {"success": True, "message": f"Dev mode: synced {len(dummy)} sample contacts."}

    if connection_type == "meta":
        _update_sync(user_id, status="complete", message="Meta API: manual import required")
        return {"success": True, "message": "Meta Cloud API does not support contact list sync. Import manually."}

    if connection_type == "bridge":
        import httpx
        from services.whatsapp_service import bridge_url as _wa_bridge_url

        wa_account = session.phone or ""

        # 1. Try streaming sync (has live progress)
        try:
            return _sync_via_stream(db, wa_account, user_id, progress_callback)
        except Exception as stream_err:
            logger.warning(f"Stream sync failed ({stream_err}), falling back to /contacts")

        # 2. Fallback: plain /contacts endpoint
        try:
            r = httpx.get(_wa_bridge_url(user_id, "/contacts"), timeout=90.0)
            if r.status_code != 200:
                try:
                    friendly = r.json().get("error")
                except Exception:
                    friendly = None
                raise Exception(friendly or f"Bridge returned {r.status_code}: {r.text[:200]}")
            wa_contacts = r.json().get("contacts", [])
            if not wa_contacts:
                raise Exception(
                    "Bridge returned 0 contacts. "
                    "Make sure WhatsApp is connected and your phone has contacts. "
                    "Try disconnecting and reconnecting."
                )
            _update_sync(user_id, total=len(wa_contacts), message=f"Syncing {len(wa_contacts)} contacts...")
            result = _upsert_contacts(db, wa_contacts, wa_account, user_id, progress_callback)
            msg = _build_sync_message(result, wa_contacts, db, wa_account, user_id)
            _update_sync(user_id, status="complete", current=result["total"], total=result["total"], message=msg)
            return {"success": True, "message": msg}
        except Exception as e:
            _update_sync(user_id, status="error", error=str(e))
            logger.error(f"Contacts sync failed: {e}")
            raise Exception(f"Failed to sync contacts: {str(e)}")

    raise ValueError(f"Unknown connection type: {connection_type}")


def _sync_via_stream(
    db: Session,
    wa_account: str,
    user_id: int,
    progress_callback: Optional[Callable],
) -> dict:
    """Sync contacts using the bridge SSE stream endpoint for live progress."""
    import httpx
    from services.whatsapp_service import bridge_url as _wa_bridge_url

    all_contacts: list[dict] = []
    total = 0

    with httpx.Client(timeout=httpx.Timeout(180.0, connect=5.0)) as hc:
        with hc.stream("GET", _wa_bridge_url(user_id, "/contacts/sync-stream")) as stream:
            stream.raise_for_status()
            for raw_line in stream.iter_lines():
                line = raw_line.strip()
                if not line.startswith("data:"):
                    continue
                try:
                    evt = json.loads(line[5:].strip())
                except Exception:
                    continue

                etype = evt.get("type")
                if etype == "progress":
                    t = evt.get("total", 0)
                    c = evt.get("current", 0)
                    msg = evt.get("message", "")
                    _update_sync(user_id, current=c, total=t, message=msg)
                    if progress_callback:
                        progress_callback(c, t, msg)

                elif etype == "batch":
                    batch = evt.get("contacts", [])
                    total = evt.get("total", total)
                    current = evt.get("current", 0)
                    all_contacts.extend(batch)
                    _update_sync(user_id, current=current, total=total, message=f"Syncing contacts... {current}/{total}")
                    if progress_callback:
                        progress_callback(current, total, f"Syncing {current}/{total}")

                elif etype == "complete":
                    total = evt.get("total", len(all_contacts))
                    _update_sync(user_id, current=total, total=total, message=evt.get("message", "Processing..."))

                elif etype == "error":
                    raise Exception(evt.get("message", "Stream sync error"))

    if not all_contacts:
        raise Exception("Stream returned 0 contacts")

    result = _upsert_contacts(db, all_contacts, wa_account, user_id, progress_callback)
    msg = _build_sync_message(result, all_contacts, db, wa_account, user_id)
    _update_sync(user_id, status="complete", current=result["total"], total=result["total"], message=msg)
    return {"success": True, "message": msg}


def _upsert_contacts(
    db: Session,
    wa_contacts: list,
    wa_account: str,
    user_id: int,
    progress_callback: Optional[Callable] = None,
) -> dict:
    """Insert-or-update contacts from bridge into the database.

    Each row is upserted inside its own SAVEPOINT (db.begin_nested()) — if one
    row hits an IntegrityError (e.g. a duplicate slipping through, or any
    other per-row failure), only that row's SAVEPOINT rolls back; every other
    row already flushed in this call stays intact and the sync continues.
    Each row is also flushed immediately after add() so a later row in the
    same batch that maps to the same (user_id, phone, wa_account) sees it as
    "existing" instead of racing an INSERT against it — the session has
    autoflush disabled project-wide, so without this explicit flush, two
    same-phone entries within one 100-row batch would both look "new".
    """
    from sqlalchemy.exc import IntegrityError
    import time as _time

    start = _time.monotonic()
    new_count = 0
    updated_count = 0
    skipped_count = 0
    group_count = 0
    batch_size = 100
    total_received = len(wa_contacts)

    for i, wc in enumerate(wa_contacts):
        phone = wc.get("phone", "").strip()
        name = wc.get("name", "").strip()
        c_type = wc.get("type", "User")
        # Bridge now sends the address-book flag — use it directly
        is_my_contact_bridge = bool(wc.get("is_my_contact", False))

        if not phone or not name:
            continue
        if c_type == "Broadcast":
            continue
        if c_type == "Group":
            group_count += 1

        valid = is_valid_contact_phone(phone)
        type_tag = "Group" if c_type == "Group" else None

        try:
            with db.begin_nested():
                # Scoped lookup first, then unscoped fallback (legacy data) —
                # both constrained to this user so sync can never touch
                # another user's contacts.
                existing = (
                    db.query(Contact)
                    .filter(Contact.phone == phone, Contact.wa_account == wa_account, Contact.user_id == user_id)
                    .first()
                )
                if not existing:
                    existing = (
                        db.query(Contact)
                        .filter(Contact.phone == phone, Contact.wa_account.is_(None), Contact.user_id == user_id)
                        .first()
                    )

                is_new = existing is None
                if existing:
                    changed = False
                    if existing.name != name:
                        existing.name = name
                        changed = True
                    if existing.wa_account != wa_account:
                        existing.wa_account = wa_account
                        changed = True
                    if existing.is_valid != valid:
                        existing.is_valid = valid
                        changed = True
                    # Only upgrade is_my_contact (address-book status), never downgrade
                    if is_my_contact_bridge and not existing.is_my_contact:
                        existing.is_my_contact = True
                        changed = True

                    curr_tags = existing.tags or []
                    if not isinstance(curr_tags, list):
                        curr_tags = []
                    new_tags = [t for t in curr_tags if t not in ("Group", "Team", "User")]
                    if type_tag:
                        new_tags.append(type_tag)
                    if existing.tags != new_tags:
                        existing.tags = new_tags
                        changed = True

                    if changed:
                        db.add(existing)
                else:
                    changed = True
                    contact = Contact(
                        user_id=user_id,
                        name=name,
                        phone=phone,
                        is_active=True,
                        is_valid=valid,
                        is_my_contact=is_my_contact_bridge,
                        tags=[type_tag] if type_tag else [],
                        wa_account=wa_account,
                    )
                    db.add(contact)

                db.flush()

            if is_new and changed:
                new_count += 1
            elif changed:
                updated_count += 1
        except IntegrityError as ie:
            skipped_count += 1
            logger.warning(f"Skipped duplicate contact phone={phone!r} wa_account={wa_account!r} user={user_id}: {ie}")
        except Exception as e:
            skipped_count += 1
            logger.error(f"Failed to upsert contact phone={phone!r} wa_account={wa_account!r} user={user_id}: {e}")

        if (i + 1) % batch_size == 0:
            db.commit()
            msg = f"Saving contacts... {i + 1}/{len(wa_contacts)}"
            _update_sync(user_id, current=i + 1, total=len(wa_contacts), message=msg)
            if progress_callback:
                progress_callback(i + 1, len(wa_contacts), msg)

    db.commit()
    duration = round(_time.monotonic() - start, 2)
    logger.info(
        f"Contact sync (user {user_id}, {wa_account}): received={total_received} "
        f"new={new_count} updated={updated_count} skipped={skipped_count} "
        f"groups={group_count} duration={duration}s"
    )
    return {"new": new_count, "updated": updated_count, "total": new_count + updated_count, "skipped": skipped_count}


def _build_sync_message(result: dict, wa_contacts: list, db: Session, wa_account: str, user_id: int) -> str:
    total_from_bridge = len(wa_contacts)
    total_in_db = (
        db.query(func.count(Contact.id))
        .filter(Contact.wa_account == wa_account, Contact.user_id == user_id, Contact.is_valid == True)
        .scalar() or 0
    )
    parts = []
    if result["new"] > 0:
        parts.append(f"{result['new']} new")
    if result["updated"] > 0:
        parts.append(f"{result['updated']} updated")
    change_str = ", ".join(parts) if parts else "no changes"
    return (
        f"Sync complete: {total_from_bridge} contacts from WhatsApp "
        f"({change_str}). Showing {total_in_db} valid contacts."
    )
