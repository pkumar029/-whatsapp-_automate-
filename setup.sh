#!/bin/bash
set -e
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
PI_IP=$(hostname -I | awk '{print $1}')

# Use Cloudflare API domain if provided, else fall back to local Pi IP
# Usage: bash setup.sh                        → local (http://PI_IP:7001)
#        bash setup.sh https://wa-api.tamix.in → Cloudflare public URL
API_BASE="${1:-http://$PI_IP:7001}"

echo "Installing system build dependencies for Python packages..."
sudo apt-get install -y python3-dev libjpeg-dev zlib1g-dev libfreetype6-dev

echo "Creating Python virtual environment..."
python3 -m venv "$APP_DIR/venv"

echo "Installing Python backend dependencies..."
"$APP_DIR/venv/bin/pip" install --upgrade pip
"$APP_DIR/venv/bin/pip" install -r "$APP_DIR/backend/requirements.txt"

echo "Installing WhatsApp bridge dependencies..."
cd "$APP_DIR/whatsapp-bridge" && npm install

echo "Installing serve (frontend static server)..."
sudo npm install -g serve

echo "Building frontend (API → $API_BASE)..."
cd "$APP_DIR/frontend"
npm install
echo "VITE_API_BASE_URL=$API_BASE/api/v1" > .env.production
npm run build

echo ""
echo "Done! Run ./start.sh to start the application."
echo "  Frontend : http://$PI_IP:5173  (or https://wa.tamix.in)"
echo "  Backend  : http://$PI_IP:7001  (or https://wa-api.tamix.in)"
echo "  Bridge   : http://$PI_IP:7002  (internal only)"
