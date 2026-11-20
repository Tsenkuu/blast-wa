module.exports = {
  apps: [
    {
      name: 'wa-blast-backend',
      script: './backend/dist/server.js',
      instances: 1, // Single instance to prevent concurrency issues with Baileys session & queue
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: './logs/pm2-backend-error.log',
      out_file: './logs/pm2-backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      time: true
    }
  ]
};
