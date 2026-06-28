#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  WhatsApp Automate — Start Application
#  Usage: ./start.sh
# ─────────────────────────────────────────────────────────────
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
PI_IP=$(hostname -I | awk '{print $1}')

mkdir -p "$APP_DIR/logs"

echo "Starting WhatsApp Automate..."
cd "$APP_DIR"

# Stop any old instances first
pm2 delete ecosystem.config.js 2>/dev/null || true

# Start all services
pm2 start ecosystem.config.js

# Save process list (survives reboot)
pm2 save

echo ""
pm2 list

echo ""
echo "================================================"
echo " ✅ Application Running!"
echo "================================================"
echo ""
echo "  App URL   :  http://$PI_IP"
echo "  API Docs  :  http://$PI_IP:8000/docs"
echo "  Bridge    :  http://localhost:3000/health"
echo ""
echo "  Logs      :  ./logs.sh"
echo "  Stop      :  ./stop.sh"
echo "  Restart   :  ./restart.sh"
echo ""
