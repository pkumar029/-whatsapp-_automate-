#!/bin/bash
set -e
APP_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Creating Python virtual environment..."
python3 -m venv "$APP_DIR/venv"

echo "Installing Python backend dependencies..."
"$APP_DIR/venv/bin/pip" install -r "$APP_DIR/backend/requirements.txt"

echo "Installing WhatsApp bridge dependencies..."
cd "$APP_DIR/whatsapp-bridge" && npm install

echo "Installing and building frontend..."
cd "$APP_DIR/frontend" && npm install && npm run build

echo ""
echo "Done! Run ./start.sh to start the application."
