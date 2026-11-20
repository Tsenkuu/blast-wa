"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fs_1 = __importDefault(require("fs"));
const index_js_1 = require("../../database/index.js");
const excelService_js_1 = require("./excelService.js");
const upload_js_1 = require("../../middleware/upload.js");
const auth_js_1 = require("../../middleware/auth.js");
const logger_js_1 = require("../../utils/logger.js");
const router = (0, express_1.Router)();
router.use(auth_js_1.authenticate);
// GET /api/excel/datasets
router.get('/datasets', async (req, res) => {
    const datasets = await index_js_1.db.query(`SELECT d.*, 
       (SELECT COUNT(*) FROM contacts WHERE dataset_id = d.id) as contact_count,
       (SELECT COUNT(*) FROM broadcasts WHERE dataset_id = d.id) as used_in_broadcasts
     FROM contact_datasets d 
     ORDER BY d.id DESC`);
    res.json({ success: true, data: datasets });
});
// POST /api/excel/preview
router.post('/preview', upload_js_1.uploadExcel.single('file'), async (req, res) => {
    if (!req.file) {
        res.status(400).json({ success: false, message: 'Harap sertakan file Excel (.xlsx atau .xls)' });
        return;
    }
    try {
        const parseResult = await excelService_js_1.ExcelService.parseExcelFile(req.file.path);
        // Cleanup temporary file after preview
        fs_1.default.unlink(req.file.path, () => { });
        res.json({
            success: true,
            data: {
                sheetName: parseResult.sheetName,
                totalRows: parseResult.totalRows,
                validRows: parseResult.validRows,
                invalidRows: parseResult.invalidRows,
                duplicateRows: parseResult.duplicateRows,
                columns: parseResult.columns,
                sampleRows: parseResult.rows.slice(0, 10), // first 10 for preview
                invalidSampleRows: parseResult.rows.filter(r => !r.isValid).slice(0, 10)
            }
        });
    }
    catch (err) {
        if (req.file)
            fs_1.default.unlink(req.file.path, () => { });
        res.status(500).json({ success: false, message: `Gagal membaca file Excel: ${err.message}` });
    }
});
// POST /api/excel/import
router.post('/import', upload_js_1.uploadExcel.single('file'), async (req, res) => {
    if (!req.file) {
        res.status(400).json({ success: false, message: 'Harap sertakan file Excel' });
        return;
    }
    const datasetName = (req.body.name || '').trim();
    if (!datasetName) {
        fs_1.default.unlink(req.file.path, () => { });
        res.status(400).json({ success: false, message: 'Nama dataset wajib diisi.' });
        return;
    }
    try {
        const mapping = {
            phoneCol: req.body.phoneCol,
            nameCol: req.body.nameCol,
            notesCol: req.body.notesCol
        };
        const parseResult = await excelService_js_1.ExcelService.parseExcelFile(req.file.path, 1, mapping);
        const saveResult = await excelService_js_1.ExcelService.saveDatasetToDb(datasetName, req.file.originalname, parseResult, req.user.username);
        // Keep file or delete temporary file
        fs_1.default.unlink(req.file.path, () => { });
        await (0, logger_js_1.logAudit)(req.user.id, 'EXCEL_IMPORT', 'contact_datasets', {
            datasetId: saveResult.datasetId,
            name: datasetName,
            validRows: saveResult.validRows
        }, req.ip);
        res.json({
            success: true,
            message: `Dataset "${datasetName}" berhasil diimpor.`,
            data: {
                datasetId: saveResult.datasetId,
                validRows: saveResult.validRows,
                invalidRows: saveResult.invalidRows
            }
        });
    }
    catch (err) {
        if (req.file)
            fs_1.default.unlink(req.file.path, () => { });
        res.status(500).json({ success: false, message: `Gagal mengimpor Excel: ${err.message}` });
    }
});
// GET /api/excel/datasets/:id
router.get('/datasets/:id', async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const dataset = await index_js_1.db.getOne('SELECT * FROM contact_datasets WHERE id = ?', [id]);
    if (!dataset) {
        res.status(404).json({ success: false, message: 'Dataset tidak ditemukan.' });
        return;
    }
    const columns = await index_js_1.db.query('SELECT * FROM dataset_columns WHERE dataset_id = ? ORDER BY id ASC', [id]);
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '50', 10);
    const offset = (page - 1) * limit;
    const contacts = await index_js_1.db.query('SELECT * FROM contacts WHERE dataset_id = ? ORDER BY id ASC LIMIT ? OFFSET ?', [id, limit, offset]);
    const totalContacts = await index_js_1.db.getOne('SELECT COUNT(*) as count FROM contacts WHERE dataset_id = ?', [id]);
    res.json({
        success: true,
        data: {
            dataset,
            columns,
            contacts,
            pagination: {
                page,
                limit,
                total: totalContacts?.count || 0,
                totalPages: Math.ceil((totalContacts?.count || 0) / limit)
            }
        }
    });
});
// PUT /api/excel/datasets/:id (rename)
router.put('/datasets/:id', async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    const { name } = req.body;
    if (!name) {
        res.status(400).json({ success: false, message: 'Nama baru dataset wajib diisi.' });
        return;
    }
    await index_js_1.db.execute('UPDATE contact_datasets SET name = ? WHERE id = ?', [name, id]);
    await (0, logger_js_1.logAudit)(req.user.id, 'EXCEL_RENAME', 'contact_datasets', { id, newName: name }, req.ip);
    res.json({ success: true, message: 'Nama dataset berhasil diperbarui.' });
});
// DELETE /api/excel/datasets/:id
router.delete('/datasets/:id', (0, auth_js_1.requireRole)(['Super Admin']), async (req, res) => {
    const id = parseInt(String(req.params.id), 10);
    // Check if used in active broadcast
    const used = await index_js_1.db.getOne(`SELECT id FROM broadcasts WHERE dataset_id = ? AND status IN ('running', 'queued')`, [id]);
    if (used) {
        res.status(400).json({
            success: false,
            message: 'Dataset tidak dapat dihapus karena sedang digunakan dalam broadcast yang aktif.'
        });
        return;
    }
    await index_js_1.db.execute('DELETE FROM contacts WHERE dataset_id = ?', [id]);
    await index_js_1.db.execute('DELETE FROM dataset_columns WHERE dataset_id = ?', [id]);
    await index_js_1.db.execute('DELETE FROM contact_datasets WHERE id = ?', [id]);
    await (0, logger_js_1.logAudit)(req.user.id, 'EXCEL_DELETE', 'contact_datasets', { id }, req.ip);
    res.json({ success: true, message: 'Dataset berhasil dihapus.' });
});
exports.default = router;
