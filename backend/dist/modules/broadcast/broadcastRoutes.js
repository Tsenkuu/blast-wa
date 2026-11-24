"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_js_1 = require("../../database/index.js");
const broadcastQueueWorker_js_1 = require("./broadcastQueueWorker.js");
const baileysService_js_1 = require("../whatsapp/baileysService.js");
const templateEngine_js_1 = require("../../utils/templateEngine.js");
const auth_js_1 = require("../../middleware/auth.js");
const logger_js_1 = require("../../utils/logger.js");
const router = (0, express_1.Router)();
router.use(auth_js_1.authenticate);
// GET /api/broadcasts
router.get('/', async (req, res) => {
    const statusFilter = req.query.status;
    let sql = `
    SELECT b.*, d.name as dataset_name, m.filename as media_filename
    FROM broadcasts b
    LEFT JOIN contact_datasets d ON b.dataset_id = d.id
    LEFT JOIN media_files m ON b.media_id = m.id
  `;
    const params = [];
    if (statusFilter && statusFilter !== 'all') {
        sql += ` WHERE b.status = ?`;
        params.push(statusFilter);
    }
    sql += ` ORDER BY b.id DESC`;
    const broadcasts = await index_js_1.db.query(sql, params);
    res.json({ success: true, data: broadcasts });
});
// GET /api/broadcasts/:id
router.get('/:id', async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const broadcast = await index_js_1.db.getOne(`SELECT b.*, d.name as dataset_name, m.filename as media_filename, m.storage_path as media_path
     FROM broadcasts b
     LEFT JOIN contact_datasets d ON b.dataset_id = d.id
     LEFT JOIN media_files m ON b.media_id = m.id
     WHERE b.id = ?`, [id]);
    if (!broadcast) {
        res.status(404).json({ success: false, message: 'Broadcast tidak ditemukan.' });
        return;
    }
    res.json({ success: true, data: broadcast });
});
// POST /api/broadcasts (create and queue)
router.post('/', async (req, res) => {
    const { name, datasetId, templateId, customMessage, mediaId, scheduledAt, delaySeconds } = req.body;
    if (!name || !datasetId || !customMessage) {
        res.status(400).json({ success: false, message: 'Nama, Dataset, dan Isi Pesan wajib diisi.' });
        return;
    }
    const safeDelay = Math.max(1, Math.min(600, parseInt(delaySeconds || '4', 10)));
    try {
        const dataset = await index_js_1.db.getOne('SELECT id, name FROM contact_datasets WHERE id = ?', [datasetId]);
        if (!dataset) {
            res.status(404).json({ success: false, message: 'Dataset tidak ditemukan.' });
            return;
        }
        const broadcastCode = `BC-${Date.now().toString(36).toUpperCase()}`;
        const initialStatus = scheduledAt ? 'queued' : 'running';
        // 1. Insert into broadcasts table
        const bRes = await index_js_1.db.execute(`INSERT INTO broadcasts (broadcast_code, name, dataset_id, template_id, custom_message, media_id, delay_seconds, status, scheduled_at, started_at, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'running' THEN CURRENT_TIMESTAMP ELSE NULL END, ?)`, [
            broadcastCode,
            name,
            datasetId,
            templateId || null,
            customMessage,
            mediaId || null,
            safeDelay,
            initialStatus,
            scheduledAt || null,
            initialStatus,
            req.user.id
        ]);
        const broadcastId = bRes.insertId;
        // 2. Fetch all valid contacts
        const contacts = await index_js_1.db.query('SELECT * FROM contacts WHERE dataset_id = ? AND is_valid = 1', [datasetId]);
        // 3. Populate recipients
        for (const c of contacts) {
            let extraData = {};
            try {
                extraData = JSON.parse(c.extra_data_json || '{}');
            }
            catch (e) {
                extraData = { A: c.phone_number, B: c.name, C: c.notes, nomor: c.phone_number, nama: c.name, keterangan: c.notes };
            }
            const resText = (0, templateEngine_js_1.resolveTemplate)(customMessage, extraData);
            const idempotencyKey = `${broadcastId}_${c.id}_${c.phone_number}`;
            await index_js_1.db.execute(`INSERT INTO broadcast_recipients (broadcast_id, contact_id, phone_number, recipient_name, personalized_message, status, idempotency_key)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`, [broadcastId, c.id, c.phone_number, c.name, resText.text, idempotencyKey]);
        }
        // 4. Update counters
        await broadcastQueueWorker_js_1.broadcastQueueWorker.syncBroadcastCounters(broadcastId);
        broadcastQueueWorker_js_1.broadcastQueueWorker.emitProgress(broadcastId);
        await (0, logger_js_1.logAudit)(req.user.id, 'BROADCAST_CREATE', 'broadcasts', {
            broadcastId,
            name,
            recipientsCount: contacts.length
        }, req.ip);
        // Trigger queue processing immediately
        broadcastQueueWorker_js_1.broadcastQueueWorker.processNextInQueue().catch((e) => console.error('Worker trigger error:', e));
        res.json({
            success: true,
            message: 'Broadcast berhasil dibuat dan dimasukkan ke antrean.',
            data: {
                broadcastId,
                broadcastCode,
                totalRecipients: contacts.length,
                status: initialStatus
            }
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: `Gagal membuat broadcast: ${err.message}` });
    }
});
// PATCH /api/broadcasts/:id/delay (Ubah jangka waktu jeda per nomor on-the-fly)
router.patch('/:id/delay', async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const { delaySeconds } = req.body;
    const safeDelay = Math.max(1, Math.min(600, parseInt(String(delaySeconds || '4'), 10)));
    try {
        await index_js_1.db.execute(`UPDATE broadcasts SET delay_seconds = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [safeDelay, id]);
        await broadcastQueueWorker_js_1.broadcastQueueWorker.syncBroadcastCounters(id);
        broadcastQueueWorker_js_1.broadcastQueueWorker.emitProgress(id);
        await (0, logger_js_1.logAudit)(req.user.id, 'BROADCAST_UPDATE_DELAY', 'broadcasts', { id, delaySeconds: safeDelay }, req.ip);
        await (0, logger_js_1.logSystem)('INFO', 'BLAST', `Jeda waktu broadcast #${id} diubah menjadi ${safeDelay} detik/pesan.`);
        res.json({
            success: true,
            message: `Jeda pengiriman broadcast #${id} berhasil diubah menjadi ${safeDelay} detik per nomor.`,
            data: { delaySeconds: safeDelay }
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: `Gagal mengubah jeda: ${err.message}` });
    }
});
// POST /api/broadcasts/:id/pause
router.post('/:id/pause', async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    await broadcastQueueWorker_js_1.broadcastQueueWorker.pauseBroadcast(id);
    await (0, logger_js_1.logAudit)(req.user.id, 'BROADCAST_PAUSE', 'broadcasts', { id }, req.ip);
    res.json({ success: true, message: 'Broadcast dijeda.' });
});
// POST /api/broadcasts/:id/resume
router.post('/:id/resume', async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    await broadcastQueueWorker_js_1.broadcastQueueWorker.resumeBroadcast(id);
    await (0, logger_js_1.logAudit)(req.user.id, 'BROADCAST_RESUME', 'broadcasts', { id }, req.ip);
    // Trigger cycle immediately
    broadcastQueueWorker_js_1.broadcastQueueWorker.processNextInQueue().catch((e) => console.error('Worker trigger error:', e));
    res.json({ success: true, message: 'Broadcast dilanjutkan.' });
});
// POST /api/broadcasts/:id/cancel
router.post('/:id/cancel', async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    await broadcastQueueWorker_js_1.broadcastQueueWorker.cancelBroadcast(id);
    await (0, logger_js_1.logAudit)(req.user.id, 'BROADCAST_CANCEL', 'broadcasts', { id }, req.ip);
    res.json({ success: true, message: 'Broadcast dibatalkan.' });
});
// POST /api/broadcasts/:id/retry-failed
router.post('/:id/retry-failed', async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const count = await broadcastQueueWorker_js_1.broadcastQueueWorker.retryFailed(id);
    await (0, logger_js_1.logAudit)(req.user.id, 'BROADCAST_RETRY', 'broadcasts', { id, count }, req.ip);
    broadcastQueueWorker_js_1.broadcastQueueWorker.processNextInQueue().catch((e) => console.error('Worker trigger error:', e));
    res.json({ success: true, message: `${count} pesan gagal dimasukkan kembali ke antrean.` });
});
// POST /api/broadcasts/:id/recipients/:recipientId/send-now (Kirim / Kirim Ulang Langsung per kontak)
router.post('/:id/recipients/:recipientId/send-now', async (req, res) => {
    const broadcastId = parseInt(String(req.params.id), 10);
    const recipientId = parseInt(String(req.params.recipientId), 10);
    const { customMessage } = req.body;
    try {
        const recipient = await index_js_1.db.getOne(`SELECT r.*, b.media_id FROM broadcast_recipients r JOIN broadcasts b ON r.broadcast_id = b.id WHERE r.id = ? AND r.broadcast_id = ?`, [recipientId, broadcastId]);
        if (!recipient) {
            res.status(404).json({ success: false, message: 'Data penerima tidak ditemukan' });
            return;
        }
        const messageToSend = customMessage || recipient.personalized_message;
        let mediaPath = null;
        if (recipient.media_id) {
            const media = await index_js_1.db.getOne(`SELECT storage_path FROM media_files WHERE id = ?`, [recipient.media_id]);
            if (media && media.storage_path) {
                mediaPath = media.storage_path;
            }
        }
        let result;
        if (mediaPath) {
            result = await baileysService_js_1.whatsappService.sendImageMessage(recipient.phone_number, mediaPath, messageToSend);
        }
        else {
            result = await baileysService_js_1.whatsappService.sendTextMessage(recipient.phone_number, messageToSend);
        }
        if (result.success) {
            await index_js_1.db.execute(`UPDATE broadcast_recipients 
         SET status = 'sent', sent_at = CURRENT_TIMESTAMP, error_reason = NULL, attempts = attempts + 1
         WHERE id = ?`, [recipientId]);
            await index_js_1.db.execute(`INSERT INTO outgoing_messages (broadcast_id, recipient_id, phone_number, message_type, content, media_path, status, baileys_message_id)
         VALUES (?, ?, ?, ?, ?, ?, 'sent', ?)`, [broadcastId, recipientId, recipient.phone_number, mediaPath ? 'image' : 'text', messageToSend, mediaPath, result.messageId]);
            await broadcastQueueWorker_js_1.broadcastQueueWorker.syncBroadcastCounters(broadcastId);
            broadcastQueueWorker_js_1.broadcastQueueWorker.emitProgress(broadcastId);
            await (0, logger_js_1.logAudit)(req.user.id, 'RECIPIENT_DIRECT_SEND', 'broadcast_recipients', { recipientId, phone: recipient.phone_number }, req.ip);
            res.json({ success: true, message: `Pesan berhasil dikirim langsung ke ${recipient.phone_number}`, messageId: result.messageId });
        }
        else {
            await index_js_1.db.execute(`UPDATE broadcast_recipients 
         SET attempts = attempts + 1, error_reason = ? 
         WHERE id = ?`, [result.error || 'Gagal kirim via WhatsApp', recipientId]);
            res.status(500).json({ success: false, message: result.error || 'Gagal mengirim pesan WhatsApp' });
        }
    }
    catch (err) {
        res.status(500).json({ success: false, message: `Error: ${err.message}` });
    }
});
// GET /api/broadcasts/:id/recipients (monitoring table with filters)
router.get('/:id/recipients', async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const statusFilter = req.query.status;
    const search = req.query.search;
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const offset = (page - 1) * limit;
    let sql = 'SELECT * FROM broadcast_recipients WHERE broadcast_id = ?';
    const params = [id];
    if (statusFilter && statusFilter !== 'all') {
        sql += ' AND status = ?';
        params.push(statusFilter);
    }
    if (search) {
        sql += ' AND (recipient_name LIKE ? OR phone_number LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
    }
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
    const totalCountRes = await index_js_1.db.getOne(countSql, params);
    sql += ' ORDER BY id ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = await index_js_1.db.query(sql, params);
    res.json({
        success: true,
        data: {
            recipients: rows,
            pagination: {
                page,
                limit,
                total: totalCountRes?.count || 0,
                totalPages: Math.ceil((totalCountRes?.count || 0) / limit)
            }
        }
    });
});
// GET /api/broadcasts/:id/export (CSV export)
router.get('/:id/export', async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const recipients = await index_js_1.db.query('SELECT phone_number, recipient_name, status, error_reason, attempts, sent_at FROM broadcast_recipients WHERE broadcast_id = ? ORDER BY id ASC', [id]);
    let csv = 'Nomor,Nama,Status,Alasan Error,Percobaan,Waktu Kirim\n';
    for (const r of recipients) {
        const safeName = (r.recipient_name || '').replace(/,/g, ' ');
        const safeError = (r.error_reason || '').replace(/,/g, ' ').replace(/\n/g, ' ');
        csv += `"${r.phone_number}","${safeName}","${r.status}","${safeError}",${r.attempts},"${r.sent_at || ''}"\n`;
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="broadcast_report_${id}.csv"`);
    res.send(csv);
});
// POST /api/broadcasts/emergency-stop (Emergency Stop button)
router.post('/emergency-stop', (0, auth_js_1.requireRole)(['Super Admin']), async (req, res) => {
    const { stop } = req.body;
    const val = stop ? '1' : '0';
    const existing = await index_js_1.db.getOne('SELECT id FROM app_settings WHERE key_name = ?', ['emergency_stop']);
    if (existing) {
        await index_js_1.db.execute('UPDATE app_settings SET value_text = ? WHERE key_name = ?', [val, 'emergency_stop']);
    }
    else {
        await index_js_1.db.execute('INSERT INTO app_settings (key_name, value_text, description) VALUES (?, ?, ?)', ['emergency_stop', val, 'Emergency stop active']);
    }
    if (stop) {
        await index_js_1.db.execute(`UPDATE broadcasts SET status = 'paused', paused_at = CURRENT_TIMESTAMP WHERE status = 'running'`);
        await (0, logger_js_1.logSystem)('ERROR', 'EMERGENCY', 'EMERGENCY STOP DIAKTIFKAN: Semua broadcast langsung dijeda!');
    }
    else {
        await (0, logger_js_1.logSystem)('INFO', 'EMERGENCY', 'Emergency stop dinonaktifkan.');
    }
    await (0, logger_js_1.logAudit)(req.user.id, 'EMERGENCY_STOP_TOGGLE', 'broadcasts', { active: stop }, req.ip);
    res.json({ success: true, message: stop ? 'Semua broadcast aktif telah dihentikan darurat!' : 'Status darurat dicabut.' });
});
exports.default = router;
