module.exports = {
  apps: [{
    name: 'whatsapp-blast',
    script: './server.js',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '400M',
    node_args: '--max-old-space-size=512',
    env: {
      NODE_ENV: 'production',
      PORT: 4000
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 4000
  }]
};
