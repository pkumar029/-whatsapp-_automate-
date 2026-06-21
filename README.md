# 📱 WhatsApp Automate

> A powerful n8n-style WhatsApp automation platform. Build automation workflows, manage contacts, send messages, and monitor everything from a single dashboard.

---

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React.js (Vite) + React Router + Axios |
| Backend | Python FastAPI + Uvicorn |
| Database | MySQL 8.x |
| WhatsApp | pywa (Python WhatsApp Web library) |
| Auth | JWT (planned) |

---

## 📁 Project Structure

```
whatsapp-automate/
├── frontend/          # React.js (Vite) application
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Page-level components
│   │   ├── services/     # API communication layer
│   │   └── styles/       # Global CSS styles
│   └── .env              # Frontend environment config
│
├── backend/           # Python FastAPI application
│   ├── routes/           # API route definitions
│   ├── controllers/      # Request handling logic
│   ├── services/         # Business logic
│   ├── models/           # Data models / schemas
│   ├── database/         # DB connection & helpers
│   ├── config/           # App configuration
│   └── utils/            # Helper utilities
│
├── database/          # MySQL schema & migrations
│   ├── schema.sql        # Full database schema
│   └── seed.sql          # Development seed data
│
├── docs/              # Technical documentation
│   ├── SCHEMA.md         # Database schema docs
│   └── WHATSAPP.md       # WhatsApp integration docs
│
└── scripts/           # Development & deployment scripts
    ├── start-dev.ps1     # Start full dev environment
    └── setup-db.ps1      # Database setup script
```

---

## ⚙️ Prerequisites

- **Node.js** v18+ (for React frontend)
- **Python** 3.10+ (for FastAPI backend)
- **MySQL** 8.x (for database)
- **Git**

---

## 🛠️ Local Setup

### 1. Clone the repository
```bash
git clone https://github.com/your-org/whatsapp-automate.git
cd whatsapp-automate
```

### 2. Database Setup
```bash
# Create MySQL database
mysql -u root -p -e "CREATE DATABASE whatsapp_automate;"

# Run schema
mysql -u root -p whatsapp_automate < database/schema.sql

# (Optional) Load seed data
mysql -u root -p whatsapp_automate < database/seed.sql
```

### 3. Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate       # Windows
# source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment
copy .env.example .env
# Edit .env with your database credentials

# Start backend server
uvicorn main:app --reload --port 8000
```

### 4. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Copy and configure environment
copy .env.example .env
# Edit .env with your backend API URL

# Start development server
npm run dev
```

### 5. Verify Setup
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

---

## 🧩 Core Modules

| Module | Description |
|--------|-------------|
| 📊 Dashboard | Summary cards — automations, contacts, messages, WhatsApp status |
| 🤖 Automations | Create and manage n8n-style automation workflows |
| 👥 Contacts | Manage WhatsApp contacts with search and filtering |
| 💬 Messages | Compose and track inbound/outbound messages |
| 📋 Logs | View automation execution history and error details |
| ⚙️ Settings | Configure WhatsApp session and system preferences |

---

## 🔗 API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Backend health check |
| POST | `/api/v1/whatsapp/connect` | Connect WhatsApp session |
| POST | `/api/v1/whatsapp/disconnect` | Disconnect session |
| GET | `/api/v1/whatsapp/status` | Get session status |
| POST | `/api/v1/whatsapp/send` | Send a message |
| GET | `/api/v1/contacts` | List contacts |
| POST | `/api/v1/contacts` | Create contact |
| GET | `/api/v1/messages` | List messages |
| POST | `/api/v1/messages/send` | Send message |
| GET | `/api/v1/automations` | List automations |
| POST | `/api/v1/automations` | Create automation |
| GET | `/api/v1/logs` | View execution logs |

---

## 🌿 Branch Naming Convention

```
WA-001/setup-repository-structure
WA-002/frontend-react-foundation
WA-003/backend-fastapi-foundation
WA-004/database-schema-design
WA-005/whatsapp-auth-integration
```

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.
