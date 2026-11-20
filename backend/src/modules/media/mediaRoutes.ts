import { Router, Request, Response } from 'express';
import fs from 'fs';
import { db } from '../../database/index.js';
import { uploadMedia } from '../../middleware/upload.js';
import { authenticate } from '../../middleware/auth.js';
import { logAudit } from '../../utils/logger.js';

const router = Router();
router.use(authenticate);

// GET /api/media
router.get('/', async (req: Request, res: Response) => {
  const media = await db.query('SELECT * FROM media_files ORDER BY id DESC');
  res.json({ success: true, data: media });
});

// POST /api/media/upload
router.post('/upload', uploadMedia.single('file'), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ success: false, message: 'Harap sertakan file gambar (JPG, PNG, WebP).' });
    return;
  }

  try {
    const result = await db.execute(
      `INSERT INTO media_files (filename, original_name, mime_type, file_size, storage_path)
       VALUES (?, ?, ?, ?, ?)`,
      [
        req.file.filename,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        req.file.path
      ]
    );

    await logAudit(req.user!.id, 'MEDIA_UPLOAD', 'media_files', { id: result.insertId, filename: req.file.filename }, req.ip);

    res.json({
      success: true,
      message: 'Gambar berhasil diupload.',
      data: {
        id: result.insertId,
        filename: req.file.filename,
        url: `/uploads/${req.file.filename}`
      }
    });
  } catch (err: any) {
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ success: false, message: `Gagal menyimpan media: ${err.message}` });
  }
});

// DELETE /api/media/:id
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const media = await db.getOne<{ storage_path: string }>('SELECT storage_path FROM media_files WHERE id = ?', [id]);
  if (!media) {
    res.status(404).json({ success: false, message: 'Media tidak ditemukan.' });
    return;
  }

  // Remove file from disk
  if (fs.existsSync(media.storage_path)) {
    fs.unlink(media.storage_path, () => {});
  }

  await db.execute('DELETE FROM media_files WHERE id = ?', [id]);
  await logAudit(req.user!.id, 'MEDIA_DELETE', 'media_files', { id }, req.ip);
  res.json({ success: true, message: 'Media berhasil dihapus.' });
});

export default router;
