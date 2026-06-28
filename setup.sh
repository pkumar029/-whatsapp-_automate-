#!/bin/bash
set -e
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
PI_IP=$(hostname -I | awk '{print $1}')

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

echo "Building frontend for production (API → http://$PI_IP:7001)..."
cd "$APP_DIR/frontend"
npm install
echo "VITE_API_BASE_URL=http://$PI_IP:7001/api/v1" > .env.production
npm run build

echo ""
echo "Done! Run ./start.sh to start the application."
echo "  Frontend : http://$PI_IP:5173"
echo "  Backend  : http://$PI_IP:7001"
echo "  Bridge   : http://$PI_IP:7002"
