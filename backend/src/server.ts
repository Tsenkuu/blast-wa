import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { db } from './database/index.js';
import { runMigrations } from './database/migrate.js';
import { runSeed } from './database/seed.js';
import { whatsappService } from './modules/whatsapp/baileysService.js';
import { whatsappAdminController } from './modules/admin-bot/adminBotService.js';
import { broadcastQueueWorker } from './modules/broadcast/broadcastQueueWorker.js';
import { setSocketIO, logSystem } from './utils/logger.js';

async function bootstrap() {
  console.log('🚀 Menginisialisasi WA BLAST MANAGER PRO...');

  // 1. Initialize Database & Seed
  await db.init();
  try {
    await runMigrations();
    await runSeed();
  } catch (err: any) {
    console.warn('Migration/Seed notice:', err.message);
  }

  // 2. Setup Express & HTTP Server
  const app = createApp();
  const server = http.createServer(app);

  // 3. Setup Socket.IO
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  setSocketIO(io);

  io.on('connection', (socket) => {
    // Send current WA status on connect
    const waInfo = whatsappService.getAccountInfo();
    socket.emit('wa:status', {
      status: waInfo.status,
      phone: waInfo.phone,
      name: waInfo.name,
      qrCode: waInfo.qrCode
    });
  });

  // 4. Initialize WhatsApp Service & Admin Controller
  await whatsappService.init();
  whatsappAdminController.init();

  // 5. Start Background Queue Worker
  await broadcastQueueWorker.start();

  // 6. Listen on Port
  server.listen(config.port, () => {
    logSystem('SUCCESS', 'SYSTEM', `Server berjalan di port ${config.port} (Environment: ${config.env})`);
    console.log(`📡 WA Blast Manager Pro Backend aktif: http://localhost:${config.port}`);
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Menerima sinyal ${signal}. Menutup proses dengan aman...`);
    await broadcastQueueWorker.stop();
    await whatsappService.disconnect();
    server.close(() => {
      console.log('🏁 Server berhasil dihentikan.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('❌ Gagal menjalankan server:', err);
  process.exit(1);
});
