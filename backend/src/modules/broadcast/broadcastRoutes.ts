import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../../database/index.js';
import { broadcastQueueWorker } from './broadcastQueueWorker.js';
import { resolveTemplate } from '../../utils/templateEngine.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { logAudit, logSystem } from '../../utils/logger.js';

const router = Router();
router.use(authenticate);

// GET /api/broadcasts
router.get('/', async (req: Request, res: Response) => {
  const statusFilter = req.query.status as string;
  let sql = `
    SELECT b.*, d.name as dataset_name, m.filename as media_filename
    FROM broadcasts b
    LEFT JOIN contact_datasets d ON b.dataset_id = d.id
    LEFT JOIN media_files m ON b.media_id = m.id
  `;
  const params: any[] = [];

  if (statusFilter && statusFilter !== 'all') {
    sql += ` WHERE b.status = ?`;
    params.push(statusFilter);
  }

  sql += ` ORDER BY b.id DESC`;
  const broadcasts = await db.query(sql, params);
  res.json({ success: true, data: broadcasts });
});

// GET /api/broadcasts/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const broadcast = await db.getOne(
    `SELECT b.*, d.name as dataset_name, m.filename as media_filename, m.storage_path as media_path
     FROM broadcasts b
     LEFT JOIN contact_datasets d ON b.dataset_id = d.id
     LEFT JOIN media_files m ON b.media_id = m.id
     WHERE b.id = ?`,
    [id]
  );

  if (!broadcast) {
    res.status(404).json({ success: false, message: 'Broadcast tidak ditemukan.' });
    return;
  }

  res.json({ success: true, data: broadcast });
});

