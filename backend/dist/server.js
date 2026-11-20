"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const app_js_1 = require("./app.js");
const index_js_1 = require("./config/index.js");
const index_js_2 = require("./database/index.js");
const migrate_js_1 = require("./database/migrate.js");
const seed_js_1 = require("./database/seed.js");
const baileysService_js_1 = require("./modules/whatsapp/baileysService.js");
const adminBotService_js_1 = require("./modules/admin-bot/adminBotService.js");
const broadcastQueueWorker_js_1 = require("./modules/broadcast/broadcastQueueWorker.js");
const logger_js_1 = require("./utils/logger.js");
async function bootstrap() {
    console.log('🚀 Menginisialisasi WA BLAST MANAGER PRO...');
    // 1. Initialize Database & Seed
    await index_js_2.db.init();
    try {
        await (0, migrate_js_1.runMigrations)();
        await (0, seed_js_1.runSeed)();
    }
    catch (err) {
        console.warn('Migration/Seed notice:', err.message);
    }
    // 2. Setup Express & HTTP Server
    const app = (0, app_js_1.createApp)();
    const server = http_1.default.createServer(app);
    // 3. Setup Socket.IO
    const io = new socket_io_1.Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });
    (0, logger_js_1.setSocketIO)(io);
    io.on('connection', (socket) => {
        // Send current WA status on connect
        const waInfo = baileysService_js_1.whatsappService.getAccountInfo();
        socket.emit('wa:status', {
            status: waInfo.status,
            phone: waInfo.phone,
            name: waInfo.name,
            qrCode: waInfo.qrCode
        });
    });
    // 4. Initialize WhatsApp Service & Admin Controller
    await baileysService_js_1.whatsappService.init();
    adminBotService_js_1.whatsappAdminController.init();
    // 5. Start Background Queue Worker
    await broadcastQueueWorker_js_1.broadcastQueueWorker.start();
    // 6. Listen on Port
    server.listen(index_js_1.config.port, () => {
        (0, logger_js_1.logSystem)('SUCCESS', 'SYSTEM', `Server berjalan di port ${index_js_1.config.port} (Environment: ${index_js_1.config.env})`);
        console.log(`📡 WA Blast Manager Pro Backend aktif: http://localhost:${index_js_1.config.port}`);
    });
    // Graceful shutdown handling
    const shutdown = async (signal) => {
        console.log(`\n🛑 Menerima sinyal ${signal}. Menutup proses dengan aman...`);
        await broadcastQueueWorker_js_1.broadcastQueueWorker.stop();
        await baileysService_js_1.whatsappService.disconnect();
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
