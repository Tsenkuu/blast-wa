import { db } from '../../database/index.js';
import { whatsappService } from '../whatsapp/baileysService.js';
import { resolveTemplate } from '../../utils/templateEngine.js';
import { logSystem, getSocketIO } from '../../utils/logger.js';
import { config } from '../../config/index.js';

class BroadcastQueueWorker {
  private isProcessing: boolean = false;
  private workerInterval: NodeJS.Timeout | null = null;
  private currentRecipientInFlight: number | null = null;
  private isShuttingDown: boolean = false;
  
  // Anti-ban: tracking pengiriman per jam
  private sentTimestamps: number[] = [];
  private readonly MAX_MESSAGES_PER_HOUR = 80; // Batas aman per jam (jangan terlalu banyak!)
  private readonly HOURLY_COOLDOWN_MS = 5 * 60 * 1000; // Istirahat 5 menit jika limit tercapai

  public async start(): Promise<void> {
    logSystem('INFO', 'WORKER', 'Memulai Broadcast Queue Worker...');
    
    // Recovery on boot: reset dangling 'processing' status to 'pending'
    await this.recoverDanglingMessages();

    // Start polling loop every 3 seconds (lebih lambat agar tidak terlalu agresif)
    this.workerInterval = setInterval(() => {
      this.processNextInQueue().catch((err) => {
        console.error('Error in BroadcastQueueWorker cycle:', err);
      });
    }, 3000);
  }

  public async stop(): Promise<void> {
    this.isShuttingDown = true;
    if (this.workerInterval) {
      clearInterval(this.workerInterval);
      this.workerInterval = null;
    }
    logSystem('INFO', 'WORKER', 'Broadcast Queue Worker dihentikan.');
  }

  private async recoverDanglingMessages(): Promise<void> {
    try {
      const recovered = await db.execute(
        `UPDATE broadcast_recipients 
         SET status = 'pending', attempts = attempts + 1 
         WHERE status = 'processing'`
      );
      if (recovered.affectedRows > 0) {
        logSystem('WARNING', 'WORKER', `Memulihkan ${recovered.affectedRows} pesan 'processing' yang menggantung akibat restart.`);
      }

      // Check running broadcasts on restart and sync pending count
      const runningBroadcasts = await db.query<{ id: number; name: string }>(
        `SELECT id, name FROM broadcasts WHERE status = 'running'`
      );
      for (const b of runningBroadcasts) {
        await this.syncBroadcastCounters(b.id);
      }
    } catch (err: any) {
      console.error('Failed to recover dangling messages:', err);
    }
  }

