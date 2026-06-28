#!/bin/bash
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$APP_DIR/logs"

echo "Starting WhatsApp bridge on port 3000..."
cd "$APP_DIR/whatsapp-bridge"
node index.js > "$APP_DIR/logs/bridge.log" 2>&1 &
echo "Bridge PID: $!"

echo "Starting backend on port 8000..."
cd "$APP_DIR/backend"
"$APP_DIR/venv/bin/python" -m uvicorn main:app --host 0.0.0.0 --port 8000 > "$APP_DIR/logs/backend.log" 2>&1 &
echo "Backend PID: $!"

echo ""
echo "Both services running. Logs in ./logs/"
echo "  Backend : http://localhost:8000"
echo "  Bridge  : http://localhost:3000"
echo ""
echo "To stop: kill \$(lsof -ti:8000) \$(lsof -ti:3000)"
