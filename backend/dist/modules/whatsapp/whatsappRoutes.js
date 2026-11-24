"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const baileysService_js_1 = require("./baileysService.js");
const auth_js_1 = require("../../middleware/auth.js");
const logger_js_1 = require("../../utils/logger.js");
const router = (0, express_1.Router)();
// Require auth for all WhatsApp endpoints
router.use(auth_js_1.authenticate);
// GET /api/whatsapp/status
router.get('/status', async (req, res) => {
    const info = baileysService_js_1.whatsappService.getAccountInfo();
    res.json({
        success: true,
        data: info
    });
});
// POST /api/whatsapp/connect
router.post('/connect', (0, auth_js_1.requireRole)(['Super Admin', 'Operator']), async (req, res) => {
    try {
        await baileysService_js_1.whatsappService.connect();
        await (0, logger_js_1.logAudit)(req.user.id, 'WA_CONNECT', 'whatsapp', {}, req.ip);
        res.json({ success: true, message: 'Menghubungkan WhatsApp...' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: `Gagal menghubungkan: ${err.message}` });
    }
});
// POST /api/whatsapp/disconnect
router.post('/disconnect', (0, auth_js_1.requireRole)(['Super Admin', 'Operator']), async (req, res) => {
    try {
        await baileysService_js_1.whatsappService.disconnect();
        await (0, logger_js_1.logAudit)(req.user.id, 'WA_DISCONNECT', 'whatsapp', {}, req.ip);
        res.json({ success: true, message: 'WhatsApp diputuskan.' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: `Gagal memutuskan: ${err.message}` });
    }
});
// POST /api/whatsapp/logout
router.post('/logout', (0, auth_js_1.requireRole)(['Super Admin']), async (req, res) => {
    try {
        await baileysService_js_1.whatsappService.logout();
        await (0, logger_js_1.logAudit)(req.user.id, 'WA_LOGOUT', 'whatsapp', {}, req.ip);
        res.json({ success: true, message: 'Sesi WhatsApp berhasil dikeluarkan (logged out).' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: `Gagal logout: ${err.message}` });
    }
});
// POST /api/whatsapp/restart
router.post('/restart', (0, auth_js_1.requireRole)(['Super Admin', 'Operator']), async (req, res) => {
    try {
        await baileysService_js_1.whatsappService.reconnect();
        await (0, logger_js_1.logAudit)(req.user.id, 'WA_RESTART', 'whatsapp', {}, req.ip);
        res.json({ success: true, message: 'Koneksi WhatsApp direstart.' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: `Gagal restart: ${err.message}` });
    }
});
// POST /api/whatsapp/reconnect
router.post('/reconnect', (0, auth_js_1.requireRole)(['Super Admin', 'Operator']), async (req, res) => {
    try {
        await baileysService_js_1.whatsappService.reconnect();
        await (0, logger_js_1.logAudit)(req.user.id, 'WA_RECONNECT', 'whatsapp', {}, req.ip);
        res.json({ success: true, message: 'Mengkoneksi ulang WhatsApp...' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: `Gagal mengkoneksi ulang: ${err.message}` });
    }
});
// POST /api/whatsapp/reset-session
router.post('/reset-session', (0, auth_js_1.requireRole)(['Super Admin', 'Operator']), async (req, res) => {
    try {
        await baileysService_js_1.whatsappService.resetSession();
        await (0, logger_js_1.logAudit)(req.user.id, 'WA_RESET_SESSION', 'whatsapp', {}, req.ip);
        res.json({
            success: true,
            message: 'Sesi WhatsApp berhasil direset total. Berkas kredensial dihapus. Silakan hubungkan kembali untuk scan QR baru.'
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: `Gagal reset sesi: ${err.message}` });
    }
});
// POST /api/whatsapp/send-direct
router.post('/send-direct', (0, auth_js_1.requireRole)(['Super Admin', 'Operator']), async (req, res) => {
    const { phone, message, imagePath, caption } = req.body;
    if (!phone || (!message && !imagePath)) {
        res.status(400).json({ success: false, message: 'Nomor telepon dan pesan wajib diisi.' });
        return;
    }
    try {
        let result;
        if (imagePath) {
            result = await baileysService_js_1.whatsappService.sendImageMessage(phone, imagePath, caption || message);
        }
        else {
            result = await baileysService_js_1.whatsappService.sendTextMessage(phone, message);
        }
        if (result.success) {
            await (0, logger_js_1.logAudit)(req.user.id, 'WA_SEND_DIRECT', 'whatsapp', { phone }, req.ip);
            res.json({ success: true, message: `Pesan berhasil dikirim ke ${phone}`, messageId: result.messageId });
        }
        else {
            res.status(500).json({ success: false, message: result.error || 'Gagal mengirim pesan WhatsApp' });
        }
    }
    catch (err) {
        res.status(500).json({ success: false, message: `Error: ${err.message}` });
    }
});
exports.default = router;
