"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappAdminController = exports.WhatsAppAdminController = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const os_1 = __importDefault(require("os"));
const index_js_1 = require("../../database/index.js");
const baileysService_js_1 = require("../whatsapp/baileysService.js");
const excelService_js_1 = require("../excel/excelService.js");
const broadcastQueueWorker_js_1 = require("../broadcast/broadcastQueueWorker.js");
const templateEngine_js_1 = require("../../utils/templateEngine.js");
const normalizer_js_1 = require("../../utils/normalizer.js");
const logger_js_1 = require("../../utils/logger.js");
const index_js_2 = require("../../config/index.js");
class WhatsAppAdminController {
    activeSessions = new Map();
    pendingConfirmations = new Map();
    init() {
        // Register message handler on WhatsApp Service
        baileysService_js_1.whatsappService.onIncomingMessage(async (msg) => {
            await this.handleIncomingMessage(msg);
        });
        (0, logger_js_1.logSystem)('INFO', 'ADMIN_BOT', 'WhatsApp Admin Controller siap menerima perintah.');
    }
    /**
     * Main incoming message handler
     */
    async handleIncomingMessage(msg) {
        // 1. REJECT GROUPS: Administrative commands only processed in private 1-on-1 chats
        if (msg.isGroup)
            return;
        const senderPhone = (0, normalizer_js_1.normalizePhoneNumber)(msg.senderPhone).normalized;
        const rawText = (msg.text || '').trim();
        // 2. CHECK OPT-OUT FROM NORMAL RECIPIENTS (e.g. "STOP", "BERHENTI", "UNSUBSCRIBE")
        if (rawText.toUpperCase() === 'STOP' || rawText.toUpperCase() === 'BERHENTI' || rawText.toUpperCase() === 'UNSUBSCRIBE') {
            await this.handleOptOut(senderPhone);
            return;
        }
        // 3. CHECK IF SENDER IS REGISTERED & ACTIVE ADMIN
        const admin = await index_js_1.db.getOne('SELECT * FROM whatsapp_admins WHERE phone_number = ? AND is_active = 1', [senderPhone]);
        if (!admin) {
            // Sender is not an authorized admin, silently ignore or don't process admin commands
            return;
        }
        await (0, logger_js_1.logAudit)(null, 'ADMIN_BOT_MESSAGE', 'whatsapp', { sender: senderPhone, text: rawText });
        // 4. CHECK IF ADMIN IS IN AN INTERACTIVE CONVERSATION STATE
        const session = this.activeSessions.get(senderPhone);
        if (session) {
            // Check timeout (15 minutes)
            if (Date.now() - session.createdAt > 15 * 60 * 1000) {
                this.activeSessions.delete(senderPhone);
            }
            else {
                const handled = await this.handleInteractiveSession(senderPhone, msg, session);
                if (handled)
                    return;
            }
        }
        // 5. PARSE DOCUMENT / EXCEL UPLOAD VIA WHATSAPP
        if (msg.messageType === 'document' && msg.mediaBuffer) {
            const isExcel = msg.fileName?.endsWith('.xlsx') ||
                msg.fileName?.endsWith('.xls') ||
                msg.fileName?.endsWith('.csv') ||
                msg.mimetype?.includes('spreadsheet') ||
                msg.mimetype?.includes('excel') ||
                msg.mimetype?.includes('csv');
            if (isExcel) {
                await this.handleExcelUploadFromChat(senderPhone, msg, admin);
                return;
            }
        }
        // 6. PROCESS COMMANDS
        if (!rawText.startsWith('!'))
            return;
        const [command, ...args] = rawText.split(' ');
        const cmdLower = command.toLowerCase();
        switch (cmdLower) {
            case '!menu':
            case '!help':
                await this.sendMenu(senderPhone);
                break;
            case '!status':
                await this.sendStatus(senderPhone);
                break;
            case '!excel':
                await this.handleExcelCommand(senderPhone, args, admin);
                break;
            case '!blast':
                await this.handleBlastCommand(senderPhone, rawText, args, msg, admin);
                break;
            case '!batal':
                this.activeSessions.delete(senderPhone);
                await baileysService_js_1.whatsappService.sendTextMessage(senderPhone, '✅ Sesi percakapan pembuatan broadcast telah dibatalkan.');
                break;
            default:
                await baileysService_js_1.whatsappService.sendTextMessage(senderPhone, `❓ Perintah tidak dikenali: *${command}*\nKetik *!menu* untuk melihat panduan perintah yang tersedia.`);
                break;
        }
    }
    /**
     * Handle Opt-Out request from recipient
     */
    async handleOptOut(phone) {
        const existing = await index_js_1.db.getOne('SELECT id FROM opt_outs WHERE phone_number = ?', [phone]);
        if (!existing) {
            await index_js_1.db.execute('INSERT INTO opt_outs (phone_number, reason) VALUES (?, ?)', [phone, 'Kirim STOP via WA']);
            await index_js_1.db.execute('UPDATE contact_consents SET status = \'revoked\' WHERE phone_number = ?', [phone]);
            await (0, logger_js_1.logSystem)('INFO', 'CONSENT', `Nomor ${phone} berhenti berlangganan (Opt-Out).`);
        }
        await baileysService_js_1.whatsappService.sendTextMessage(phone, 'Nomor Anda telah berhasil dikeluarkan dari daftar penerima pesan broadcast. Anda tidak akan lagi menerima pesan dari sistem ini. Terima kasih.');
    }
    /**
     * Send !menu response
     */
    async sendMenu(toPhone) {
        const text = `🤖 *WA BLAST MANAGER PRO - ADMIN CONTROLLER*\n\n` +
            `Gunakan perintah berikut di chat pribadi:\n\n` +
            `📊 *STATUS & MONITORING*\n` +
            `• *!status* - Status bot, koneksi WA, RAM, & uptime\n` +
            `• *!blast list* - Daftar broadcast aktif & riwayat\n` +
            `• *!blast status <ID>* - Progres broadcast ID tertentu\n\n` +
            `📁 *PENGELOLAAN EXCEL*\n` +
            `• *!excel list* - Daftar dataset Excel tersimpan\n` +
            `• *Kirim File Excel* + caption: \n` +
            `  *!excel simpan "Nama Dataset"*\n\n` +
            `🚀 *BROADCAST CEPAT*\n` +
            `• *!blast buat "Nama Dataset"*\n` +
            `• Atau format langsung:\n` +
            `  *!blast buat "Nama Dataset" | Teks Pesan*\n` +
            `• *!blast konfirmasi <KODE>* - Jalankan broadcast\n` +
            `• *!blast jeda <ID>* - Jeda pengiriman\n` +
            `• *!blast lanjut <ID>* - Lanjutkan pengiriman\n` +
            `• *!blast batal <ID>* - Batalkan broadcast\n` +
            `• *!batal* - Batalkan pembuatan broadcast interaktif`;
        await baileysService_js_1.whatsappService.sendTextMessage(toPhone, text);
    }
    /**
     * Send !status response
     */
    async sendStatus(toPhone) {
        const waInfo = baileysService_js_1.whatsappService.getAccountInfo();
        const totalMem = Math.round(os_1.default.totalmem() / 1024 / 1024);
        const freeMem = Math.round(os_1.default.freemem() / 1024 / 1024);
        const usedMem = totalMem - freeMem;
        const uptimeHrs = (os_1.default.uptime() / 3600).toFixed(1);
        const activeBlast = await index_js_1.db.getOne(`SELECT id, name, total_recipients, sent_count FROM broadcasts WHERE status = 'running' LIMIT 1`);
        const text = `🖥️ *STATUS SISTEM WA BLAST PRO*\n\n` +
            `📱 *Koneksi WhatsApp:*\n` +
            `• Status: *${waInfo.status.toUpperCase()}*\n` +
            `• Akun: ${waInfo.name || '-'} (${waInfo.phone || '-'})\n\n` +
            `⚡ *Performa Server:*\n` +
            `• RAM: ${usedMem} MB / ${totalMem} MB\n` +
            `• Uptime: ${uptimeHrs} jam\n` +
            `• Platform: ${os_1.default.platform()} (${os_1.default.arch()})\n\n` +
            `📢 *Antrean Broadcast:*\n` +
            (activeBlast
                ? `• Sedang Berjalan: *${activeBlast.name}* (#${activeBlast.id})\n• Progres: ${activeBlast.sent_count} / ${activeBlast.total_recipients}`
                : `• Tidak ada broadcast yang sedang berjalan.`);
        await baileysService_js_1.whatsappService.sendTextMessage(toPhone, text);
    }
    /**
     * Handle !excel commands
     */
    async handleExcelCommand(toPhone, args, admin) {
        const subCmd = (args[0] || '').toLowerCase();
        if (subCmd === 'list') {
            const datasets = await index_js_1.db.query(`SELECT id, name, total_rows, valid_rows, created_at FROM contact_datasets ORDER BY id DESC LIMIT 10`);
            if (datasets.length === 0) {
                await baileysService_js_1.whatsappService.sendTextMessage(toPhone, '📁 Belum ada dataset Excel yang tersimpan di sistem.');
                return;
            }
            let reply = `📁 *DAFTAR DATASET EXCEL (10 Terakhir)*\n\n`;
            datasets.forEach((ds, i) => {
                reply += `${i + 1}. *${ds.name}* (ID: ${ds.id})\n   Total: ${ds.total_rows} baris | Valid: ${ds.valid_rows}\n`;
            });
            reply += `\nUntuk membuat broadcast dari dataset di atas:\n*!blast buat "<Nama Dataset>"*`;
            await baileysService_js_1.whatsappService.sendTextMessage(toPhone, reply);
        }
        else {
            await baileysService_js_1.whatsappService.sendTextMessage(toPhone, `ℹ️ Gunakan perintah:\n• *!excel list* - Melihat dataset tersimpan\n• Kirim file Excel dengan caption *!excel simpan "Nama"* untuk mengupload.`);
        }
    }
    /**
     * Handle Excel file sent directly to WhatsApp bot with caption
     */
    async handleExcelUploadFromChat(toPhone, msg, admin) {
        const caption = (msg.caption || '').trim();
        if (!caption.startsWith('!excel simpan')) {
            await baileysService_js_1.whatsappService.sendTextMessage(toPhone, `⚠️ File Excel terdeteksi. Untuk menyimpannya ke database, kirim ulang file tersebut dengan caption:\n*!excel simpan "Nama Dataset Anda"*`);
            return;
        }
        // Extract name from quotes or after command
        const match = caption.match(/!excel\s+simpan\s+["']?([^"']+)["']?/i);
        const datasetName = match ? match[1].trim() : `Upload WA ${new Date().toLocaleDateString('id-ID')}`;
        try {
            await baileysService_js_1.whatsappService.sendTextMessage(toPhone, `⏳ Sedang memproses file Excel: *${datasetName}*...`);
            const parseResult = await excelService_js_1.ExcelService.parseExcelFile(msg.mediaBuffer);
            const saveResult = await excelService_js_1.ExcelService.saveDatasetToDb(datasetName, msg.fileName || 'upload_wa.xlsx', parseResult, `WA Admin (${admin.name})`);
            const reply = `✅ *DATASET BERHASIL DIIMPOR*\n\n` +
                `• Nama: *${datasetName}*\n` +
                `• ID Dataset: ${saveResult.datasetId}\n` +
                `• Total baris: ${parseResult.totalRows}\n` +
                `• Nomor valid: ${saveResult.validRows}\n` +
                `• Nomor tidak valid / duplikat: ${saveResult.invalidRows}\n\n` +
                `Dataset langsung tersedia di dashboard website.\n` +
                `Untuk memulai broadcast dengan data ini, ketik:\n` +
                `*!blast buat "${datasetName}"*`;
            await baileysService_js_1.whatsappService.sendTextMessage(toPhone, reply);
        }
        catch (err) {
            await baileysService_js_1.whatsappService.sendTextMessage(toPhone, `❌ Gagal memproses file Excel: ${err.message}`);
        }
    }
    /**
     * Handle !blast commands
     */
    async handleBlastCommand(toPhone, rawText, args, msg, admin) {
        const subCmd = (args[0] || '').toLowerCase();
        if (subCmd === 'list') {
            const blasts = await index_js_1.db.query(`SELECT id, name, status, total_recipients, sent_count FROM broadcasts ORDER BY id DESC LIMIT 10`);
            if (blasts.length === 0) {
                await baileysService_js_1.whatsappService.sendTextMessage(toPhone, '📢 Belum ada data riwayat broadcast.');
                return;
            }
            let reply = `📢 *RIWAYAT & STATUS BROADCAST (10 Terakhir)*\n\n`;
            for (const b of blasts) {
                reply += `• *[#${b.id}] ${b.name}*\n  Status: *${b.status.toUpperCase()}* | Terkirim: ${b.sent_count}/${b.total_recipients}\n`;
            }
            reply += `\nPerintah kontrol:\n• *!blast status <ID>*\n• *!blast jeda <ID>*\n• *!blast lanjut <ID>*\n• *!blast batal <ID>*`;
            await baileysService_js_1.whatsappService.sendTextMessage(toPhone, reply);
            return;
        }
        if (subCmd === 'status') {
            const blastId = parseInt(args[1], 10);
            if (!blastId) {
                await baileysService_js_1.whatsappService.sendTextMessage(toPhone, '⚠️ Format salah. Gunakan: *!blast status <ID>*');
                return;
            }
            const b = await index_js_1.db.getOne(`SELECT * FROM broadcasts WHERE id = ?`, [blastId]);
            if (!b) {
                await baileysService_js_1.whatsappService.sendTextMessage(toPhone, `❌ Broadcast ID #${blastId} tidak ditemukan.`);
                return;
            }
            const percent = b.total_recipients > 0 ? Math.round(((b.sent_count + b.failed_count + b.skipped_count) / b.total_recipients) * 100) : 0;
            const reply = `📊 *STATUS BROADCAST #${b.id}*\n\n` +
                `• Nama: *${b.name}*\n` +
                `• Status: *${b.status.toUpperCase()}*\n` +
                `• Total: ${b.total_recipients}\n` +
                `• Berhasil: ${b.sent_count}\n` +
                `• Gagal: ${b.failed_count}\n` +
                `• Dilewati: ${b.skipped_count}\n` +
                `• Menunggu: ${b.pending_count}\n` +
                `• Progres: *${percent}%*`;
            await baileysService_js_1.whatsappService.sendTextMessage(toPhone, reply);
            return;
        }
        if (subCmd === 'jeda') {
            const blastId = parseInt(args[1], 10);
            if (!blastId)
                return;
            await broadcastQueueWorker_js_1.broadcastQueueWorker.pauseBroadcast(blastId);
            await baileysService_js_1.whatsappService.sendTextMessage(toPhone, `⏸️ Broadcast #${blastId} berhasil dijeda.`);
            return;
        }
        if (subCmd === 'lanjut') {
            const blastId = parseInt(args[1], 10);
            if (!blastId)
                return;
            await broadcastQueueWorker_js_1.broadcastQueueWorker.resumeBroadcast(blastId);
            await baileysService_js_1.whatsappService.sendTextMessage(toPhone, `▶️ Broadcast #${blastId} berhasil dilanjutkan.`);
            return;
        }
        if (subCmd === 'batal') {
            const blastId = parseInt(args[1], 10);
            if (!blastId)
                return;
            await broadcastQueueWorker_js_1.broadcastQueueWorker.cancelBroadcast(blastId);
            await baileysService_js_1.whatsappService.sendTextMessage(toPhone, `⏹️ Broadcast #${blastId} berhasil dibatalkan.`);
            return;
        }
        if (subCmd === 'konfirmasi') {
            const code = (args[1] || '').trim().toUpperCase();
            await this.handleConfirmation(toPhone, code, admin);
            return;
        }
        if (subCmd === 'buat') {
            // Check if one-liner format with '|'
            // e.g.: !blast buat "Data Undangan November" | Halo {{B}}, berikut undangan...
            if (rawText.includes('|')) {
                await this.handleOneLinerBlast(toPhone, rawText, msg, admin);
            }
            else {
                await this.handleInteractiveStart(toPhone, rawText, admin);
            }
            return;
        }
        await baileysService_js_1.whatsappService.sendTextMessage(toPhone, 'Ketik *!menu* untuk melihat panduan penggunaan broadcast.');
    }
    /**
     * Interactive creation step 1: !blast buat "Nama Dataset"
     */
    async handleInteractiveStart(toPhone, rawText, admin) {
        const match = rawText.match(/!blast\s+buat\s+["']?([^"']+)["']?/i);
        if (!match) {
            await baileysService_js_1.whatsappService.sendTextMessage(toPhone, `⚠️ Format salah. Contoh penggunaan:\n*!blast buat "Data Undangan November"*`);
            return;
        }
        const dsName = match[1].trim();
        const dataset = await index_js_1.db.getOne(`SELECT id, name, valid_rows FROM contact_datasets WHERE name LIKE ? ORDER BY id DESC LIMIT 1`, [`%${dsName}%`]);
        if (!dataset) {
            await baileysService_js_1.whatsappService.sendTextMessage(toPhone, `❌ Dataset "${dsName}" tidak ditemukan.\nKetik *!excel list* untuk melihat daftar dataset yang ada.`);
            return;
        }
        // Set interactive state
        this.activeSessions.set(toPhone, {
            stage: 'awaiting_message',
            datasetId: dataset.id,
            datasetName: dataset.name,
            createdAt: Date.now()
        });
        await baileysService_js_1.whatsappService.sendTextMessage(toPhone, `✅ Dataset *"${dataset.name}"* ditemukan (${dataset.valid_rows} kontak valid).\n\n` +
            `Silakan balas dengan *teks template pesan* yang akan digunakan.\n` +
            `Contoh variabel: {{B}} untuk nama, {{C}} untuk keterangan, {{A}} untuk nomor.\n\n` +
            `Ketik *!batal* kapan saja untuk membatalkan.`);
    }
    /**
     * Handle interactive multi-step session responses
     */
    async handleInteractiveSession(toPhone, msg, session) {
        const rawText = (msg.text || '').trim();
        if (session.stage === 'awaiting_message') {
            if (rawText.startsWith('!batal')) {
                this.activeSessions.delete(toPhone);
                await baileysService_js_1.whatsappService.sendTextMessage(toPhone, 'Pembuatan broadcast dibatalkan.');
                return true;
            }
            session.templateText = rawText;
            session.stage = 'awaiting_media';
            await baileysService_js_1.whatsappService.sendTextMessage(toPhone, `✅ Template pesan tersimpan!\n\n` +
                `Sekarang silakan *kirim gambar* yang ingin dilampirkan, atau ketik *!tanpagambar* jika hanya ingin mengirim teks saja.`);
            return true;
        }
        if (session.stage === 'awaiting_media') {
            let mediaPath;
            if (rawText.toLowerCase() === '!tanpagambar') {
                mediaPath = undefined;
            }
            else if (msg.messageType === 'image' && msg.mediaBuffer) {
                // Save image to upload directory
                const filename = `wa_admin_${Date.now()}.jpg`;
                mediaPath = path_1.default.join(index_js_2.config.storage.uploadDir, filename);
                fs_1.default.writeFileSync(mediaPath, msg.mediaBuffer);
                // Record to media_files
                await index_js_1.db.execute(`INSERT INTO media_files (filename, original_name, mime_type, file_size, storage_path)
           VALUES (?, ?, ?, ?, ?)`, [filename, filename, msg.mimetype || 'image/jpeg', msg.mediaBuffer.length, mediaPath]);
            }
            else {
                await baileysService_js_1.whatsappService.sendTextMessage(toPhone, `⚠️ Harap kirim gambar (JPG/PNG) atau ketik *!tanpagambar* untuk lanjut.`);
                return true;
            }
            // Finish session and generate preview & confirmation
            this.activeSessions.delete(toPhone);
            await this.createPendingConfirmation(toPhone, session.datasetId, session.datasetName, session.templateText || '', mediaPath);
            return true;
        }
        return false;
    }
    /**
     * Handle one-liner: !blast buat "Nama Dataset" | Halo {{B}}, ...
     */
    async handleOneLinerBlast(toPhone, rawText, msg, admin) {
        const parts = rawText.split('|');
        const firstPart = parts[0];
        const messageTemplate = parts.slice(1).join('|').trim();
        const match = firstPart.match(/!blast\s+buat\s+["']?([^"']+)["']?/i);
        if (!match || !messageTemplate) {
            await baileysService_js_1.whatsappService.sendTextMessage(toPhone, `⚠️ Format tidak valid. Contoh:\n*!blast buat "Data Relawan" | Halo {{B}}, berikut informasinya.*`);
            return;
        }
        const dsName = match[1].trim();
        const dataset = await index_js_1.db.getOne(`SELECT id, name FROM contact_datasets WHERE name LIKE ? ORDER BY id DESC LIMIT 1`, [`%${dsName}%`]);
        if (!dataset) {
            await baileysService_js_1.whatsappService.sendTextMessage(toPhone, `❌ Dataset "${dsName}" tidak ditemukan.`);
            return;
        }
        // Handle image if attached with the message
        let mediaPath;
        if (msg.messageType === 'image' && msg.mediaBuffer) {
            const filename = `wa_admin_${Date.now()}.jpg`;
            mediaPath = path_1.default.join(index_js_2.config.storage.uploadDir, filename);
            fs_1.default.writeFileSync(mediaPath, msg.mediaBuffer);
            await index_js_1.db.execute(`INSERT INTO media_files (filename, original_name, mime_type, file_size, storage_path)
         VALUES (?, ?, ?, ?, ?)`, [filename, filename, msg.mimetype || 'image/jpeg', msg.mediaBuffer.length, mediaPath]);
        }
        await this.createPendingConfirmation(toPhone, dataset.id, dataset.name, messageTemplate, mediaPath);
    }
    /**
     * Build confirmation summary, recipient count, and preview
     */
    async createPendingConfirmation(toPhone, datasetId, datasetName, templateText, mediaPath) {
        // Generate secure unique confirmation code
        const uniqueCode = `CFM-${crypto_1.default.randomBytes(3).toString('hex').toUpperCase()}`;
        // Get sample recipient for preview
        const sampleContact = await index_js_1.db.getOne(`SELECT * FROM contacts WHERE dataset_id = ? AND is_valid = 1 ORDER BY id ASC LIMIT 1`, [datasetId]);
        // Count eligible contacts
        const totalValid = await index_js_1.db.getOne(`SELECT COUNT(*) as count FROM contacts WHERE dataset_id = ? AND is_valid = 1`, [datasetId]);
        const eligibleCount = totalValid?.count || 0;
        const skippedCount = 0; // calculated dynamically
        let previewText = '(Tidak ada data preview)';
        if (sampleContact) {
            let extraData = {};
            try {
                extraData = JSON.parse(sampleContact.extra_data_json || '{}');
            }
            catch (e) {
                extraData = { A: sampleContact.phone_number, B: sampleContact.name, C: sampleContact.notes };
            }
            const res = (0, templateEngine_js_1.resolveTemplate)(templateText, extraData);
            previewText = res.text;
        }
        this.pendingConfirmations.set(uniqueCode, {
            uniqueCode,
            datasetId,
            datasetName,
            messageText: templateText,
            mediaPath,
            eligibleCount,
            skippedCount,
            adminPhone: toPhone,
            createdAt: Date.now()
        });
        const summary = `📢 *BROADCAST SIAP DIJALANKAN*\n\n` +
            `• Dataset: *${datasetName}*\n` +
            `• Total kontak valid: *${eligibleCount}*\n` +
            `• Gambar: ${mediaPath ? '✅ Terlampir' : '❌ Tanpa gambar'}\n` +
            `• Pesan:\n${templateText}\n\n` +
            `🔍 *Preview untuk ${sampleContact?.name || 'Penerima Pertama'}:*\n` +
            `"${previewText}"\n\n` +
            `👉 Balas:\n` +
            `*!blast konfirmasi ${uniqueCode}*\n\n` +
            `untuk memulai pengiriman antrean.`;
        await baileysService_js_1.whatsappService.sendTextMessage(toPhone, summary);
    }
    /**
     * Handle confirmation command: !blast konfirmasi <unique_code>
     */
    async handleConfirmation(toPhone, code, admin) {
        const pending = this.pendingConfirmations.get(code);
        if (!pending) {
            await baileysService_js_1.whatsappService.sendTextMessage(toPhone, `❌ Kode konfirmasi *${code}* tidak ditemukan atau telah kedaluwarsa.\nSilakan ulangi pembuatan broadcast.`);
            return;
        }
        // Ensure only authorized admin can confirm
        this.pendingConfirmations.delete(code);
        await baileysService_js_1.whatsappService.sendTextMessage(toPhone, `⏳ Menyiapkan antrean broadcast untuk *${pending.datasetName}*...`);
        try {
            // 1. Get media_id if present
            let mediaId = null;
            if (pending.mediaPath) {
                const media = await index_js_1.db.getOne(`SELECT id FROM media_files WHERE storage_path = ?`, [pending.mediaPath]);
                mediaId = media?.id || null;
            }
            // 2. Insert into broadcasts table
            const broadcastCode = `BC-${Date.now().toString(36).toUpperCase()}`;
            const blastRes = await index_js_1.db.execute(`INSERT INTO broadcasts (broadcast_code, name, dataset_id, custom_message, media_id, delay_seconds, status, created_by_admin_id)
         VALUES (?, ?, ?, ?, ?, 4, 'running', ?)`, [
                broadcastCode,
                `Broadcast WA ${pending.datasetName}`,
                pending.datasetId,
                pending.messageText,
                mediaId,
                admin.id
            ]);
            const broadcastId = blastRes.insertId;
            // 3. Fetch all valid contacts for this dataset
            const contacts = await index_js_1.db.query(`SELECT * FROM contacts WHERE dataset_id = ? AND is_valid = 1`, [pending.datasetId]);
            // 4. Populate broadcast_recipients
            for (const contact of contacts) {
                let extraData = {};
                try {
                    extraData = JSON.parse(contact.extra_data_json || '{}');
                }
                catch (e) {
                    extraData = { A: contact.phone_number, B: contact.name, C: contact.notes };
                }
                const resolved = (0, templateEngine_js_1.resolveTemplate)(pending.messageText, extraData);
                const idempotencyKey = `${broadcastId}_${contact.id}_${contact.phone_number}`;
                await index_js_1.db.execute(`INSERT INTO broadcast_recipients (broadcast_id, contact_id, phone_number, recipient_name, personalized_message, status, idempotency_key)
           VALUES (?, ?, ?, ?, ?, 'pending', ?)`, [broadcastId, contact.id, contact.phone_number, contact.name, resolved.text, idempotencyKey]);
            }
            // 5. Update counters
            await broadcastQueueWorker_js_1.broadcastQueueWorker.syncBroadcastCounters(broadcastId);
            await index_js_1.db.execute(`UPDATE broadcasts SET started_at = CURRENT_TIMESTAMP WHERE id = ?`, [broadcastId]);
            await (0, logger_js_1.logSystem)('INFO', 'BLAST', `Broadcast #${broadcastId} (${pending.datasetName}) dibuat & dimulai oleh WA Admin ${admin.name}.`);
            await baileysService_js_1.whatsappService.sendTextMessage(toPhone, `🚀 *BROADCAST BERHASIL DIMULAI!*\n\n` +
                `• ID Broadcast: #${broadcastId}\n` +
                `• Kode: ${broadcastCode}\n` +
                `• Total antrean: ${contacts.length} pesan\n\n` +
                `Progres dapat dipantau melalui website atau ketik:\n` +
                `*!blast status ${broadcastId}*`);
        }
        catch (err) {
            await baileysService_js_1.whatsappService.sendTextMessage(toPhone, `❌ Gagal memulai broadcast: ${err.message}`);
        }
    }
}
exports.WhatsAppAdminController = WhatsAppAdminController;
exports.whatsappAdminController = new WhatsAppAdminController();
