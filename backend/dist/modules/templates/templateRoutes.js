"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_js_1 = require("../../database/index.js");
const auth_js_1 = require("../../middleware/auth.js");
const logger_js_1 = require("../../utils/logger.js");
const router = (0, express_1.Router)();
router.use(auth_js_1.authenticate);
// GET /api/templates
router.get('/', async (req, res) => {
    const templates = await index_js_1.db.query(`SELECT t.*, m.filename as media_filename 
     FROM message_templates t 
     LEFT JOIN media_files m ON t.default_media_id = m.id 
     ORDER BY t.id DESC`);
    res.json({ success: true, data: templates });
});
// POST /api/templates
router.post('/', async (req, res) => {
    const { name, content, defaultMediaId } = req.body;
    if (!name || !content) {
        res.status(400).json({ success: false, message: 'Nama dan Isi Template wajib diisi.' });
        return;
    }
    const hasMedia = defaultMediaId ? 1 : 0;
    const result = await index_js_1.db.execute('INSERT INTO message_templates (name, content, has_media, default_media_id, created_by) VALUES (?, ?, ?, ?, ?)', [name, content, hasMedia, defaultMediaId || null, req.user.id]);
    await (0, logger_js_1.logAudit)(req.user.id, 'TEMPLATE_CREATE', 'message_templates', { id: result.insertId, name }, req.ip);
    res.json({ success: true, message: 'Template berhasil disimpan.', data: { id: result.insertId } });
});
// PUT /api/templates/:id
router.put('/:id', async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const { name, content, defaultMediaId } = req.body;
    if (!name || !content) {
        res.status(400).json({ success: false, message: 'Nama dan Isi Template wajib diisi.' });
        return;
    }
    const hasMedia = defaultMediaId ? 1 : 0;
    await index_js_1.db.execute('UPDATE message_templates SET name = ?, content = ?, has_media = ?, default_media_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [name, content, hasMedia, defaultMediaId || null, id]);
    await (0, logger_js_1.logAudit)(req.user.id, 'TEMPLATE_UPDATE', 'message_templates', { id, name }, req.ip);
    res.json({ success: true, message: 'Template berhasil diperbarui.' });
});
// DELETE /api/templates/:id
router.delete('/:id', async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    await index_js_1.db.execute('DELETE FROM message_templates WHERE id = ?', [id]);
    await (0, logger_js_1.logAudit)(req.user.id, 'TEMPLATE_DELETE', 'message_templates', { id }, req.ip);
    res.json({ success: true, message: 'Template berhasil dihapus.' });
});
exports.default = router;
