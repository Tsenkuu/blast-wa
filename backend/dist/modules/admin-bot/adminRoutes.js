"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_js_1 = require("../../database/index.js");
const normalizer_js_1 = require("../../utils/normalizer.js");
const auth_js_1 = require("../../middleware/auth.js");
const logger_js_1 = require("../../utils/logger.js");
const router = (0, express_1.Router)();
router.use(auth_js_1.authenticate);
// GET /api/admins
router.get('/', async (req, res) => {
    const admins = await index_js_1.db.query('SELECT * FROM whatsapp_admins ORDER BY id ASC');
    res.json({ success: true, data: admins });
});
// POST /api/admins
router.post('/', (0, auth_js_1.requireRole)(['Super Admin']), async (req, res) => {
    const { phoneNumber, name, canBroadcast, canManageExcel, canManageSessions, notifyOnEvents } = req.body;
    if (!phoneNumber || !name) {
        res.status(400).json({ success: false, message: 'Nomor telepon dan nama admin wajib diisi.' });
        return;
    }
    const norm = (0, normalizer_js_1.normalizePhoneNumber)(phoneNumber);
    if (!norm.isValid) {
        res.status(400).json({ success: false, message: `Nomor telepon tidak valid: ${norm.errorMessage}` });
        return;
    }
    const existing = await index_js_1.db.getOne('SELECT id FROM whatsapp_admins WHERE phone_number = ?', [norm.normalized]);
    if (existing) {
        res.status(400).json({ success: false, message: 'Nomor WhatsApp admin ini sudah terdaftar.' });
        return;
    }
    const result = await index_js_1.db.execute(`INSERT INTO whatsapp_admins (phone_number, name, can_broadcast, can_manage_excel, can_manage_sessions, notify_on_events, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`, [
        norm.normalized,
        name,
        canBroadcast !== undefined ? (canBroadcast ? 1 : 0) : 1,
        canManageExcel !== undefined ? (canManageExcel ? 1 : 0) : 1,
        canManageSessions !== undefined ? (canManageSessions ? 1 : 0) : 0,
        notifyOnEvents !== undefined ? (notifyOnEvents ? 1 : 0) : 1
    ]);
    await (0, logger_js_1.logAudit)(req.user.id, 'ADMIN_ADD', 'whatsapp_admins', { phone: norm.normalized, name }, req.ip);
    res.json({ success: true, message: 'WhatsApp Admin berhasil ditambahkan.', data: { id: result.insertId } });
});
// PUT /api/admins/:id
router.put('/:id', (0, auth_js_1.requireRole)(['Super Admin']), async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const { name, canBroadcast, canManageExcel, canManageSessions, notifyOnEvents, isActive } = req.body;
    await index_js_1.db.execute(`UPDATE whatsapp_admins 
     SET name = COALESCE(?, name),
         can_broadcast = COALESCE(?, can_broadcast),
         can_manage_excel = COALESCE(?, can_manage_excel),
         can_manage_sessions = COALESCE(?, can_manage_sessions),
         notify_on_events = COALESCE(?, notify_on_events),
         is_active = COALESCE(?, is_active),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`, [
        name,
        canBroadcast !== undefined ? (canBroadcast ? 1 : 0) : null,
        canManageExcel !== undefined ? (canManageExcel ? 1 : 0) : null,
        canManageSessions !== undefined ? (canManageSessions ? 1 : 0) : null,
        notifyOnEvents !== undefined ? (notifyOnEvents ? 1 : 0) : null,
        isActive !== undefined ? (isActive ? 1 : 0) : null,
        id
    ]);
    await (0, logger_js_1.logAudit)(req.user.id, 'ADMIN_UPDATE', 'whatsapp_admins', { id }, req.ip);
    res.json({ success: true, message: 'Pengaturan WhatsApp Admin diperbarui.' });
});
// DELETE /api/admins/:id
router.delete('/:id', (0, auth_js_1.requireRole)(['Super Admin']), async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    await index_js_1.db.execute('DELETE FROM whatsapp_admins WHERE id = ?', [id]);
    await (0, logger_js_1.logAudit)(req.user.id, 'ADMIN_DELETE', 'whatsapp_admins', { id }, req.ip);
    res.json({ success: true, message: 'WhatsApp Admin berhasil dihapus.' });
});
exports.default = router;
