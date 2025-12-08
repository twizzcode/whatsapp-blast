# Optimized for 1GB VPS

## Setup Production

1. Install PM2 (process manager):
```bash
npm install -g pm2
```

2. Start server dengan PM2:
```bash
cd server
pm2 start ecosystem.config.js
```

3. Setup auto-start on reboot:
```bash
pm2 startup
pm2 save
```

## Commands

```bash
# Start
pm2 start ecosystem.config.js

# Stop
pm2 stop whatsapp-blast

# Restart
pm2 restart whatsapp-blast

# View logs
pm2 logs whatsapp-blast

# Monitor memory/cpu
pm2 monit

# Delete from PM2
pm2 delete whatsapp-blast
```

## Memory Optimizations Applied

✅ Node.js max memory: 512MB
✅ Auto-restart if exceeds 400MB
✅ Puppeteer optimized for low memory
✅ Socket.IO buffer reduced
✅ Chrome args optimized
✅ Disabled unnecessary features

## VPS Recommendations

- Use swap file (2GB) jika memory penuh
- Monitor dengan `pm2 monit`
- Check logs: `pm2 logs`
