#!/bin/bash
# Rebuild frontend and restart all services after code changes
# Usage: ./rebuild.sh
set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Rebuilding WhatsApp Automate..."

# Rebuild React frontend
echo "[1/2] Building frontend..."
cd "$APP_DIR/frontend"
npm run build
cd "$APP_DIR"
echo "      ✅ Frontend rebuilt"

# Restart services
echo "[2/2] Restarting services..."
pm2 restart ecosystem.config.js
pm2 list

PI_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "✅ Rebuild complete! App running at: http://$PI_IP"