// POST /api/broadcasts (create and queue)
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { name, datasetId, templateId, customMessage, mediaId, scheduledAt } = req.body;

  if (!name || !datasetId || !customMessage) {
    res.status(400).json({ success: false, message: 'Nama, Dataset, dan Isi Pesan wajib diisi.' });
    return;
  }

  try {
    const dataset = await db.getOne<{ id: number; name: string }>(
      'SELECT id, name FROM contact_datasets WHERE id = ?',
      [datasetId]
    );

    if (!dataset) {
      res.status(404).json({ success: false, message: 'Dataset tidak ditemukan.' });
      return;
    }

    const broadcastCode = `BC-${Date.now().toString(36).toUpperCase()}`;
    const initialStatus = scheduledAt ? 'queued' : 'running';

    // 1. Insert into broadcasts table
    const bRes = await db.execute(
      `INSERT INTO broadcasts (broadcast_code, name, dataset_id, template_id, custom_message, media_id, status, scheduled_at, started_at, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'running' THEN CURRENT_TIMESTAMP ELSE NULL END, ?)`,
      [
        broadcastCode,
        name,
        datasetId,
        templateId || null,
        customMessage,
        mediaId || null,
        initialStatus,
        scheduledAt || null,
        initialStatus,
        req.user!.id
      ]
    );
    const broadcastId = bRes.insertId;

    // 2. Fetch all valid contacts
    const contacts = await db.query<{
      id: number;
      phone_number: string;
      name: string;
      notes: string;
      extra_data_json: string;
    }>('SELECT * FROM contacts WHERE dataset_id = ? AND is_valid = 1', [datasetId]);

    // 3. Populate recipients
    for (const c of contacts) {
      let extraData: Record<string, any> = {};
      try {
        extraData = JSON.parse(c.extra_data_json || '{}');
      } catch (e) {
        extraData = { A: c.phone_number, B: c.name, C: c.notes, nomor: c.phone_number, nama: c.name, keterangan: c.notes };
      }

      const resText = resolveTemplate(customMessage, extraData);
      const idempotencyKey = `${broadcastId}_${c.id}_${c.phone_number}`;

      await db.execute(
        `INSERT INTO broadcast_recipients (broadcast_id, contact_id, phone_number, recipient_name, personalized_message, status, idempotency_key)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
        [broadcastId, c.id, c.phone_number, c.name, resText.text, idempotencyKey]
      );
    }

    // 4. Update counters
    await broadcastQueueWorker.syncBroadcastCounters(broadcastId);
    broadcastQueueWorker.emitProgress(broadcastId);

    await logAudit(req.user!.id, 'BROADCAST_CREATE', 'broadcasts', {
      broadcastId,
      name,
      recipientsCount: contacts.length
    }, req.ip);

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
  } catch (err: any) {
    res.status(500).json({ success: false, message: `Gagal membuat broadcast: ${err.message}` });
  }
});

// POST /api/broadcasts/:id/pause
router.post('/:id/pause', async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  await broadcastQueueWorker.pauseBroadcast(id);
  await logAudit(req.user!.id, 'BROADCAST_PAUSE', 'broadcasts', { id }, req.ip);
  res.json({ success: true, message: 'Broadcast dijeda.' });
});

// POST /api/broadcasts/:id/resume
router.post('/:id/resume', async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  await broadcastQueueWorker.resumeBroadcast(id);
  await logAudit(req.user!.id, 'BROADCAST_RESUME', 'broadcasts', { id }, req.ip);
  res.json({ success: true, message: 'Broadcast dilanjutkan.' });
});

// POST /api/broadcasts/:id/cancel
router.post('/:id/cancel', async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  await broadcastQueueWorker.cancelBroadcast(id);
  await logAudit(req.user!.id, 'BROADCAST_CANCEL', 'broadcasts', { id }, req.ip);
  res.json({ success: true, message: 'Broadcast dibatalkan.' });
});

// POST /api/broadcasts/:id/retry-failed
router.post('/:id/retry-failed', async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const count = await broadcastQueueWorker.retryFailed(id);
  await logAudit(req.user!.id, 'BROADCAST_RETRY', 'broadcasts', { id, count }, req.ip);
  res.json({ success: true, message: `${count} pesan gagal dimasukkan kembali ke antrean.` });
});

// GET /api/broadcasts/:id/recipients (monitoring table with filters)
router.get('/:id/recipients', async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const statusFilter = req.query.status as string;
  const search = req.query.search as string;
  const page = parseInt(req.query.page as string || '1', 10);
  const limit = parseInt(req.query.limit as string || '20', 10);
  const offset = (page - 1) * limit;

  let sql = 'SELECT * FROM broadcast_recipients WHERE broadcast_id = ?';
  const params: any[] = [id];

  if (statusFilter && statusFilter !== 'all') {
    sql += ' AND status = ?';
    params.push(statusFilter);
  }

  if (search) {
    sql += ' AND (recipient_name LIKE ? OR phone_number LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
  const totalCountRes = await db.getOne<{ count: number }>(countSql, params);

  sql += ' ORDER BY id ASC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = await db.query(sql, params);

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
router.get('/:id/export', async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const recipients = await db.query(
    'SELECT phone_number, recipient_name, status, error_reason, attempts, sent_at FROM broadcast_recipients WHERE broadcast_id = ? ORDER BY id ASC',
    [id]
  );

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
router.post('/emergency-stop', requireRole(['Super Admin']), async (req: Request, res: Response): Promise<void> => {
  const { stop } = req.body;
  const val = stop ? '1' : '0';

  const existing = await db.getOne('SELECT id FROM app_settings WHERE key_name = ?', ['emergency_stop']);
  if (existing) {
    await db.execute('UPDATE app_settings SET value_text = ? WHERE key_name = ?', [val, 'emergency_stop']);
  } else {
    await db.execute('INSERT INTO app_settings (key_name, value_text, description) VALUES (?, ?, ?)', ['emergency_stop', val, 'Emergency stop active']);
  }

  if (stop) {
    await db.execute(`UPDATE broadcasts SET status = 'paused', paused_at = CURRENT_TIMESTAMP WHERE status = 'running'`);
    await logSystem('ERROR', 'EMERGENCY', 'EMERGENCY STOP DIAKTIFKAN: Semua broadcast langsung dijeda!');
  } else {
    await logSystem('INFO', 'EMERGENCY', 'Emergency stop dinonaktifkan.');
  }

  await logAudit(req.user!.id, 'EMERGENCY_STOP_TOGGLE', 'broadcasts', { active: stop }, req.ip);
  res.json({ success: true, message: stop ? 'Semua broadcast aktif telah dihentikan darurat!' : 'Status darurat dicabut.' });
});

export default router;
