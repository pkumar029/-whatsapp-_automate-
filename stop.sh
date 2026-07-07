#!/bin/bash
echo "Stopping WhatsApp Automate..."
kill $(lsof -ti:5173) 2>/dev/null && echo "  Frontend stopped" || true
kill $(lsof -ti:7001) 2>/dev/null && echo "  Backend stopped"  || true
kill $(lsof -ti:7002) 2>/dev/null && echo "  Bridge stopped"   || true
echo "Done."
