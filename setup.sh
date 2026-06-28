#!/bin/bash
set -e
APP_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Installing system build dependencies for Python packages..."
sudo apt-get install -y python3-dev libjpeg-dev zlib1g-dev libfreetype6-dev

echo "Creating Python virtual environment..."
python3 -m venv "$APP_DIR/venv"

echo "Installing Python backend dependencies..."
"$APP_DIR/venv/bin/pip" install --upgrade pip
"$APP_DIR/venv/bin/pip" install -r "$APP_DIR/backend/requirements.txt"

echo "Installing WhatsApp bridge dependencies..."
cd "$APP_DIR/whatsapp-bridge" && npm install

echo "Installing and building frontend..."
cd "$APP_DIR/frontend" && npm install && npm run build

echo ""
echo "Done! Run ./start.sh to start the application."
