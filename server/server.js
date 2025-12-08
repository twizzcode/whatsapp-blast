const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const socketIO = require('socket.io');
const http = require('http');
const multer = require('multer'); // Untuk upload gambar
const fs = require('fs');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: "http://localhost:3000" } // Izinkan Next.js akses
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// History storage
const HISTORY_FILE = path.join(__dirname, 'blast-history.json');

// Load history from file
const loadHistory = () => {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading history:', error);
  }
  return [];
};

// Save history to file
const saveHistory = (history) => {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (error) {
    console.error('Error saving history:', error);
  }
};

let blastHistory = loadHistory();

// Login credentials (ganti password sesuai kebutuhan)
const LOGIN_USERNAME = 'bismillah';
const LOGIN_PASSWORD = 'hamasahlillah';

// Konfigurasi upload gambar sementara
const upload = multer({ dest: 'uploads/' });

let client;
let isClientReady = false;

// Function to initialize WhatsApp client
const initializeClient = () => {
  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
      headless: true, 
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // PENTING: Mencegah crash memori di Linux/Docker
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', 
        '--disable-gpu'
      ] 
    }
  });

  client.on('qr', (qr) => {
    qrcode.toDataURL(qr, (err, url) => {
      io.emit('qr', url);
      console.log('QR Code generated');
    });
  });

  client.on('ready', () => {
    console.log('Client is ready!');
    isClientReady = true;
    io.emit('ready', 'WhatsApp Siap Digunakan!');
  });

  client.on('authenticated', () => {
    console.log('Client authenticated!');
  });

  client.on('auth_failure', () => {
    console.log('Authentication failed!');
  });

  client.on('disconnected', (reason) => {
    console.log('Client was logged out:', reason);
    isClientReady = false;
  });

  client.initialize();
};

// Initialize client on startup
initializeClient();

// Login endpoint
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === LOGIN_USERNAME && password === LOGIN_PASSWORD) {
    res.json({ status: 'success', message: 'Login berhasil' });
  } else {
    res.status(401).json({ status: 'error', message: 'Username atau password salah' });
  }
});

// Logout endpoint - destroy WhatsApp session and reinitialize
app.post('/logout', async (req, res) => {
  try {
    if (client) {
      await client.destroy();
      isClientReady = false;
      console.log('Client destroyed, reinitializing...');
      
      // Wait a bit before reinitializing
      setTimeout(() => {
        initializeClient();
      }, 2000);
    }
    res.json({ status: 'success', message: 'Logout berhasil' });
  } catch (error) {
    console.error('Logout error:', error);
    // Reinitialize anyway
    setTimeout(() => {
      initializeClient();
    }, 2000);
    res.json({ status: 'success', message: 'Logout berhasil' });
  }
});

// Emit status saat client baru connect
io.on('connection', (socket) => {
  console.log('New client connected');
  
  // Kirim status WhatsApp ke client yang baru connect
  if (isClientReady) {
    socket.emit('ready', 'WhatsApp Siap Digunakan!');
  }
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Helper untuk delay (PENTING AGAR TIDAK KENA BAN)
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 2. Endpoint untuk Upload dan Parse Excel
app.post('/upload-excel', upload.single('excel'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'error', msg: 'File Excel tidak ditemukan' });
    }

    const xlsx = require('xlsx');
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // Format: { nomor: '08123456789', nama: 'Budi' }
    const contacts = data.map(row => ({
      phone: row.nomor || row.Nomor || row.phone || row.Phone,
      name: row.nama || row.Nama || row.name || row.Name || 'Customer'
    }));

    // Hapus file setelah parsing
    fs.unlinkSync(req.file.path);

    res.json({ status: 'success', data: contacts });
  } catch (error) {
    console.error('Error parsing Excel:', error);
    res.status(500).json({ status: 'error', msg: 'Gagal memproses file Excel' });
  }
});

