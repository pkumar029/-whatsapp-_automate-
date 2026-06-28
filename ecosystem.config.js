// PM2 Process Manager — WhatsApp Automate
// Manages: WhatsApp Bridge (Node.js) + FastAPI Backend (Python)
module.exports = {
  apps: [
    {
      name: 'wa-bridge',
      cwd: './whatsapp-bridge',
      script: 'index.js',
      watch: false,
      autorestart: true,
      max_memory_restart: '400M',
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: 7002,
      },
      out_file: '../logs/bridge.log',
      error_file: '../logs/bridge-error.log',
      time: true,
    },
    {
      name: 'wa-backend',
      cwd: './backend',
      script: 'python3',
      args: '-m uvicorn main:app --host 0.0.0.0 --port 7001 --workers 1 --log-level info',
      watch: false,
      autorestart: true,
      max_memory_restart: '600M',
      restart_delay: 3000,
      env: {
        PYTHONPATH: '.',
      },
      out_file: '../logs/backend.log',
      error_file: '../logs/backend-error.log',
      time: true,
    },
  ],
}
