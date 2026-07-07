#!/bin/bash
# View application logs
# Usage: ./logs.sh              → stream all logs
#        ./logs.sh backend      → backend only
#        ./logs.sh bridge       → whatsapp bridge only
#        ./logs.sh status       → PM2 process status

cd "$(dirname "$0")"

case "$1" in
  backend)  pm2 logs wa-backend --lines 50 ;;
  bridge)   pm2 logs wa-bridge --lines 50 ;;
  status)   pm2 list ;;
  *)        pm2 logs --lines 50 ;;
esac
