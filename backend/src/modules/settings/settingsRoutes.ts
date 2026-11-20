import { Router, Request, Response } from 'express';
import { db } from '../../database/index.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { logAudit } from '../../utils/logger.js';

const router = Router();
router.use(authenticate);

// GET /api/settings
router.get('/', async (req: Request, res: Response) => {
  const settings = await db.query('SELECT * FROM app_settings ORDER BY id ASC');
  const mapped: Record<string, string> = {};
  for (const s of settings) {
    mapped[s.key_name] = s.value_text;
  }
  res.json({ success: true, data: { list: settings, mapped } });
});

// PUT /api/settings
router.put('/', requireRole(['Super Admin']), async (req: Request, res: Response): Promise<void> => {
  const settings = req.body; // e.g. { min_delay_ms: "3000", max_retries: "2" }

  for (const [key, value] of Object.entries(settings)) {
    const existing = await db.getOne('SELECT id FROM app_settings WHERE key_name = ?', [key]);
    if (existing) {
      await db.execute('UPDATE app_settings SET value_text = ?, updated_at = CURRENT_TIMESTAMP WHERE key_name = ?', [String(value), key]);
    } else {
      await db.execute('INSERT INTO app_settings (key_name, value_text) VALUES (?, ?)', [key, String(value)]);
    }
  }

  await logAudit(req.user!.id, 'SETTINGS_UPDATE', 'app_settings', settings, req.ip);
  res.json({ success: true, message: 'Pengaturan berhasil diperbarui.' });
});

export default router;