  private getRandomDelay(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Main worker loop cycle
   */
  public async processNextInQueue(): Promise<void> {
    if (this.isProcessing || this.isShuttingDown) return;

    // Check emergency stop flag
    const emergencySetting = await db.getOne<{ value_text: string }>(
      `SELECT value_text FROM app_settings WHERE key_name = 'emergency_stop'`
    );
    if (emergencySetting && emergencySetting.value_text === '1') {
      // Pause all running broadcasts
      await db.execute(`UPDATE broadcasts SET status = 'paused', paused_at = CURRENT_TIMESTAMP WHERE status = 'running'`);
      return;
    }

    // ===== ANTI-BAN: Rate limiter per jam =====
    // Bersihkan timestamp pengiriman yang sudah lebih dari 1 jam
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    this.sentTimestamps = this.sentTimestamps.filter(t => t > oneHourAgo);
    
    if (this.sentTimestamps.length >= this.MAX_MESSAGES_PER_HOUR) {
      // Sudah mencapai batas per jam, istirahat dulu
      if (!this.isProcessing) {
        this.isProcessing = true;
        const cooldownMin = Math.round(this.HOURLY_COOLDOWN_MS / 60000);
        await logSystem('WARNING', 'BLAST', `⏳ Anti-Ban: Sudah mengirim ${this.sentTimestamps.length} pesan dalam 1 jam terakhir. Istirahat ${cooldownMin} menit untuk mencegah blokir WhatsApp...`);
        await this.sleep(this.HOURLY_COOLDOWN_MS);
        this.isProcessing = false;
      }
      return;
    }

    // 1. Check if there are active broadcasts (running or scheduled)
    // Selesaikan broadcast yang tidak memiliki penerima pending lagi agar tidak memblokir antrean
    try {
      const finishedBroadcasts = await db.query<{ id: number; name: string }>(
        `SELECT b.id, b.name FROM broadcasts b
         WHERE b.status = 'running'
           AND NOT EXISTS (
             SELECT 1 FROM broadcast_recipients r WHERE r.broadcast_id = b.id AND r.status = 'pending'
           )`
      );
      for (const fb of finishedBroadcasts) {
        await this.completeBroadcast(fb.id, fb.name);
      }
    } catch (e) {
      // safe ignore
    }

    const activeBroadcast = await db.getOne<{
      id: number;
      broadcast_code: string;
      name: string;
      status: string;
      dataset_id: number;
      custom_message: string;
      media_id: number | null;
      delay_seconds?: number;
      failed_count: number;
      sent_count: number;
      total_recipients: number;
    }>(
      `SELECT * FROM broadcasts 
       WHERE status = 'running' 
          OR (status = 'queued' AND (scheduled_at IS NULL OR scheduled_at <= CURRENT_TIMESTAMP))
       ORDER BY id ASC LIMIT 1`
    );

    if (!activeBroadcast) return;

    // If it was queued and scheduled time arrived, update to running
    if (activeBroadcast.status === 'queued') {
      await db.execute(
        `UPDATE broadcasts SET status = 'running', started_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [activeBroadcast.id]
      );
      activeBroadcast.status = 'running';
      logSystem('INFO', 'BLAST', `Broadcast #${activeBroadcast.id} (${activeBroadcast.name}) dimulai.`);
      whatsappService.notifyAdmins(
        `🚀 *BROADCAST DIMULAI*\n\nNama: *${activeBroadcast.name}*\nTotal Target: ${activeBroadcast.total_recipients}\nWaktu: ${new Date().toLocaleTimeString('id-ID')}`
      );
    }

    // 2. WhatsApp connection health check
    const waInfo = whatsappService.getAccountInfo();
    if (waInfo.status === 'connecting') {
      // Sedang dalam proses handshake/koneksi Baileys, jangan dipause permanen, tunggu siklus berikutnya
      return;
    }
    if (waInfo.status !== 'connected') {
      await logSystem('WARNING', 'BLAST', `Broadcast #${activeBroadcast.id} dijeda otomatis: WhatsApp tidak terhubung.`);
      await db.execute(`UPDATE broadcasts SET status = 'paused', paused_at = CURRENT_TIMESTAMP WHERE id = ?`, [activeBroadcast.id]);
      this.emitProgress(activeBroadcast.id);
      return;
    }

    // 3. Circuit breaker check: consecutive failures or high failure rate
    const circuitFailSetting = await db.getOne<{ value_text: string }>(
      `SELECT value_text FROM app_settings WHERE key_name = 'circuit_breaker_fails'`
    );
    const maxFailStreak = circuitFailSetting ? parseInt(circuitFailSetting.value_text, 10) : config.queue.circuitBreakerFailStreak;

    // Check last N recipients
    const lastRecipients = await db.query<{ status: string }>(
      `SELECT status FROM broadcast_recipients 
       WHERE broadcast_id = ? AND status IN ('sent', 'failed') 
       ORDER BY last_attempt_at DESC LIMIT ?`,
      [activeBroadcast.id, maxFailStreak]
    );

    if (lastRecipients.length >= maxFailStreak && lastRecipients.every(r => r.status === 'failed')) {
      await logSystem('ERROR', 'BLAST', `⚠️ CIRCUIT BREAKER: Broadcast #${activeBroadcast.id} dijeda otomatis setelah ${maxFailStreak} kali gagal berturut-turut!`);
      await db.execute(`UPDATE broadcasts SET status = 'paused', paused_at = CURRENT_TIMESTAMP WHERE id = ?`, [activeBroadcast.id]);
      whatsappService.notifyAdmins(
        `⚠️ *CIRCUIT BREAKER AKTIF*\n\nBroadcast *${activeBroadcast.name}* dijeda otomatis karena terdeteksi ${maxFailStreak} kegagalan berturut-turut.\nPeriksa status nomor WhatsApp Anda!`
      );
      this.emitProgress(activeBroadcast.id);
      return;
    }

    // 4. Fetch next pending recipient
    const recipient = await db.getOne<{
      id: number;
      broadcast_id: number;
      contact_id: number | null;
      phone_number: string;
      recipient_name: string;
      personalized_message: string;
      attempts: number;
      idempotency_key: string;
    }>(
      `SELECT * FROM broadcast_recipients 
       WHERE broadcast_id = ? AND status = 'pending' 
       ORDER BY id ASC LIMIT 1`,
      [activeBroadcast.id]
    );

    // If no more pending recipients, complete the broadcast!
    if (!recipient) {
      await this.completeBroadcast(activeBroadcast.id, activeBroadcast.name);
      return;
    }

    // Lock recipient to processing
    this.isProcessing = true;
    this.currentRecipientInFlight = recipient.id;

    try {
      await db.execute(
        `UPDATE broadcast_recipients SET status = 'processing', last_attempt_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [recipient.id]
      );

      // Check Consent & Opt-Out
      const isOptedOut = await db.getOne(
        `SELECT id FROM opt_outs WHERE phone_number = ?`,
        [recipient.phone_number]
      );

      if (isOptedOut) {
        await db.execute(
          `UPDATE broadcast_recipients SET status = 'skipped', error_reason = 'Penerima memilih Opt-Out (berhenti)' WHERE id = ?`,
          [recipient.id]
        );
        await logSystem('INFO', 'BLAST', `Pesan ke ${recipient.phone_number} dilewati: Opt-out.`);
        await this.syncBroadcastCounters(activeBroadcast.id);
        this.emitProgress(activeBroadcast.id);
        this.isProcessing = false;
        this.currentRecipientInFlight = null;
        return;
      }

      // Check Consent setting
      const consentSetting = await db.getOne<{ value_text: string }>(
        `SELECT value_text FROM app_settings WHERE key_name = 'consent_required'`
      );
      if (consentSetting && consentSetting.value_text === '1') {
        const cleanDigits = recipient.phone_number.replace(/[^\d]/g, '');
        const consent = await db.getOne<{ status: string }>(
          `SELECT status FROM contact_consents 
           WHERE phone_number = ? OR phone_number LIKE ?`,
          [recipient.phone_number, `%${cleanDigits.slice(-9)}`]
        );
        if (!consent || consent.status !== 'granted') {
          // Jika nomor terdaftar dalam dataset kontak resmi yang diupload, berikan persetujuan otomatis
          if (recipient.contact_id) {
            await db.execute(
              `INSERT INTO contact_consents (phone_number, status, source) VALUES (?, 'granted', 'Dataset Contact')`,
              [recipient.phone_number]
            );
          } else {
            await db.execute(
              `UPDATE broadcast_recipients SET status = 'skipped', error_reason = 'Belum ada persetujuan (consent) penerima' WHERE id = ?`,
              [recipient.id]
            );
            await logSystem('INFO', 'BLAST', `Pesan ke ${recipient.phone_number} dilewati: Tidak ada consent.`);
            await this.syncBroadcastCounters(activeBroadcast.id);
            this.emitProgress(activeBroadcast.id);
            this.isProcessing = false;
            this.currentRecipientInFlight = null;
            return;
          }
        }
      }

      // Prepare Media if present
      let mediaPath: string | null = null;
      if (activeBroadcast.media_id) {
        const media = await db.getOne<{ storage_path: string }>(
          `SELECT storage_path FROM media_files WHERE id = ?`,
          [activeBroadcast.media_id]
        );
        if (media && media.storage_path) {
          mediaPath = media.storage_path;
        }
      }

      // Send via WhatsApp Service
      let sendResult: any;
      if (mediaPath) {
        sendResult = await whatsappService.sendImageMessage(
          recipient.phone_number,
          mediaPath,
          recipient.personalized_message
        );
      } else {
        sendResult = await whatsappService.sendTextMessage(
          recipient.phone_number,
          recipient.personalized_message
        );
      }

      if (sendResult.success) {
        await db.execute(
          `UPDATE broadcast_recipients 
           SET status = 'sent', sent_at = CURRENT_TIMESTAMP, error_reason = NULL 
           WHERE id = ?`,
          [recipient.id]
        );

        // Record outgoing message
        await db.execute(
          `INSERT INTO outgoing_messages (broadcast_id, recipient_id, phone_number, message_type, content, media_path, status, baileys_message_id)
           VALUES (?, ?, ?, ?, ?, ?, 'sent', ?)`,
          [
            activeBroadcast.id,
            recipient.id,
            recipient.phone_number,
            mediaPath ? 'image' : 'text',
            recipient.personalized_message,
            mediaPath,
            sendResult.messageId
          ]
        );

        await logSystem('SUCCESS', 'MESSAGE', `Pesan terkirim ke ${recipient.phone_number} (${recipient.recipient_name || 'Tanpa Nama'})`);
      } else {
        // Failed sending
        const newAttempts = recipient.attempts + 1;
        const maxRetries = config.queue.maxRetries;

        if (newAttempts <= maxRetries) {
          // Retry
          await db.execute(
            `UPDATE broadcast_recipients 
             SET status = 'pending', attempts = ?, error_reason = ? 
             WHERE id = ?`,
            [newAttempts, `Coba ke-${newAttempts}: ${sendResult.error || 'Gagal terkirim'}`, recipient.id]
          );
          await logSystem('WARNING', 'MESSAGE', `Gagal kirim ke ${recipient.phone_number}. Akan dicoba ulang (${newAttempts}/${maxRetries}).`);
        } else {
          // Permanently failed
          await db.execute(
            `UPDATE broadcast_recipients 
             SET status = 'failed', attempts = ?, error_reason = ? 
             WHERE id = ?`,
            [newAttempts, sendResult.error || 'Gagal setelah batas maksimal retry', recipient.id]
          );
          await logSystem('ERROR', 'MESSAGE', `Pesan ke ${recipient.phone_number} gagal permanen: ${sendResult.error}`);
        }
      }

      await this.syncBroadcastCounters(activeBroadcast.id);
      this.emitProgress(activeBroadcast.id);

      // ===== ANTI-BAN DELAY SYSTEM =====
      // Catat timestamp pengiriman berhasil untuk rate limiter per jam
      if (sendResult.success) {
        this.sentTimestamps.push(Date.now());
      }

      // Ambil delay global dari pengaturan
      let globalMinMs = config.queue.minDelayMs;
      let globalMaxMs = config.queue.maxDelayMs;

      try {
        const minRow = await db.getOne<{ value_text: string }>(
          `SELECT value_text FROM app_settings WHERE key_name = 'min_delay_ms'`
        );
        const maxRow = await db.getOne<{ value_text: string }>(
          `SELECT value_text FROM app_settings WHERE key_name = 'max_delay_ms'`
        );

        if (minRow && minRow.value_text) {
          const parsed = parseInt(minRow.value_text, 10);
          if (!isNaN(parsed) && parsed > 0) {
            // Auto-detect: jika user input <= 300, itu adalah detik (contoh: 60 = 60 detik). Jika > 300, sudah ms.
            globalMinMs = parsed <= 300 ? parsed * 1000 : parsed;
          }
        }

        if (maxRow && maxRow.value_text) {
          const parsed = parseInt(maxRow.value_text, 10);
          if (!isNaN(parsed) && parsed > 0) {
            globalMaxMs = parsed <= 300 ? parsed * 1000 : parsed;
          }
        }
      } catch (e) {
        // Fallback to config
      }

      if (globalMaxMs < globalMinMs) {
        globalMaxMs = globalMinMs;
      }

      // ANTI-BAN: Minimum delay yang aman adalah 8 detik per pesan
      const ABSOLUTE_MIN_DELAY_MS = 8000;
      globalMinMs = Math.max(globalMinMs, ABSOLUTE_MIN_DELAY_MS);
      globalMaxMs = Math.max(globalMaxMs, globalMinMs);

      let baseDelay = this.getRandomDelay(globalMinMs, globalMaxMs);

      // Jika broadcast memiliki delay_seconds custom, gunakan itu (tapi tetap di atas batas aman)
      if (activeBroadcast.delay_seconds !== undefined && activeBroadcast.delay_seconds !== null && activeBroadcast.delay_seconds > 0) {
        const bcastDelayMs = activeBroadcast.delay_seconds * 1000;
        baseDelay = Math.max(bcastDelayMs, ABSOLUTE_MIN_DELAY_MS);
      }

      // ANTI-BAN: Tambahkan variasi acak ±30% agar pola tidak terdeteksi sebagai bot
      const variation = Math.random() * 0.6 - 0.3; // -30% sampai +30%
      let delay = Math.round(baseDelay * (1 + variation));
      delay = Math.max(delay, ABSOLUTE_MIN_DELAY_MS); // Jangan pernah di bawah batas aman

      // ANTI-BAN: Setiap 15-25 pesan, tambahkan jeda panjang (istirahat mikro) 30-90 detik
      const sentInSession = this.sentTimestamps.filter(t => t > Date.now() - 30 * 60 * 1000).length;
      const microBreakInterval = this.getRandomDelay(15, 25);
      if (sentInSession > 0 && sentInSession % microBreakInterval === 0) {
        const microBreakMs = this.getRandomDelay(30000, 90000);
        const microBreakSec = Math.round(microBreakMs / 1000);
        await logSystem('INFO', 'BLAST', `🛡️ Anti-Ban: Istirahat mikro ${microBreakSec} detik setelah ${sentInSession} pesan (pola manusiawi)...`);
        delay += microBreakMs;
      }

      // If test mode with minDelayMs === 0, keep it 0
      if (config.queue.minDelayMs === 0) {
        delay = 0;
      }

      if (delay > 0) {
        const delaySec = Math.round(delay / 1000);
        await logSystem('INFO', 'BLAST', `⏱️ Jeda ${delaySec} detik sebelum nomor berikutnya...`);
        await this.sleep(delay);
      }

    } catch (err: any) {
      console.error(`Error processing recipient #${recipient.id}:`, err);
      await db.execute(
        `UPDATE broadcast_recipients SET status = 'failed', error_reason = ? WHERE id = ?`,
        [err.message || 'Server error', recipient.id]
      );
      await this.syncBroadcastCounters(activeBroadcast.id);
      this.emitProgress(activeBroadcast.id);
    } finally {
      this.isProcessing = false;
      this.currentRecipientInFlight = null;
    }
  }

  public async syncBroadcastCounters(broadcastId: number): Promise<void> {
    const stats = await db.getOne<{
      total: number;
      sent: number;
      failed: number;
      skipped: number;
      pending: number;
    }>(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
         SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped,
         SUM(CASE WHEN status IN ('pending', 'processing') THEN 1 ELSE 0 END) as pending
       FROM broadcast_recipients WHERE broadcast_id = ?`,
      [broadcastId]
    );

    if (stats) {
      await db.execute(
        `UPDATE broadcasts 
         SET total_recipients = ?, sent_count = ?, failed_count = ?, skipped_count = ?, pending_count = ?
         WHERE id = ?`,
        [stats.total || 0, stats.sent || 0, stats.failed || 0, stats.skipped || 0, stats.pending || 0, broadcastId]
      );
    }
  }

  private async completeBroadcast(broadcastId: number, broadcastName: string): Promise<void> {
    await db.execute(
      `UPDATE broadcasts 
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP, pending_count = 0 
       WHERE id = ?`,
      [broadcastId]
    );

    await this.syncBroadcastCounters(broadcastId);

    const b = await db.getOne<{
      total_recipients: number;
      sent_count: number;
      failed_count: number;
      skipped_count: number;
      started_at: string;
      completed_at: string;
    }>(
      `SELECT total_recipients, sent_count, failed_count, skipped_count, started_at, completed_at FROM broadcasts WHERE id = ?`,
      [broadcastId]
    );

    await logSystem('SUCCESS', 'BLAST', `Broadcast #${broadcastId} (${broadcastName}) SELESAI.`);

    whatsappService.notifyAdmins(
      `🏁 *LAPORAN BROADCAST SELESAI*\n\n` +
      `Nama: *${broadcastName}*\n` +
      `Total: ${b?.total_recipients || 0}\n` +
      `Berhasil: ${b?.sent_count || 0}\n` +
      `Gagal: ${b?.failed_count || 0}\n` +
      `Dilewati: ${b?.skipped_count || 0}\n` +
      `Status: *SELESAI*\n` +
      `Waktu Selesai: ${new Date().toLocaleTimeString('id-ID')}`
    );

    this.emitProgress(broadcastId);
  }

  public emitProgress(broadcastId: number): void {
    const io = getSocketIO();
    if (!io) return;

    db.getOne(
      `SELECT id, broadcast_code, name, status, total_recipients, sent_count, failed_count, skipped_count, pending_count, started_at, completed_at
       FROM broadcasts WHERE id = ?`,
      [broadcastId]
    ).then((b) => {
      if (b) {
        const processed = (b.sent_count || 0) + (b.failed_count || 0) + (b.skipped_count || 0);
        const progressPercent = b.total_recipients > 0 ? Math.round((processed / b.total_recipients) * 100) : 0;
        io.emit('broadcast:progress', {
          ...b,
          progressPercent
        });
      }
    });
  }

  // Admin controls
  public async pauseBroadcast(broadcastId: number): Promise<void> {
    await db.execute(
      `UPDATE broadcasts SET status = 'paused', paused_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'running'`,
      [broadcastId]
    );
    await logSystem('WARNING', 'BLAST', `Broadcast #${broadcastId} DIJEDA oleh admin.`);
    this.emitProgress(broadcastId);
    whatsappService.notifyAdmins(`⏸️ *BROADCAST DIJEDA*\n\nBroadcast ID #${broadcastId} berhasil dijeda.`);
  }

  public async resumeBroadcast(broadcastId: number): Promise<void> {
    await db.execute(
      `UPDATE broadcasts SET status = 'running', paused_at = NULL WHERE id = ? AND status = 'paused'`,
      [broadcastId]
    );
    await logSystem('INFO', 'BLAST', `Broadcast #${broadcastId} DILANJUTKAN oleh admin.`);
    this.emitProgress(broadcastId);
    whatsappService.notifyAdmins(`▶️ *BROADCAST DILANJUTKAN*\n\nBroadcast ID #${broadcastId} melanjutkan pengiriman.`);
  }

  public async cancelBroadcast(broadcastId: number): Promise<void> {
    await db.execute(
      `UPDATE broadcasts SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('running', 'paused', 'queued')`,
      [broadcastId]
    );
    await logSystem('WARNING', 'BLAST', `Broadcast #${broadcastId} DIBATALKAN.`);
    this.emitProgress(broadcastId);
    whatsappService.notifyAdmins(`⏹️ *BROADCAST DIBATALKAN*\n\nBroadcast ID #${broadcastId} telah dibatalkan.`);
  }

  public async retryFailed(broadcastId: number): Promise<number> {
    const res = await db.execute(
      `UPDATE broadcast_recipients 
       SET status = 'pending', attempts = 0, error_reason = NULL 
       WHERE broadcast_id = ? AND status = 'failed'`,
      [broadcastId]
    );
    await this.syncBroadcastCounters(broadcastId);
    // If completed or failed, reopen to running
    await db.execute(
      `UPDATE broadcasts SET status = 'running', completed_at = NULL WHERE id = ?`,
      [broadcastId]
    );
    this.emitProgress(broadcastId);
    return res.affectedRows;
  }
}

export const broadcastQueueWorker = new BroadcastQueueWorker();
