#!/bin/bash
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$APP_DIR/logs"

echo "Starting WhatsApp bridge on port 7002..."
cd "$APP_DIR/whatsapp-bridge"
PORT=7002 node index.js > "$APP_DIR/logs/bridge.log" 2>&1 &
echo "Bridge PID: $!"

echo "Starting backend on port 7001..."
cd "$APP_DIR/backend"
"$APP_DIR/venv/bin/python" -m uvicorn main:app --host 0.0.0.0 --port 7001 > "$APP_DIR/logs/backend.log" 2>&1 &
echo "Backend PID: $!"

echo ""
echo "Both services running. Logs in ./logs/"
echo "  Backend : http://localhost:7001"
echo "  Bridge  : http://localhost:7002"
echo ""
echo "To stop: kill \$(lsof -ti:7001) \$(lsof -ti:7002)"
