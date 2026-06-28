#!/bin/bash
# Restart all or a specific service
# Usage: ./restart.sh              → restart all
#        ./restart.sh wa-backend   → restart backend only
#        ./restart.sh wa-bridge    → restart bridge only
cd "$(dirname "$0")"

if [ -n "$1" ]; then
  echo "Restarting $1..."
  pm2 restart "$1"
else
  echo "Restarting all services..."
  pm2 restart ecosystem.config.js
fi

pm2 list
