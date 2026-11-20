"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_js_1 = require("../../database/index.js");
const auth_js_1 = require("../../middleware/auth.js");
const logger_js_1 = require("../../utils/logger.js");
const router = (0, express_1.Router)();
router.use(auth_js_1.authenticate);
// GET /api/settings
router.get('/', async (req, res) => {
    const settings = await index_js_1.db.query('SELECT * FROM app_settings ORDER BY id ASC');
    const mapped = {};
    for (const s of settings) {
        mapped[s.key_name] = s.value_text;
    }
    res.json({ success: true, data: { list: settings, mapped } });
});
// PUT /api/settings
router.put('/', (0, auth_js_1.requireRole)(['Super Admin']), async (req, res) => {
    const settings = req.body; // e.g. { min_delay_ms: "3000", max_retries: "2" }
    for (const [key, value] of Object.entries(settings)) {
        const existing = await index_js_1.db.getOne('SELECT id FROM app_settings WHERE key_name = ?', [key]);
        if (existing) {
            await index_js_1.db.execute('UPDATE app_settings SET value_text = ?, updated_at = CURRENT_TIMESTAMP WHERE key_name = ?', [String(value), key]);
        }
        else {
            await index_js_1.db.execute('INSERT INTO app_settings (key_name, value_text) VALUES (?, ?)', [key, String(value)]);
        }
    }
    await (0, logger_js_1.logAudit)(req.user.id, 'SETTINGS_UPDATE', 'app_settings', settings, req.ip);
    res.json({ success: true, message: 'Pengaturan berhasil diperbarui.' });
});
exports.default = router;
