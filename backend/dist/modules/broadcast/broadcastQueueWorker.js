"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.broadcastQueueWorker = void 0;
const index_js_1 = require("../../database/index.js");
const baileysService_js_1 = require("../whatsapp/baileysService.js");
const logger_js_1 = require("../../utils/logger.js");
const index_js_2 = require("../../config/index.js");
class BroadcastQueueWorker {
    isProcessing = false;
    workerInterval = null;
    currentRecipientInFlight = null;
    isShuttingDown = false;
    async start() {
        (0, logger_js_1.logSystem)('INFO', 'WORKER', 'Memulai Broadcast Queue Worker...');
        // Recovery on boot: reset dangling 'processing' status to 'pending'
        await this.recoverDanglingMessages();
        // Start polling loop every 1.5 seconds
        this.workerInterval = setInterval(() => {
            this.processNextInQueue().catch((err) => {
                console.error('Error in BroadcastQueueWorker cycle:', err);
            });
        }, 1500);
    }
    async stop() {
        this.isShuttingDown = true;
        if (this.workerInterval) {
            clearInterval(this.workerInterval);
            this.workerInterval = null;
        }
        (0, logger_js_1.logSystem)('INFO', 'WORKER', 'Broadcast Queue Worker dihentikan.');
    }
    async recoverDanglingMessages() {
        try {
            const recovered = await index_js_1.db.execute(`UPDATE broadcast_recipients 
         SET status = 'pending', attempts = attempts + 1 
         WHERE status = 'processing'`);
            if (recovered.affectedRows > 0) {
                (0, logger_js_1.logSystem)('WARNING', 'WORKER', `Memulihkan ${recovered.affectedRows} pesan 'processing' yang menggantung akibat restart.`);
            }
            // Check running broadcasts on restart and sync pending count
            const runningBroadcasts = await index_js_1.db.query(`SELECT id, name FROM broadcasts WHERE status = 'running'`);
            for (const b of runningBroadcasts) {
                await this.syncBroadcastCounters(b.id);
            }
        }
        catch (err) {
            console.error('Failed to recover dangling messages:', err);
        }
    }
    getRandomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Main worker loop cycle
     */
    async processNextInQueue() {
        if (this.isProcessing || this.isShuttingDown)
            return;
        // Check emergency stop flag
        const emergencySetting = await index_js_1.db.getOne(`SELECT value_text FROM app_settings WHERE key_name = 'emergency_stop'`);
        if (emergencySetting && emergencySetting.value_text === '1') {
            // Pause all running broadcasts
            await index_js_1.db.execute(`UPDATE broadcasts SET status = 'paused', paused_at = CURRENT_TIMESTAMP WHERE status = 'running'`);
            return;
        }
        // 1. Check if there are active broadcasts (running or scheduled)
        const activeBroadcast = await index_js_1.db.getOne(`SELECT * FROM broadcasts 
       WHERE status = 'running' 
          OR (status = 'queued' AND (scheduled_at IS NULL OR scheduled_at <= CURRENT_TIMESTAMP))
       ORDER BY id ASC LIMIT 1`);
        if (!activeBroadcast)
            return;
        // If it was queued and scheduled time arrived, update to running
        if (activeBroadcast.status === 'queued') {
            await index_js_1.db.execute(`UPDATE broadcasts SET status = 'running', started_at = CURRENT_TIMESTAMP WHERE id = ?`, [activeBroadcast.id]);
            activeBroadcast.status = 'running';
            (0, logger_js_1.logSystem)('INFO', 'BLAST', `Broadcast #${activeBroadcast.id} (${activeBroadcast.name}) dimulai.`);
            baileysService_js_1.whatsappService.notifyAdmins(`🚀 *BROADCAST DIMULAI*\n\nNama: *${activeBroadcast.name}*\nTotal Target: ${activeBroadcast.total_recipients}\nWaktu: ${new Date().toLocaleTimeString('id-ID')}`);
        }
        // 2. WhatsApp connection health check
        const waInfo = baileysService_js_1.whatsappService.getAccountInfo();
        if (waInfo.status !== 'connected') {
            await (0, logger_js_1.logSystem)('WARNING', 'BLAST', `Broadcast #${activeBroadcast.id} dijeda otomatis: WhatsApp tidak terhubung.`);
            await index_js_1.db.execute(`UPDATE broadcasts SET status = 'paused', paused_at = CURRENT_TIMESTAMP WHERE id = ?`, [activeBroadcast.id]);
            this.emitProgress(activeBroadcast.id);
            return;
        }
        // 3. Circuit breaker check: consecutive failures or high failure rate
        const circuitFailSetting = await index_js_1.db.getOne(`SELECT value_text FROM app_settings WHERE key_name = 'circuit_breaker_fails'`);
        const maxFailStreak = circuitFailSetting ? parseInt(circuitFailSetting.value_text, 10) : index_js_2.config.queue.circuitBreakerFailStreak;
        // Check last N recipients
        const lastRecipients = await index_js_1.db.query(`SELECT status FROM broadcast_recipients 
       WHERE broadcast_id = ? AND status IN ('sent', 'failed') 
       ORDER BY last_attempt_at DESC LIMIT ?`, [activeBroadcast.id, maxFailStreak]);
        if (lastRecipients.length >= maxFailStreak && lastRecipients.every(r => r.status === 'failed')) {
            await (0, logger_js_1.logSystem)('ERROR', 'BLAST', `⚠️ CIRCUIT BREAKER: Broadcast #${activeBroadcast.id} dijeda otomatis setelah ${maxFailStreak} kali gagal berturut-turut!`);
            await index_js_1.db.execute(`UPDATE broadcasts SET status = 'paused', paused_at = CURRENT_TIMESTAMP WHERE id = ?`, [activeBroadcast.id]);
            baileysService_js_1.whatsappService.notifyAdmins(`⚠️ *CIRCUIT BREAKER AKTIF*\n\nBroadcast *${activeBroadcast.name}* dijeda otomatis karena terdeteksi ${maxFailStreak} kegagalan berturut-turut.\nPeriksa status nomor WhatsApp Anda!`);
            this.emitProgress(activeBroadcast.id);
            return;
        }
        // 4. Fetch next pending recipient
        const recipient = await index_js_1.db.getOne(`SELECT * FROM broadcast_recipients 
       WHERE broadcast_id = ? AND status = 'pending' 
       ORDER BY id ASC LIMIT 1`, [activeBroadcast.id]);
        // If no more pending recipients, complete the broadcast!
        if (!recipient) {
            await this.completeBroadcast(activeBroadcast.id, activeBroadcast.name);
            return;
        }
        // Lock recipient to processing
        this.isProcessing = true;
        this.currentRecipientInFlight = recipient.id;
        try {
            await index_js_1.db.execute(`UPDATE broadcast_recipients SET status = 'processing', last_attempt_at = CURRENT_TIMESTAMP WHERE id = ?`, [recipient.id]);
            // Check Consent & Opt-Out
            const isOptedOut = await index_js_1.db.getOne(`SELECT id FROM opt_outs WHERE phone_number = ?`, [recipient.phone_number]);
            if (isOptedOut) {
                await index_js_1.db.execute(`UPDATE broadcast_recipients SET status = 'skipped', error_reason = 'Penerima memilih Opt-Out (berhenti)' WHERE id = ?`, [recipient.id]);
                await (0, logger_js_1.logSystem)('INFO', 'BLAST', `Pesan ke ${recipient.phone_number} dilewati: Opt-out.`);
                await this.syncBroadcastCounters(activeBroadcast.id);
                this.emitProgress(activeBroadcast.id);
                this.isProcessing = false;
                this.currentRecipientInFlight = null;
                return;
            }
            // Check Consent setting
            const consentSetting = await index_js_1.db.getOne(`SELECT value_text FROM app_settings WHERE key_name = 'consent_required'`);
            if (consentSetting && consentSetting.value_text === '1') {
                const consent = await index_js_1.db.getOne(`SELECT status FROM contact_consents WHERE phone_number = ?`, [recipient.phone_number]);
                if (!consent || consent.status !== 'granted') {
                    await index_js_1.db.execute(`UPDATE broadcast_recipients SET status = 'skipped', error_reason = 'Belum ada persetujuan (consent) penerima' WHERE id = ?`, [recipient.id]);
                    await (0, logger_js_1.logSystem)('INFO', 'BLAST', `Pesan ke ${recipient.phone_number} dilewati: Tidak ada consent.`);
                    await this.syncBroadcastCounters(activeBroadcast.id);
                    this.emitProgress(activeBroadcast.id);
                    this.isProcessing = false;
                    this.currentRecipientInFlight = null;
                    return;
                }
            }
            // Prepare Media if present
            let mediaPath = null;
            if (activeBroadcast.media_id) {
                const media = await index_js_1.db.getOne(`SELECT storage_path FROM media_files WHERE id = ?`, [activeBroadcast.media_id]);
                if (media && media.storage_path) {
                    mediaPath = media.storage_path;
                }
            }
            // Send via WhatsApp Service
            let sendResult;
            if (mediaPath) {
                sendResult = await baileysService_js_1.whatsappService.sendImageMessage(recipient.phone_number, mediaPath, recipient.personalized_message);
            }
            else {
                sendResult = await baileysService_js_1.whatsappService.sendTextMessage(recipient.phone_number, recipient.personalized_message);
            }
            if (sendResult.success) {
                await index_js_1.db.execute(`UPDATE broadcast_recipients 
           SET status = 'sent', sent_at = CURRENT_TIMESTAMP, error_reason = NULL 
           WHERE id = ?`, [recipient.id]);
                // Record outgoing message
                await index_js_1.db.execute(`INSERT INTO outgoing_messages (broadcast_id, recipient_id, phone_number, message_type, content, media_path, status, baileys_message_id)
           VALUES (?, ?, ?, ?, ?, ?, 'sent', ?)`, [
                    activeBroadcast.id,
                    recipient.id,
                    recipient.phone_number,
                    mediaPath ? 'image' : 'text',
                    recipient.personalized_message,
                    mediaPath,
                    sendResult.messageId
                ]);
                await (0, logger_js_1.logSystem)('SUCCESS', 'MESSAGE', `Pesan terkirim ke ${recipient.phone_number} (${recipient.recipient_name || 'Tanpa Nama'})`);
            }
            else {
                // Failed sending
                const newAttempts = recipient.attempts + 1;
                const maxRetries = index_js_2.config.queue.maxRetries;
                if (newAttempts <= maxRetries) {
                    // Retry
                    await index_js_1.db.execute(`UPDATE broadcast_recipients 
             SET status = 'pending', attempts = ?, error_reason = ? 
             WHERE id = ?`, [newAttempts, `Coba ke-${newAttempts}: ${sendResult.error || 'Gagal terkirim'}`, recipient.id]);
                    await (0, logger_js_1.logSystem)('WARNING', 'MESSAGE', `Gagal kirim ke ${recipient.phone_number}. Akan dicoba ulang (${newAttempts}/${maxRetries}).`);
                }
                else {
                    // Permanently failed
                    await index_js_1.db.execute(`UPDATE broadcast_recipients 
             SET status = 'failed', attempts = ?, error_reason = ? 
             WHERE id = ?`, [newAttempts, sendResult.error || 'Gagal setelah batas maksimal retry', recipient.id]);
                    await (0, logger_js_1.logSystem)('ERROR', 'MESSAGE', `Pesan ke ${recipient.phone_number} gagal permanen: ${sendResult.error}`);
                }
            }
            await this.syncBroadcastCounters(activeBroadcast.id);
            this.emitProgress(activeBroadcast.id);
            // Delay rate limiting per message (anti-ban delay from Settings or Broadcast custom delay)
            let globalMinMs = index_js_2.config.queue.minDelayMs;
            let globalMaxMs = index_js_2.config.queue.maxDelayMs;
            try {
                const minRow = await index_js_1.db.getOne(`SELECT value_text FROM app_settings WHERE key_name = 'min_delay_ms'`);
                const maxRow = await index_js_1.db.getOne(`SELECT value_text FROM app_settings WHERE key_name = 'max_delay_ms'`);
                if (minRow && minRow.value_text) {
                    const parsed = parseInt(minRow.value_text, 10);
                    if (!isNaN(parsed) && parsed > 0) {
                        // Auto-detect: jika user input <= 300, itu adalah detik (contoh: 60 = 60 detik). Jika > 300, sudah ms (contoh: 60000 = 60 detik).
                        globalMinMs = parsed <= 300 ? parsed * 1000 : parsed;
                    }
                }
                if (maxRow && maxRow.value_text) {
                    const parsed = parseInt(maxRow.value_text, 10);
                    if (!isNaN(parsed) && parsed > 0) {
                        globalMaxMs = parsed <= 300 ? parsed * 1000 : parsed;
                    }
                }
            }
            catch (e) {
                // Fallback to config
            }
            if (globalMaxMs < globalMinMs) {
                globalMaxMs = globalMinMs;
            }
            let delay = this.getRandomDelay(globalMinMs, globalMaxMs);
            // If active broadcast has its own delay_seconds
            if (activeBroadcast.delay_seconds !== undefined && activeBroadcast.delay_seconds !== null && activeBroadcast.delay_seconds > 0) {
                const bcastDelayMs = activeBroadcast.delay_seconds * 1000;
                // Prioritaskan nilai jeda yang lebih besar antara setting broadcast dan setting global
                delay = Math.max(bcastDelayMs, globalMinMs);
            }
            // If test mode with minDelayMs === 0, keep it 0
            if (index_js_2.config.queue.minDelayMs === 0) {
                delay = 0;
            }
            if (delay > 0) {
                const delaySec = Math.round(delay / 1000);
                await (0, logger_js_1.logSystem)('INFO', 'BLAST', `Menunggu jeda ${delaySec} detik sebelum pengiriman ke nomor berikutnya...`);
                await this.sleep(delay);
            }
        }
        catch (err) {
            console.error(`Error processing recipient #${recipient.id}:`, err);
            await index_js_1.db.execute(`UPDATE broadcast_recipients SET status = 'failed', error_reason = ? WHERE id = ?`, [err.message || 'Server error', recipient.id]);
            await this.syncBroadcastCounters(activeBroadcast.id);
            this.emitProgress(activeBroadcast.id);
        }
        finally {
            this.isProcessing = false;
            this.currentRecipientInFlight = null;
        }
    }
    async syncBroadcastCounters(broadcastId) {
        const stats = await index_js_1.db.getOne(`SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
         SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped,
         SUM(CASE WHEN status IN ('pending', 'processing') THEN 1 ELSE 0 END) as pending
       FROM broadcast_recipients WHERE broadcast_id = ?`, [broadcastId]);
        if (stats) {
            await index_js_1.db.execute(`UPDATE broadcasts 
         SET total_recipients = ?, sent_count = ?, failed_count = ?, skipped_count = ?, pending_count = ?
         WHERE id = ?`, [stats.total || 0, stats.sent || 0, stats.failed || 0, stats.skipped || 0, stats.pending || 0, broadcastId]);
        }
    }
    async completeBroadcast(broadcastId, broadcastName) {
        await index_js_1.db.execute(`UPDATE broadcasts 
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP, pending_count = 0 
       WHERE id = ?`, [broadcastId]);
        await this.syncBroadcastCounters(broadcastId);
        const b = await index_js_1.db.getOne(`SELECT total_recipients, sent_count, failed_count, skipped_count, started_at, completed_at FROM broadcasts WHERE id = ?`, [broadcastId]);
        await (0, logger_js_1.logSystem)('SUCCESS', 'BLAST', `Broadcast #${broadcastId} (${broadcastName}) SELESAI.`);
        baileysService_js_1.whatsappService.notifyAdmins(`🏁 *LAPORAN BROADCAST SELESAI*\n\n` +
            `Nama: *${broadcastName}*\n` +
            `Total: ${b?.total_recipients || 0}\n` +
            `Berhasil: ${b?.sent_count || 0}\n` +
            `Gagal: ${b?.failed_count || 0}\n` +
            `Dilewati: ${b?.skipped_count || 0}\n` +
            `Status: *SELESAI*\n` +
            `Waktu Selesai: ${new Date().toLocaleTimeString('id-ID')}`);
        this.emitProgress(broadcastId);
    }
    emitProgress(broadcastId) {
        const io = (0, logger_js_1.getSocketIO)();
        if (!io)
            return;
        index_js_1.db.getOne(`SELECT id, broadcast_code, name, status, total_recipients, sent_count, failed_count, skipped_count, pending_count, started_at, completed_at
       FROM broadcasts WHERE id = ?`, [broadcastId]).then((b) => {
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
    async pauseBroadcast(broadcastId) {
        await index_js_1.db.execute(`UPDATE broadcasts SET status = 'paused', paused_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'running'`, [broadcastId]);
        await (0, logger_js_1.logSystem)('WARNING', 'BLAST', `Broadcast #${broadcastId} DIJEDA oleh admin.`);
        this.emitProgress(broadcastId);
        baileysService_js_1.whatsappService.notifyAdmins(`⏸️ *BROADCAST DIJEDA*\n\nBroadcast ID #${broadcastId} berhasil dijeda.`);
    }
    async resumeBroadcast(broadcastId) {
        await index_js_1.db.execute(`UPDATE broadcasts SET status = 'running', paused_at = NULL WHERE id = ? AND status = 'paused'`, [broadcastId]);
        await (0, logger_js_1.logSystem)('INFO', 'BLAST', `Broadcast #${broadcastId} DILANJUTKAN oleh admin.`);
        this.emitProgress(broadcastId);
        baileysService_js_1.whatsappService.notifyAdmins(`▶️ *BROADCAST DILANJUTKAN*\n\nBroadcast ID #${broadcastId} melanjutkan pengiriman.`);
    }
    async cancelBroadcast(broadcastId) {
        await index_js_1.db.execute(`UPDATE broadcasts SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('running', 'paused', 'queued')`, [broadcastId]);
        await (0, logger_js_1.logSystem)('WARNING', 'BLAST', `Broadcast #${broadcastId} DIBATALKAN.`);
        this.emitProgress(broadcastId);
        baileysService_js_1.whatsappService.notifyAdmins(`⏹️ *BROADCAST DIBATALKAN*\n\nBroadcast ID #${broadcastId} telah dibatalkan.`);
    }
    async retryFailed(broadcastId) {
        const res = await index_js_1.db.execute(`UPDATE broadcast_recipients 
       SET status = 'pending', attempts = 0, error_reason = NULL 
       WHERE broadcast_id = ? AND status = 'failed'`, [broadcastId]);
        await this.syncBroadcastCounters(broadcastId);
        // If completed or failed, reopen to running
        await index_js_1.db.execute(`UPDATE broadcasts SET status = 'running', completed_at = NULL WHERE id = ?`, [broadcastId]);
        this.emitProgress(broadcastId);
        return res.affectedRows;
    }
}
exports.broadcastQueueWorker = new BroadcastQueueWorker();
