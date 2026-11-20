import { Router, Request, Response } from 'express';
import fs from 'fs';
import { db } from '../../database/index.js';
import { ExcelService } from './excelService.js';
import { uploadExcel } from '../../middleware/upload.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { logAudit } from '../../utils/logger.js';

const router = Router();
router.use(authenticate);

// GET /api/excel/datasets
router.get('/datasets', async (req: Request, res: Response) => {
  const datasets = await db.query(
    `SELECT d.*, 
       (SELECT COUNT(*) FROM contacts WHERE dataset_id = d.id) as contact_count,
       (SELECT COUNT(*) FROM broadcasts WHERE dataset_id = d.id) as used_in_broadcasts
     FROM contact_datasets d 
     ORDER BY d.id DESC`
  );
  res.json({ success: true, data: datasets });
});

// POST /api/excel/preview
router.post('/preview', uploadExcel.single('file'), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ success: false, message: 'Harap sertakan file Excel (.xlsx atau .xls)' });
    return;
  }

  try {
    const parseResult = await ExcelService.parseExcelFile(req.file.path);
    // Cleanup temporary file after preview
    fs.unlink(req.file.path, () => {});

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
  } catch (err: any) {
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ success: false, message: `Gagal membaca file Excel: ${err.message}` });
  }
});

// POST /api/excel/import
router.post('/import', uploadExcel.single('file'), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ success: false, message: 'Harap sertakan file Excel' });
    return;
  }

  const datasetName = (req.body.name || '').trim();
  if (!datasetName) {
    fs.unlink(req.file.path, () => {});
    res.status(400).json({ success: false, message: 'Nama dataset wajib diisi.' });
    return;
  }

  try {
    const mapping = {
      phoneCol: req.body.phoneCol,
      nameCol: req.body.nameCol,
      notesCol: req.body.notesCol
    };

    const parseResult = await ExcelService.parseExcelFile(req.file.path, 1, mapping);
    const saveResult = await ExcelService.saveDatasetToDb(
      datasetName,
      req.file.originalname,
      parseResult,
      req.user!.username
    );

    // Keep file or delete temporary file
    fs.unlink(req.file.path, () => {});

    await logAudit(req.user!.id, 'EXCEL_IMPORT', 'contact_datasets', {
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
  } catch (err: any) {
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ success: false, message: `Gagal mengimpor Excel: ${err.message}` });
  }
});

// GET /api/excel/datasets/:id
router.get('/datasets/:id', async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const dataset = await db.getOne('SELECT * FROM contact_datasets WHERE id = ?', [id]);
  if (!dataset) {
    res.status(404).json({ success: false, message: 'Dataset tidak ditemukan.' });
    return;
  }

  const columns = await db.query('SELECT * FROM dataset_columns WHERE dataset_id = ? ORDER BY id ASC', [id]);
  const page = parseInt(req.query.page as string || '1', 10);
  const limit = parseInt(req.query.limit as string || '50', 10);
  const offset = (page - 1) * limit;

  const contacts = await db.query(
    'SELECT * FROM contacts WHERE dataset_id = ? ORDER BY id ASC LIMIT ? OFFSET ?',
    [id, limit, offset]
  );

  const totalContacts = await db.getOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM contacts WHERE dataset_id = ?',
    [id]
  );

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
router.put('/datasets/:id', async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ success: false, message: 'Nama baru dataset wajib diisi.' });
    return;
  }

  await db.execute('UPDATE contact_datasets SET name = ? WHERE id = ?', [name, id]);
  await logAudit(req.user!.id, 'EXCEL_RENAME', 'contact_datasets', { id, newName: name }, req.ip);
  res.json({ success: true, message: 'Nama dataset berhasil diperbarui.' });
});

// DELETE /api/excel/datasets/:id
router.delete('/datasets/:id', requireRole(['Super Admin']), async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);

  // Check if used in active broadcast
  const used = await db.getOne(
    `SELECT id FROM broadcasts WHERE dataset_id = ? AND status IN ('running', 'queued')`,
    [id]
  );
  if (used) {
    res.status(400).json({
      success: false,
      message: 'Dataset tidak dapat dihapus karena sedang digunakan dalam broadcast yang aktif.'
    });
    return;
  }

  await db.execute('DELETE FROM contacts WHERE dataset_id = ?', [id]);
  await db.execute('DELETE FROM dataset_columns WHERE dataset_id = ?', [id]);
  await db.execute('DELETE FROM contact_datasets WHERE id = ?', [id]);

  await logAudit(req.user!.id, 'EXCEL_DELETE', 'contact_datasets', { id }, req.ip);
  res.json({ success: true, message: 'Dataset berhasil dihapus.' });
});

export default router;
