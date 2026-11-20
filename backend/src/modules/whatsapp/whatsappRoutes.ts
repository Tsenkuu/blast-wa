import { Router, Request, Response } from 'express';
import { whatsappService } from './baileysService.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { logAudit } from '../../utils/logger.js';

const router = Router();

// Require auth for all WhatsApp endpoints
router.use(authenticate);

// GET /api/whatsapp/status
router.get('/status', async (req: Request, res: Response) => {
  const info = whatsappService.getAccountInfo();
  res.json({
    success: true,
    data: info
  });
});

// POST /api/whatsapp/connect
router.post('/connect', requireRole(['Super Admin', 'Operator']), async (req: Request, res: Response) => {
  try {
    await whatsappService.connect();
    await logAudit(req.user!.id, 'WA_CONNECT', 'whatsapp', {}, req.ip);
    res.json({ success: true, message: 'Menghubungkan WhatsApp...' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: `Gagal menghubungkan: ${err.message}` });
  }
});

// POST /api/whatsapp/disconnect
router.post('/disconnect', requireRole(['Super Admin', 'Operator']), async (req: Request, res: Response) => {
  try {
    await whatsappService.disconnect();
    await logAudit(req.user!.id, 'WA_DISCONNECT', 'whatsapp', {}, req.ip);
    res.json({ success: true, message: 'WhatsApp diputuskan.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: `Gagal memutuskan: ${err.message}` });
  }
});

// POST /api/whatsapp/logout
router.post('/logout', requireRole(['Super Admin']), async (req: Request, res: Response) => {
  try {
    await whatsappService.logout();
    await logAudit(req.user!.id, 'WA_LOGOUT', 'whatsapp', {}, req.ip);
    res.json({ success: true, message: 'Sesi WhatsApp berhasil dikeluarkan (logged out).' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: `Gagal logout: ${err.message}` });
  }
});

// POST /api/whatsapp/restart
router.post('/restart', requireRole(['Super Admin']), async (req: Request, res: Response) => {
  try {
    await whatsappService.disconnect();
    setTimeout(async () => {
      await whatsappService.connect();
    }, 1500);
    await logAudit(req.user!.id, 'WA_RESTART', 'whatsapp', {}, req.ip);
    res.json({ success: true, message: 'Koneksi WhatsApp direstart.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: `Gagal restart: ${err.message}` });
  }
});

export default router;
