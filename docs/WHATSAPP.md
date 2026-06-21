# WhatsApp Integration Documentation

## Selected Package: `pywa`

**Why pywa?**
- Pure Python — no Node.js required
- Supports WhatsApp Business Cloud API (official)
- Clean async/sync API
- Session management, message sending, webhooks
- Active maintenance and documentation

**Documentation**: https://pywa.readthedocs.io

---

## Integration Architecture

```
User → Settings page → Backend /api/v1/whatsapp/connect
                                        ↓
                            whatsapp_service.connect_whatsapp()
                                        ↓
                            Generate QR (pywa or simulate)
                                        ↓
                            Store in whatsapp_sessions table
                                        ↓
                            Return QR to frontend for display
                                        ↓
                            User scans QR with phone
                                        ↓
                            Session status → 'connected'
```

---

## Service Methods

| Method | Description |
|--------|-------------|
| `connect_whatsapp(db)` | Initiate QR login flow |
| `disconnect_whatsapp(db)` | End the active session |
| `get_session_status(db)` | Return current status dict |
| `send_whatsapp_message(db, phone, message)` | Send outbound message |
| `refresh_session_if_needed(db)` | Reconnect if session expired |
| `simulate_connected(db, phone)` | DEV helper: skip QR scan |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/whatsapp/status` | Current session status |
| POST | `/api/v1/whatsapp/connect` | Start connection / get QR |
| POST | `/api/v1/whatsapp/disconnect` | End session |
| POST | `/api/v1/whatsapp/send` | Send a message |
| GET | `/api/v1/whatsapp/qr` | Get current QR code |
| POST | `/api/v1/whatsapp/dev/connect` | DEV: skip QR, mark connected |

---

## Environment Variables

```env
WHATSAPP_PHONE_ID=your_phone_number_id
WHATSAPP_TOKEN=your_whatsapp_api_token
WHATSAPP_SESSION_DIR=./whatsapp_session
WHATSAPP_WEBHOOK_URL=http://localhost:8000/api/v1/whatsapp/webhook
```

---

## Known Limitations

1. **QR-based login** (WhatsApp Web) is not officially supported — use at own risk for personal use
2. **pywa** primarily supports WhatsApp Business Cloud API (official Meta API)
3. For production, you need a Meta Business Account and WhatsApp Business number
4. Rate limits apply: 1000 messages/day on free tier

---

## Development Testing

During development, use the `/api/v1/whatsapp/dev/connect` endpoint to simulate a connected session without scanning a QR code. This allows you to test message sending and automation execution without a real WhatsApp account.

```bash
curl -X POST "http://localhost:8000/api/v1/whatsapp/dev/connect?phone=%2B919876543210"
```

---

## Production Setup (Official WhatsApp Business API)

1. Create a Meta Business Account
2. Register a WhatsApp Business number
3. Get API token and phone number ID from Meta Developer Console
4. Set `WHATSAPP_PHONE_ID` and `WHATSAPP_TOKEN` in `.env`
5. Configure webhook URL for incoming messages
6. Deploy backend with public HTTPS URL for webhook
