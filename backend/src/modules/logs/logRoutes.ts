import { Router, Request, Response } from 'express';
import os from 'os';
import { db } from '../../database/index.js';
import { broadcastQueueWorker } from '../broadcast/broadcastQueueWorker.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { logAudit, logSystem } from '../../utils/logger.js';

const router = Router();
router.use(authenticate);

// GET /api/logs/system
router.get('/system', async (req: Request, res: Response) => {
  const level = req.query.level as string;
  const search = req.query.search as string;
  const page = parseInt(req.query.page as string || '1', 10);
  const limit = parseInt(req.query.limit as string || '100', 10);
  const offset = (page - 1) * limit;

  let sql = 'SELECT * FROM system_logs WHERE 1=1';
  const params: any[] = [];

  if (level && level !== 'ALL') {
    sql += ' AND level = ?';
    params.push(level);
  }

  if (search) {
    sql += ' AND (message LIKE ? OR module LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const logs = await db.query(sql, params);
  res.json({ success: true, data: logs });
});

// GET /api/logs/audit
router.get('/audit', requireRole(['Super Admin']), async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string || '1', 10);
  const limit = parseInt(req.query.limit as string || '50', 10);
  const offset = (page - 1) * limit;

  const logs = await db.query(
    `SELECT a.*, u.username, u.full_name 
     FROM audit_logs a 
     LEFT JOIN users u ON a.user_id = u.id 
     ORDER BY a.id DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  res.json({ success: true, data: logs });
});

// DELETE /api/logs/system (clear logs display/table)
router.delete('/system', requireRole(['Super Admin']), async (req: Request, res: Response) => {
  await db.execute('DELETE FROM system_logs');
  await logAudit(req.user!.id, 'LOGS_CLEAR', 'system_logs', {}, req.ip);
  res.json({ success: true, message: 'Log sistem berhasil dibersihkan.' });
});

// GET /api/logs/download (export logs to plaintext)
router.get('/download', async (req: Request, res: Response) => {
  const logs = await db.query<{ created_at: string; level: string; module: string; message: string }>(
    'SELECT created_at, level, module, message FROM system_logs ORDER BY id ASC LIMIT 5000'
  );

  let output = `=== WA BLAST MANAGER PRO - SYSTEM LOG EXPORT ===\nExported: ${new Date().toISOString()}\n\n`;
  for (const log of logs) {
    output += `[${log.created_at}] [${log.level}] ${log.module}: ${log.message}\n`;
  }

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', 'attachment; filename="system_logs.txt"');
  res.send(output);
});

// GET /api/logs/server-metrics
router.get('/server-metrics', async (req: Request, res: Response) => {
  const totalMem = Math.round(os.totalmem() / 1024 / 1024);
  const freeMem = Math.round(os.freemem() / 1024 / 1024);
  const usedMem = totalMem - freeMem;
  const memPercent = Math.round((usedMem / totalMem) * 100);

  const cpus = os.cpus();
  const uptimeSeconds = Math.round(os.uptime());

  res.json({
    success: true,
    data: {
      uptimeSeconds,
      uptimeFormatted: `${(uptimeSeconds / 3600).toFixed(1)} jam`,
      totalMemoryMb: totalMem,
      usedMemoryMb: usedMem,
      freeMemoryMb: freeMem,
      memoryPercent: memPercent,
      cpuCores: cpus.length,
      cpuModel: cpus[0]?.model || 'Standard CPU',
      platform: `${os.platform()} ${os.arch()}`
    }
  });
});

// POST /api/logs/restart-worker
router.post('/restart-worker', requireRole(['Super Admin']), async (req: Request, res: Response) => {
  await broadcastQueueWorker.stop();
  setTimeout(async () => {
    await broadcastQueueWorker.start();
  }, 1000);
  await logAudit(req.user!.id, 'WORKER_RESTART', 'broadcast_worker', {}, req.ip);
  await logSystem('INFO', 'WORKER', 'Broadcast Queue Worker berhasil direstart oleh admin.');
  res.json({ success: true, message: 'Broadcast Worker berhasil direstart.' });
});

export default router;
