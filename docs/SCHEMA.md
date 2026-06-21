# Database Schema Documentation

## Overview

WhatsApp Automate uses MySQL 8.x with 7 core tables.

---

## Tables

### `users`
Stores application users who administer the platform.

| Column | Type | Description |
|--------|------|-------------|
| id | INT (PK) | Auto-increment primary key |
| name | VARCHAR(100) | Full name |
| email | VARCHAR(150) | Unique email (login) |
| password_hash | VARCHAR(255) | bcrypt-hashed password |
| is_active | TINYINT | Account enabled |
| is_admin | TINYINT | Admin privilege flag |
| created_at | DATETIME | Record creation time |
| updated_at | DATETIME | Last update time |

---

### `whatsapp_sessions`
Tracks the WhatsApp Web connection state and credentials.

| Column | Type | Description |
|--------|------|-------------|
| id | INT (PK) | Auto-increment |
| user_id | INT (FK→users) | Owner user |
| phone | VARCHAR(20) | Connected phone number |
| status | ENUM | `connected`, `disconnected`, `connecting`, `expired` |
| session_data | JSON | pywa session credentials |
| qr_code | TEXT | Base64 QR image for scanning |
| connected_at | DATETIME | When connection was established |
| disconnected_at | DATETIME | When session ended |
| error_message | TEXT | Last error if any |

---

### `contacts`
WhatsApp contacts managed in the system.

| Column | Type | Description |
|--------|------|-------------|
| id | INT (PK) | Auto-increment |
| name | VARCHAR(100) | Contact name |
| phone | VARCHAR(20) | **Unique** E.164 phone number |
| email | VARCHAR(150) | Optional email |
| notes | TEXT | Internal notes |
| tags | JSON | Array of tag strings |
| is_active | TINYINT | Active/inactive |
| is_blocked | TINYINT | Block from automation |

---

### `messages`
All inbound and outbound WhatsApp message records.

| Column | Type | Description |
|--------|------|-------------|
| id | INT (PK) | Auto-increment |
| contact_id | INT (FK→contacts) | Linked contact |
| phone | VARCHAR(20) | Phone number (denormalized) |
| direction | ENUM | `inbound` or `outbound` |
| content | TEXT | Message text |
| media_url | VARCHAR(500) | Media file URL |
| media_type | VARCHAR(50) | `image`, `video`, `document` |
| status | ENUM | `pending`, `sent`, `delivered`, `read`, `failed` |
| whatsapp_message_id | VARCHAR(100) | WhatsApp-assigned ID |
| automation_id | INT (FK→automations) | Triggered by automation |
| error_message | TEXT | Failure reason |
| sent_at / delivered_at / read_at | DATETIME | Delivery timestamps |

---

### `automations`
Workflow-level automation configuration.

| Column | Type | Description |
|--------|------|-------------|
| id | INT (PK) | Auto-increment |
| name | VARCHAR(150) | Automation name |
| description | TEXT | Purpose description |
| trigger_type | ENUM | `keyword`, `schedule`, `contact_added`, `message_received`, `manual` |
| trigger_config | JSON | Trigger configuration (e.g., `{"keyword": "hello"}`) |
| is_active | TINYINT | Running or paused |
| run_count | INT | Total execution count |
| last_run | DATETIME | Last execution time |

---

### `automation_steps`
Ordered steps within an automation workflow.

| Column | Type | Description |
|--------|------|-------------|
| id | INT (PK) | Auto-increment |
| automation_id | INT (FK→automations) | Parent automation |
| step_type | ENUM | `send_message`, `delay`, `condition`, `update_contact`, `webhook`, `log` |
| step_order | SMALLINT | Execution order (1-based) |
| name | VARCHAR(100) | Display label |
| config | JSON | Step parameters (e.g., message template) |
| is_active | TINYINT | Skip step if false |

---

### `automation_logs`
Execution history for every automation run.

| Column | Type | Description |
|--------|------|-------------|
| id | INT (PK) | Auto-increment |
| automation_id | INT (FK→automations) | Parent automation |
| status | ENUM | `running`, `success`, `failed`, `partial` |
| trigger_data | JSON | Data that fired the automation |
| log_output | TEXT | Step-by-step execution log |
| error_message | TEXT | Error if failed |
| steps_executed | SMALLINT | Steps completed |
| total_steps | SMALLINT | Total steps planned |
| execution_time | FLOAT | Duration in milliseconds |
| started_at | DATETIME | Run start time |
| finished_at | DATETIME | Run end time |

---

## Entity Relationship

```
users ──────────────── whatsapp_sessions
          │
contacts ─┤─ messages ──── automations ─── automation_steps
                 │               │
                 └─── automation_logs ──────────────────────
```

---

## Indexes

All tables have indexes on commonly filtered columns:
- `phone` fields — fast lookup by number
- `status` fields — filter by state
- `is_active` — quick active record queries
- `created_at` / `started_at` — time-range queries
- Composite `(automation_id, step_order)` — ordered step retrieval
