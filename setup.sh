#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  WhatsApp Automate — One-Time Production Setup
#  Run once on Raspberry Pi: bash setup.sh
# ─────────────────────────────────────────────────────────────
set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
PI_IP=$(hostname -I | awk '{print $1}')

echo "================================================"
echo " WhatsApp Automate — Production Setup"
echo " Directory : $APP_DIR"
echo " Pi IP     : $PI_IP"
echo "================================================"
echo ""

# Create logs directory
mkdir -p "$APP_DIR/logs"

# ── Step 1: System packages ───────────────────────────────────
echo "[1/6] Installing system dependencies..."
sudo apt-get update -qq
sudo apt-get install -y -qq nginx python3-pip python3-venv nodejs npm
echo "      ✅ System packages ready"

# ── Step 2: PM2 ───────────────────────────────────────────────
echo "[2/6] Installing PM2..."
sudo npm install -g pm2 2>/dev/null || true
echo "      ✅ PM2 ready"

# ── Step 3: Python backend ────────────────────────────────────
echo "[3/6] Installing Python backend dependencies..."
cd "$APP_DIR/backend"
pip3 install -r requirements.txt -q
cd "$APP_DIR"
echo "      ✅ Backend dependencies installed"

# ── Step 4: WhatsApp bridge ───────────────────────────────────
echo "[4/6] Installing WhatsApp bridge dependencies..."
cd "$APP_DIR/whatsapp-bridge"
npm install --production 2>/dev/null
cd "$APP_DIR"
echo "      ✅ Bridge dependencies installed"

# ── Step 5: Build React frontend ─────────────────────────────
echo "[5/6] Building React frontend for production..."
cd "$APP_DIR/frontend"
npm install 2>/dev/null
npm run build
cd "$APP_DIR"
echo "      ✅ Frontend built → frontend/dist/"

# ── Step 6: Configure nginx ───────────────────────────────────
echo "[6/6] Configuring nginx..."
sudo tee /etc/nginx/sites-available/whatsapp-automate > /dev/null <<NGINX
server {
    listen 80;
    server_name _;

    # Serve React built frontend
    root $APP_DIR/frontend/dist;
    index index.html;

    # Proxy API requests to FastAPI backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        client_max_body_size 50M;
    }

    # React Router — send all other paths to index.html
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINX

# Enable the site and disable default
sudo ln -sf /etc/nginx/sites-available/whatsapp-automate /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
sudo systemctl enable nginx
echo "      ✅ nginx configured and running"

# ── PM2 auto-start on boot ───────────────────────────────────
echo ""
echo "Setting up PM2 to auto-start on boot..."
pm2 startup systemd -u "$USER" --hp "$HOME" 2>/dev/null | grep "sudo" | bash || true

# ── Update backend .env for production ───────────────────────
echo ""
echo "Updating backend .env for production..."
sed -i 's/APP_ENV=development/APP_ENV=production/' "$APP_DIR/backend/.env"
sed -i 's/APP_DEBUG=true/APP_DEBUG=false/' "$APP_DIR/backend/.env"
sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=http://$PI_IP|" "$APP_DIR/backend/.env"

echo ""
echo "================================================"
echo " ✅ Setup Complete!"
echo "================================================"
echo ""
echo "  Run:  ./start.sh    → start the application"
echo "  Run:  ./stop.sh     → stop the application"
echo "  Run:  ./logs.sh     → view logs"
echo ""
echo "  Access your app:  http://$PI_IP"
echo ""
echo "  ⚠️  IMPORTANT: Edit backend/.env and set:"
echo "      DB_HOST, DB_USER, DB_PASSWORD, DB_NAME"
echo "      JWT_SECRET (use a strong random key!)"
echo ""
