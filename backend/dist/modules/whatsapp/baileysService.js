"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappService = void 0;
const baileysAdapter_js_1 = require("./baileysAdapter.js");
const mockAdapter_js_1 = require("./mockAdapter.js");
const index_js_1 = require("../../database/index.js");
const logger_js_1 = require("../../utils/logger.js");
const logger_js_2 = require("../../utils/logger.js");
class WhatsAppService {
    adapter;
    isMockMode = false;
    initialized = false;
    incomingMessageHandlers = [];
    constructor() {
        // Check if running in mock/test mode
        if (process.env.WA_USE_MOCK === 'true' || process.env.NODE_ENV === 'test') {
            this.adapter = new mockAdapter_js_1.MockWhatsAppAdapter();
            this.isMockMode = true;
        }
        else {
            this.adapter = new baileysAdapter_js_1.BaileysAdapter();
        }
    }
    setAdapter(adapter) {
        this.adapter = adapter;
        this.setupListeners();
        for (const h of this.incomingMessageHandlers) {
            this.adapter.onIncomingMessage(h);
        }
    }
    getAdapter() {
        return this.adapter;
    }
    async init() {
        if (this.initialized)
            return;
        await this.adapter.init();
        this.setupListeners();
        this.initialized = true;
        // Check if session was previously active in DB and attempt reconnection
        try {
            const activeSession = await index_js_1.db.getOne('SELECT id, status, is_active FROM whatsapp_sessions WHERE session_name = ?', ['default']);
            if (activeSession && activeSession.status === 'connected' && activeSession.is_active === 1) {
                (0, logger_js_1.logSystem)('INFO', 'WHATSAPP', 'Sesi sebelumnya terdeteksi aktif. Menyambungkan kembali...');
                this.connect().catch((err) => {
                    (0, logger_js_1.logSystem)('WARNING', 'WHATSAPP', `Gagal menghubungkan sesi tersimpan: ${err.message}`);
                });
            }
        }
        catch (e) {
            // Ignore DB error during initial bootstrap
        }
    }
    setupListeners() {
        this.adapter.onConnectionChange(async (info) => {
            await this.handleConnectionChange(info);
        });
    }
    async handleConnectionChange(info) {
        const io = (0, logger_js_2.getSocketIO)();
        if (io) {
            io.emit('wa:status', {
                status: info.status,
                phone: info.phone,
                name: info.name,
                qrCode: info.qrCode
            });
        }
        try {
            const existing = await index_js_1.db.getOne('SELECT id FROM whatsapp_sessions WHERE session_name = ?', ['default']);
            if (existing) {
                await index_js_1.db.execute(`UPDATE whatsapp_sessions SET 
             phone_number = ?, 
             push_name = ?, 
             status = ?, 
             qr_code = ?, 
             last_connected_at = CASE WHEN ? = 'connected' THEN CURRENT_TIMESTAMP ELSE last_connected_at END,
             updated_at = CURRENT_TIMESTAMP
           WHERE session_name = ?`, [info.phone, info.name, info.status, info.qrCode, info.status, 'default']);
            }
            else {
                await index_js_1.db.execute(`INSERT INTO whatsapp_sessions (session_name, phone_number, push_name, status, qr_code, is_active) 
           VALUES (?, ?, ?, ?, ?, 1)`, ['default', info.phone, info.name, info.status, info.qrCode]);
            }
        }
        catch (err) {
            console.error('Failed to update whatsapp_sessions in DB:', err);
        }
        if (info.status === 'connected') {
            await (0, logger_js_1.logSystem)('SUCCESS', 'WHATSAPP', `WhatsApp Terhubung: ${info.phone} (${info.name})`);
            this.notifyAdmins(`🟢 *NOTIFIKASI SISTEM*\n\nWhatsApp Bot berhasil TERHUBUNG!\nNomor: ${info.phone}\nNama: ${info.name}\nWaktu: ${new Date().toLocaleString('id-ID')}`);
        }
        else if (info.status === 'disconnected') {
            await (0, logger_js_1.logSystem)('WARNING', 'WHATSAPP', 'WhatsApp Terputus sementara.');
        }
        else if (info.status === 'logged_out') {
            await (0, logger_js_1.logSystem)('ERROR', 'WHATSAPP', 'Sesi WhatsApp telah Logout. Silakan scan ulang QR.');
            this.notifyAdmins(`🔴 *NOTIFIKASI SISTEM*\n\nSesi WhatsApp telah KELUAR / LOGOUT.\nSilakan buka dashboard website dan scan ulang QR code.`);
        }
    }
    async notifyAdmins(messageText) {
        try {
            const admins = await index_js_1.db.query('SELECT phone_number, notify_on_events FROM whatsapp_admins WHERE is_active = 1 AND notify_on_events = 1');
            for (const admin of admins) {
                await this.adapter.sendTextMessage(admin.phone_number, messageText);
                await index_js_1.db.execute('INSERT INTO notification_logs (admin_phone, event_type, message, status) VALUES (?, ?, ?, ?)', [admin.phone_number, 'SYSTEM_ALERT', messageText, 'sent']);
            }
        }
        catch (err) {
            console.error('Failed to notify admins:', err);
        }
    }
    async connect() {
        await (0, logger_js_1.logSystem)('INFO', 'WHATSAPP', 'Memulai koneksi WhatsApp...');
        await this.adapter.connect();
    }
    async disconnect() {
        await (0, logger_js_1.logSystem)('INFO', 'WHATSAPP', 'Memutuskan koneksi WhatsApp...');
        await this.adapter.disconnect();
    }
    async logout() {
        await (0, logger_js_1.logSystem)('WARNING', 'WHATSAPP', 'Mengeluarkan sesi WhatsApp (Logout)...');
        await this.adapter.logout();
    }
    async resetSession() {
        await (0, logger_js_1.logSystem)('WARNING', 'WHATSAPP', 'Mereset sesi WhatsApp & membersihkan berkas autentikasi...');
        await this.adapter.resetSession();
        try {
            await index_js_1.db.execute(`UPDATE whatsapp_sessions SET 
           phone_number = NULL, 
           push_name = NULL, 
           status = 'disconnected', 
           qr_code = NULL, 
           is_active = 0,
           updated_at = CURRENT_TIMESTAMP
         WHERE session_name = ?`, ['default']);
        }
        catch (err) {
            console.error('Failed to reset session in DB:', err);
        }
        const io = (0, logger_js_2.getSocketIO)();
        if (io) {
            io.emit('wa:status', {
                status: 'disconnected',
                phone: null,
                name: null,
                qrCode: null
            });
        }
        await (0, logger_js_1.logSystem)('SUCCESS', 'WHATSAPP', 'Sesi WhatsApp berhasil direset total.');
    }
    async reconnect() {
        await (0, logger_js_1.logSystem)('INFO', 'WHATSAPP', 'Memulai koneksi ulang WhatsApp...');
        await this.adapter.reconnect();
    }
    getAccountInfo() {
        return this.adapter.getAccountInfo();
    }
    async sendTextMessage(toPhone, text) {
        return this.adapter.sendTextMessage(toPhone, text);
    }
    async sendImageMessage(toPhone, imagePath, caption) {
        return this.adapter.sendImageMessage(toPhone, imagePath, caption);
    }
    onIncomingMessage(handler) {
        this.incomingMessageHandlers.push(handler);
        this.adapter.onIncomingMessage(handler);
    }
}
exports.whatsappService = new WhatsAppService();
