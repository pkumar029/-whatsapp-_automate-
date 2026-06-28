#!/bin/bash
# Install all dependencies
set -e

echo "Installing Python backend dependencies..."
cd backend && pip3 install -r requirements.txt && cd ..

echo "Installing WhatsApp bridge dependencies..."
cd whatsapp-bridge && npm install && cd ..

echo "Installing and building frontend..."
cd frontend && npm install && npm run build && cd ..

echo "Done! Run ./start.sh to start the application."
