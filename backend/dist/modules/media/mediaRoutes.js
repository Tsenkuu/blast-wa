"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fs_1 = __importDefault(require("fs"));
const index_js_1 = require("../../database/index.js");
const upload_js_1 = require("../../middleware/upload.js");
const auth_js_1 = require("../../middleware/auth.js");
const logger_js_1 = require("../../utils/logger.js");
const router = (0, express_1.Router)();
router.use(auth_js_1.authenticate);
// GET /api/media
router.get('/', async (req, res) => {
    const media = await index_js_1.db.query('SELECT * FROM media_files ORDER BY id DESC');
    res.json({ success: true, data: media });
});
// POST /api/media/upload
router.post('/upload', upload_js_1.uploadMedia.single('file'), async (req, res) => {
    if (!req.file) {
        res.status(400).json({ success: false, message: 'Harap sertakan file gambar (JPG, PNG, WebP).' });
        return;
    }
    try {
        const result = await index_js_1.db.execute(`INSERT INTO media_files (filename, original_name, mime_type, file_size, storage_path)
       VALUES (?, ?, ?, ?, ?)`, [
            req.file.filename,
            req.file.originalname,
            req.file.mimetype,
            req.file.size,
            req.file.path
        ]);
        await (0, logger_js_1.logAudit)(req.user.id, 'MEDIA_UPLOAD', 'media_files', { id: result.insertId, filename: req.file.filename }, req.ip);
        res.json({
            success: true,
            message: 'Gambar berhasil diupload.',
            data: {
                id: result.insertId,
                filename: req.file.filename,
                url: `/uploads/${req.file.filename}`
            }
        });
    }
    catch (err) {
        if (req.file)
            fs_1.default.unlink(req.file.path, () => { });
        res.status(500).json({ success: false, message: `Gagal menyimpan media: ${err.message}` });
    }
});
// DELETE /api/media/:id
router.delete('/:id', async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const media = await index_js_1.db.getOne('SELECT storage_path FROM media_files WHERE id = ?', [id]);
    if (!media) {
        res.status(404).json({ success: false, message: 'Media tidak ditemukan.' });
        return;
    }
    // Remove file from disk
    if (fs_1.default.existsSync(media.storage_path)) {
        fs_1.default.unlink(media.storage_path, () => { });
    }
    await index_js_1.db.execute('DELETE FROM media_files WHERE id = ?', [id]);
    await (0, logger_js_1.logAudit)(req.user.id, 'MEDIA_DELETE', 'media_files', { id }, req.ip);
    res.json({ success: true, message: 'Media berhasil dihapus.' });
});
exports.default = router;
