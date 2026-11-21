"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaileysAdapter = void 0;
const baileys_1 = __importStar(require("@whiskeysockets/baileys"));
const pino_1 = __importDefault(require("pino"));
const qrcode_1 = __importDefault(require("qrcode"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const index_js_1 = require("../../config/index.js");
const normalizer_js_1 = require("../../utils/normalizer.js");
class BaileysAdapter {
    socket = null;
    status = 'disconnected';
    qrCode = null;
    jid = null;
    phone = null;
    pushName = null;
    incomingHandlers = [];
    connectionChangeHandlers = [];
    reconnectAttempts = 0;
    maxAutoReconnectAttempts = 5;
    isExplicitDisconnect = false;
    reconnectTimeout = null;
    async init() {
        if (!fs_1.default.existsSync(index_js_1.config.storage.sessionsDir)) {
            fs_1.default.mkdirSync(index_js_1.config.storage.sessionsDir, { recursive: true });
        }
    }
    getAccountInfo() {
        return {
            jid: this.jid,
            phone: this.phone,
            name: this.pushName,
            status: this.status,
            qrCode: this.qrCode
        };
    }
    onIncomingMessage(handler) {
        this.incomingHandlers.push(handler);
    }
    onConnectionChange(handler) {
        this.connectionChangeHandlers.push(handler);
    }
    notifyConnectionChange() {
        const info = this.getAccountInfo();
        for (const handler of this.connectionChangeHandlers) {
            try {
                handler(info);
            }
            catch (e) {
                console.error('Error in connectionChange handler:', e);
            }
        }
    }
    async cleanupSocket() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.socket) {
            try {
                this.socket.ev.removeAllListeners('connection.update');
                this.socket.ev.removeAllListeners('creds.update');
                this.socket.ev.removeAllListeners('messages.upsert');
                this.socket.end(undefined);
            }
            catch (e) {
                // Safe ignore
            }
            this.socket = null;
        }
    }
    forceClearSessionsDir() {
        try {
            if (fs_1.default.existsSync(index_js_1.config.storage.sessionsDir)) {
                const files = fs_1.default.readdirSync(index_js_1.config.storage.sessionsDir);
                for (const file of files) {
                    const filePath = path_1.default.join(index_js_1.config.storage.sessionsDir, file);
                    try {
                        if (fs_1.default.lstatSync(filePath).isDirectory()) {
                            fs_1.default.rmSync(filePath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
                        }
                        else {
                            try {
                                fs_1.default.writeFileSync(filePath, '');
                            }
                            catch (_) { }
                            fs_1.default.unlinkSync(filePath);
                        }
                    }
                    catch (e) {
                        console.warn(`[Baileys] Gagal menghapus berkas sesi ${file}:`, e);
                    }
                }
            }
            else {
                fs_1.default.mkdirSync(index_js_1.config.storage.sessionsDir, { recursive: true });
            }
            console.log('[Baileys] Berkas sesi berhasil dibersihkan total.');
        }
        catch (err) {
            console.error('[Baileys] Error membersihkan folder sesi:', err);
        }
    }
    async connect() {
        this.isExplicitDisconnect = false;
        // Clean up any stale socket instance before creating a new one
        await this.cleanupSocket();
        this.status = 'connecting';
        this.notifyConnectionChange();
        try {
            if (!fs_1.default.existsSync(index_js_1.config.storage.sessionsDir)) {
                fs_1.default.mkdirSync(index_js_1.config.storage.sessionsDir, { recursive: true });
            }
            // Check if creds.json exists and is corrupted or empty
            const credsPath = path_1.default.join(index_js_1.config.storage.sessionsDir, 'creds.json');
            if (fs_1.default.existsSync(credsPath)) {
                try {
                    const raw = fs_1.default.readFileSync(credsPath, 'utf8');
                    if (!raw || raw.trim() === '' || raw.trim() === '{}') {
                        fs_1.default.unlinkSync(credsPath);
                    }
                }
                catch (_) {
                    try {
                        fs_1.default.unlinkSync(credsPath);
                    }
                    catch (__) { }
                }
            }
            let authState;
            try {
                authState = await (0, baileys_1.useMultiFileAuthState)(index_js_1.config.storage.sessionsDir);
            }
            catch (authErr) {
                console.warn('[Baileys] Sesi auth rusak/tidak valid. Mengosongkan folder sesi untuk pairing baru...', authErr);
                this.forceClearSessionsDir();
                authState = await (0, baileys_1.useMultiFileAuthState)(index_js_1.config.storage.sessionsDir);
            }
            const { state, saveCreds } = authState;
            let version = [2, 3000, 1043857760];
            try {
                const fetched = await (0, baileys_1.fetchLatestBaileysVersion)();
                if (fetched?.version) {
                    version = fetched.version;
                }
            }
            catch (e) {
                console.warn('[Baileys] Gagal mengambil versi terbaru Baileys, menggunakan versi fallback stabil.');
            }
            this.socket = (0, baileys_1.default)({
                version,
                logger: (0, pino_1.default)({ level: 'silent' }),
                printQRInTerminal: false,
                auth: state,
                generateHighQualityLinkPreview: false,
                syncFullHistory: false,
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 60000,
                keepAliveIntervalMs: 25000,
                browser: baileys_1.Browsers.ubuntu('Chrome')
            });
            this.socket.ev.on('creds.update', saveCreds);
            this.socket.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;
                if (qr) {
                    try {
                        this.qrCode = await qrcode_1.default.toDataURL(qr);
                        this.status = 'connecting';
                        console.log('[Baileys] QR code baru berhasil di-generate.');
                        this.notifyConnectionChange();
                    }
                    catch (err) {
                        console.error('Error generating QR code data URL:', err);
                    }
                }
                if (connection === 'close') {
                    this.qrCode = null;
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    console.log(`[Baileys] Koneksi terputus dengan statusCode: ${statusCode}`);
                    if (statusCode === baileys_1.DisconnectReason.loggedOut || statusCode === 401 || statusCode === 403) {
                        console.log('[Baileys] Sesi telah logout / ditolak WhatsApp (401/403). Membersihkan kredensial lama...');
                        await this.cleanupSocket();
                        this.forceClearSessionsDir();
                        this.status = 'connecting';
                        this.jid = null;
                        this.phone = null;
                        this.pushName = null;
                        this.notifyConnectionChange();
                        // Auto-trigger fresh connect agar QR code baru langsung muncul di layar user tanpa stuck di logged_out
                        console.log('[Baileys] Menyiapkan inisialisasi sesi bersih untuk generate QR code...');
                        if (this.reconnectTimeout)
                            clearTimeout(this.reconnectTimeout);
                        this.reconnectTimeout = setTimeout(() => {
                            this.connect().catch((e) => console.error('[Baileys] Fresh pairing connect failed:', e));
                        }, 1000);
                        return;
                    }
                    else if (statusCode === baileys_1.DisconnectReason.restartRequired) {
                        // Error code 515: Baileys handshake required restart. Immediate reconnection without resetting auth!
                        console.log('[Baileys] Status 515 (Restart Required). Mengkoneksi ulang secara otomatis...');
                        this.status = 'connecting';
                        this.notifyConnectionChange();
                        this.reconnectTimeout = setTimeout(() => {
                            this.connect().catch((err) => console.error('[Baileys] Reconnect after 515 failed:', err));
                        }, 800);
                    }
                    else if (statusCode === baileys_1.DisconnectReason.connectionReplaced) {
                        console.warn('[Baileys] Sesi digantikan oleh koneksi WhatsApp Web lain (440). Hentikan auto-reconnect.');
                        this.status = 'disconnected';
                        this.notifyConnectionChange();
                    }
                    else {
                        this.status = 'disconnected';
                        this.notifyConnectionChange();
                        // Auto-reconnect if not explicit disconnect and not exceeded max attempts
                        if (!this.isExplicitDisconnect && this.reconnectAttempts < this.maxAutoReconnectAttempts) {
                            this.reconnectAttempts++;
                            const delay = Math.min(3000 * this.reconnectAttempts, 15000);
                            console.log(`[Baileys] Disconnected sementara. Auto-reconnecting dalam ${delay}ms (upaya ${this.reconnectAttempts}/${this.maxAutoReconnectAttempts})...`);
                            if (this.reconnectTimeout)
                                clearTimeout(this.reconnectTimeout);
                            this.reconnectTimeout = setTimeout(() => {
                                if (this.status !== 'connected' && !this.isExplicitDisconnect) {
                                    this.connect().catch((e) => console.error('[Baileys] Auto-reconnect attempt failed:', e));
                                }
                            }, delay);
                        }
                    }
                }
                else if (connection === 'open') {
                    this.reconnectAttempts = 0;
                    if (this.reconnectTimeout) {
                        clearTimeout(this.reconnectTimeout);
                        this.reconnectTimeout = null;
                    }
                    this.status = 'connected';
                    this.qrCode = null;
                    const userJid = this.socket?.user?.id || '';
                    this.jid = userJid;
                    this.phone = (0, normalizer_js_1.extractPhoneFromJid)(userJid);
                    this.pushName = this.socket?.user?.name || 'WA Blast Bot';
                    console.log(`[Baileys] WhatsApp Connected! User: ${this.phone} (${this.pushName})`);
                    this.notifyConnectionChange();
                }
            });
            // Handle incoming messages
            this.socket.ev.on('messages.upsert', async ({ messages, type }) => {
                if (type !== 'notify')
                    return;
                for (const msg of messages) {
                    if (!msg.message || msg.key.fromMe)
                        continue;
                    const fromJid = msg.key.remoteJid || '';
                    const isGroup = fromJid.endsWith('@g.us');
                    const senderPhone = (0, normalizer_js_1.extractPhoneFromJid)(msg.key.participant || fromJid);
                    const pushName = msg.pushName || senderPhone;
                    let messageType = 'unknown';
                    let text;
                    let caption;
                    let mediaBuffer;
                    let fileName;
                    let mimetype;
                    if (msg.message.conversation) {
                        messageType = 'text';
                        text = msg.message.conversation;
                    }
                    else if (msg.message.extendedTextMessage) {
                        messageType = 'text';
                        text = msg.message.extendedTextMessage.text || '';
                    }
                    else if (msg.message.imageMessage) {
                        messageType = 'image';
                        caption = msg.message.imageMessage.caption || '';
                        mimetype = msg.message.imageMessage.mimetype || 'image/jpeg';
                        try {
                            mediaBuffer = (await (0, baileys_1.downloadMediaMessage)(msg, 'buffer', {}));
                        }
                        catch (err) {
                            console.error('Failed to download incoming image:', err);
                        }
                    }
                    else if (msg.message.documentMessage) {
                        messageType = 'document';
                        caption = msg.message.documentMessage.caption || '';
                        fileName = msg.message.documentMessage.fileName || 'file.bin';
                        mimetype = msg.message.documentMessage.mimetype || 'application/octet-stream';
                        try {
                            mediaBuffer = (await (0, baileys_1.downloadMediaMessage)(msg, 'buffer', {}));
                        }
                        catch (err) {
                            console.error('Failed to download incoming document:', err);
                        }
                    }
                    const incomingPayload = {
                        fromJid,
                        senderPhone,
                        pushName,
                        isGroup,
                        messageType,
                        text: text || caption,
                        caption,
                        mediaBuffer,
                        fileName,
                        mimetype,
                        rawMessage: msg
                    };
                    for (const handler of this.incomingHandlers) {
                        try {
                            await handler(incomingPayload);
                        }
                        catch (err) {
                            console.error('Error in message handler:', err);
                        }
                    }
                }
            });
        }
        catch (err) {
            this.status = 'disconnected';
            this.notifyConnectionChange();
            console.error('[Baileys] Connect error:', err);
            throw err;
        }
    }
    async disconnect() {
        this.isExplicitDisconnect = true;
        await this.cleanupSocket();
        this.status = 'disconnected';
        this.qrCode = null;
        this.notifyConnectionChange();
    }
    async logout() {
        this.isExplicitDisconnect = true;
        if (this.socket) {
            try {
                await this.socket.logout();
            }
            catch (e) {
                console.error('Error during Baileys logout:', e);
            }
        }
        await this.cleanupSocket();
        this.status = 'logged_out';
        this.qrCode = null;
        this.jid = null;
        this.phone = null;
        this.pushName = null;
        this.notifyConnectionChange();
        try {
            if (fs_1.default.existsSync(index_js_1.config.storage.sessionsDir)) {
                fs_1.default.rmSync(index_js_1.config.storage.sessionsDir, { recursive: true, force: true });
                fs_1.default.mkdirSync(index_js_1.config.storage.sessionsDir, { recursive: true });
            }
        }
        catch (e) {
            console.error('Failed to clean sessions directory:', e);
        }
    }
    async resetSession() {
        this.isExplicitDisconnect = true;
        this.reconnectAttempts = 0;
        await this.cleanupSocket();
        this.status = 'disconnected';
        this.qrCode = null;
        this.jid = null;
        this.phone = null;
        this.pushName = null;
        this.forceClearSessionsDir();
        this.notifyConnectionChange();
    }
    async reconnect() {
        console.log('[Baileys] Menjalankan reconnect / koneksi ulang...');
        this.reconnectAttempts = 0;
        this.isExplicitDisconnect = false;
        await this.cleanupSocket();
        // Tunggu sejenak agar socket dilepas oleh sistem operasi
        await new Promise((res) => setTimeout(res, 500));
        await this.connect();
    }
    async sendTextMessage(toPhone, text) {
        if (!this.socket || this.status !== 'connected') {
            return { success: false, messageId: '', error: 'WhatsApp tidak terhubung' };
        }
        const jid = (0, normalizer_js_1.formatToWhatsAppJid)(toPhone);
        if (!jid) {
            return { success: false, messageId: '', error: 'Format nomor telepon tidak valid' };
        }
        try {
            const sent = await this.socket.sendMessage(jid, { text });
            return {
                success: true,
                messageId: sent?.key?.id || `msg_${Date.now()}`,
                timestamp: Date.now()
            };
        }
        catch (err) {
            return {
                success: false,
                messageId: '',
                error: err.message || 'Gagal mengirim pesan WhatsApp'
            };
        }
    }
    async sendImageMessage(toPhone, imagePath, caption) {
        if (!this.socket || this.status !== 'connected') {
            return { success: false, messageId: '', error: 'WhatsApp tidak terhubung' };
        }
        const jid = (0, normalizer_js_1.formatToWhatsAppJid)(toPhone);
        if (!jid) {
            return { success: false, messageId: '', error: 'Format nomor telepon tidak valid' };
        }
        if (!fs_1.default.existsSync(imagePath)) {
            return { success: false, messageId: '', error: 'File gambar tidak ditemukan di server' };
        }
        try {
            const buffer = fs_1.default.readFileSync(imagePath);
            const sent = await this.socket.sendMessage(jid, {
                image: buffer,
                caption: caption || undefined
            });
            return {
                success: true,
                messageId: sent?.key?.id || `msg_${Date.now()}`,
                timestamp: Date.now()
            };
        }
        catch (err) {
            return {
                success: false,
                messageId: '',
                error: err.message || 'Gagal mengirim gambar WhatsApp'
            };
        }
    }
}
exports.BaileysAdapter = BaileysAdapter;
