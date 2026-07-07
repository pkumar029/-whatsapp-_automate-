#!/bin/bash
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
PI_IP=$(hostname -I | awk '{print $1}')
mkdir -p "$APP_DIR/logs"

echo "Starting WhatsApp bridge on port 7002..."
cd "$APP_DIR/whatsapp-bridge"
PORT=7002 node index.js > "$APP_DIR/logs/bridge.log" 2>&1 &
echo "  Bridge PID: $!"

echo "Starting backend on port 7001..."
cd "$APP_DIR/backend"
"$APP_DIR/venv/bin/python" -m uvicorn main:app --host 0.0.0.0 --port 7001 > "$APP_DIR/logs/backend.log" 2>&1 &
echo "  Backend PID: $!"

echo "Starting frontend on port 5173..."
serve -s "$APP_DIR/frontend/dist" -l 5173 > "$APP_DIR/logs/frontend.log" 2>&1 &
echo "  Frontend PID: $!"

echo ""
echo "======================================="
echo "  App running!"
echo "  Open: http://$PI_IP:5173"
echo "======================================="
echo ""
echo "Logs: ./logs/   |   Stop: ./stop.sh"