// 3. Endpoint untuk Blast
app.post('/send-blast', upload.single('image'), async (req, res) => {
  const { message, targets, settings } = req.body;
  const file = req.file;

  if (!targets) return res.status(400).json({ status: 'error', msg: 'Data target kosong' });

  const targetList = JSON.parse(targets);
  const blastSettings = settings ? JSON.parse(settings) : {
    minDelay: 3000,
    maxDelay: 10000,
    minBatchSize: 20,
    maxBatchSize: 50,
    minBatchDelay: 30 * 60 * 1000,
    maxBatchDelay: 60 * 60 * 1000
  }; 
  
  let media = null;
  if (file) {
    // CARA BARU (SOLUSI) - Baca file sebagai base64 dengan mimetype yang jelas
    try {
      // 1. Kita baca file aslinya jadi base64
      const mediaData = fs.readFileSync(file.path, { encoding: 'base64' });
      
      // 2. Kita buat MessageMedia dengan Mimetype yang JELAS (diambil dari multer)
      // Format: new MessageMedia(mimetype, base64data, filename)
      media = new MessageMedia(file.mimetype, mediaData, file.originalname);
      
      console.log(`Media diproses: ${file.mimetype} - ${file.originalname}`);
    } catch (err) {
      console.error("Gagal memproses gambar:", err);
    }
  }

  // Kirim response dulu biar HTTP request selesai
  res.json({ status: 'success', msg: 'Proses blasting dimulai...' });

  // Create history record
  const historyId = Date.now().toString();
  const historyRecord = {
    id: historyId,
    date: new Date().toISOString(),
    totalContacts: targetList.length,
    success: 0,
    failed: 0,
    message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
    hasImage: !!file,
    settings: blastSettings,
    status: 'running',
    contacts: targetList.map(t => ({ ...t, status: 'pending' }))
  };

  blastHistory.unshift(historyRecord);
  saveHistory(blastHistory);

  // --- PROSES BACKGROUND dengan BATCH ---
  (async () => {
    let processedCount = 0;
    const totalTargets = targetList.length;
    
    for (let i = 0; i < targetList.length; i++) {
      const target = targetList[i];
      const originalPhone = target.phone; 

      try {
        let number = target.phone.toString().replace(/\D/g, ''); 
        if (number.startsWith('0')) number = '62' + number.slice(1);
        if (!number.endsWith('@c.us')) number += '@c.us';

        let personalizedMessage = message.replace(/{nama}/g, target.name);

        if (media) {
          await client.sendMessage(number, media, { caption: personalizedMessage });
        } else {
          await client.sendMessage(number, personalizedMessage);
        }

        console.log(`Sukses kirim ke ${target.name} (${i + 1}/${totalTargets})`);

        io.emit('blast-progress', { 
          phone: originalPhone, 
          status: 'success' 
        });

        // Update history
        historyRecord.success++;
        historyRecord.contacts[i].status = 'success';
        saveHistory(blastHistory);
        
        processedCount++;
        
        // Random delay per message
        const randomDelay = Math.floor(Math.random() * (blastSettings.maxDelay - blastSettings.minDelay + 1) + blastSettings.minDelay);
        await delay(randomDelay);

        // Batch delay with random batch size
        const randomBatchSize = Math.floor(Math.random() * (blastSettings.maxBatchSize - blastSettings.minBatchSize + 1) + blastSettings.minBatchSize);
        if (processedCount % randomBatchSize === 0 && i < targetList.length - 1) {
          const randomBatchDelay = Math.floor(Math.random() * (blastSettings.maxBatchDelay - blastSettings.minBatchDelay + 1) + blastSettings.minBatchDelay);
          console.log(`Batch ${Math.floor(processedCount / randomBatchSize)} selesai (${randomBatchSize} pesan). Istirahat ${randomBatchDelay / 1000 / 60} menit...`);
          await delay(randomBatchDelay);
        }

      } catch (error) {
        console.error(`Gagal kirim ke ${target.name}:`, error);

        io.emit('blast-progress', { 
          phone: originalPhone, 
          status: 'failed' 
        });

        // Update history
        historyRecord.failed++;
        historyRecord.contacts[i].status = 'failed';
        saveHistory(blastHistory);
      }
    }
    
    // Mark history as completed
    historyRecord.status = 'completed';
    historyRecord.completedAt = new Date().toISOString();
    saveHistory(blastHistory);
    
    if (file) fs.unlinkSync(file.path);
    
    console.log(`Blast selesai! Total: ${totalTargets}, Berhasil: ${processedCount}`);
    io.emit('blast-completed', true);

  })();
});

// Get blast history
app.get('/history', (req, res) => {
  res.json({ status: 'success', data: blastHistory });
});

// Get specific history detail
app.get('/history/:id', (req, res) => {
  const history = blastHistory.find(h => h.id === req.params.id);
  if (history) {
    res.json({ status: 'success', data: history });
  } else {
    res.status(404).json({ status: 'error', message: 'History not found' });
  }
});

// Delete history
app.delete('/history/:id', (req, res) => {
  const index = blastHistory.findIndex(h => h.id === req.params.id);
  if (index !== -1) {
    blastHistory.splice(index, 1);
    saveHistory(blastHistory);
    res.json({ status: 'success', message: 'History deleted' });
  } else {
    res.status(404).json({ status: 'error', message: 'History not found' });
  }
});

server.listen(4000, () => {
  console.log('Server berjalan di port 4000');
});