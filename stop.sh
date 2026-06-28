#!/bin/bash
# Stop all WhatsApp Automate services
echo "Stopping WhatsApp Automate..."
cd "$(dirname "$0")"
pm2 stop ecosystem.config.js
pm2 list
echo "✅ All services stopped."
