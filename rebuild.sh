#!/bin/bash
# Rebuild frontend and restart all services after code changes
# Usage: ./rebuild.sh
set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Rebuilding WhatsApp Automate..."

# .env.production is gitignored (correctly — it's environment-specific), but
# that means it's invisible to `git pull` and easy to lose/corrupt without
# anyone noticing — which has silently reverted the API base URL to a broken
# same-origin relative path more than once. Regenerate it every rebuild
# instead of trusting whatever happens to already be on disk.
echo "[1/3] Writing frontend/.env.production..."
cat > "$APP_DIR/frontend/.env.production" <<'ENVEOF'
VITE_API_BASE_URL=https://wa-api.tamix.in/api/v1
VITE_APP_NAME=WhatsApp Automate
VITE_APP_VERSION=1.0.0
VITE_APP_ENV=production
VITE_ENABLE_LOGS=false
VITE_ENABLE_AUTOMATION=true
ENVEOF
echo "      ✅ .env.production written (VITE_API_BASE_URL=https://wa-api.tamix.in/api/v1)"

# Rebuild React frontend
echo "[2/3] Building frontend..."
cd "$APP_DIR/frontend"
npm run build
cd "$APP_DIR"
echo "      ✅ Frontend rebuilt"

# Restart services
echo "[3/3] Restarting services..."
pm2 restart ecosystem.config.js
pm2 list

PI_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "✅ Rebuild complete! App running at: http://$PI_IP"
