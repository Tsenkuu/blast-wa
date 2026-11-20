import { IWhatsAppAdapter, WhatsAppAccountInfo, WhatsAppIncomingMessage, SendMessageResult } from './whatsappAdapter.js';
import { BaileysAdapter } from './baileysAdapter.js';
import { MockWhatsAppAdapter } from './mockAdapter.js';
import { db } from '../../database/index.js';
import { logSystem } from '../../utils/logger.js';
import { getSocketIO } from '../../utils/logger.js';

class WhatsAppService {
  private adapter: IWhatsAppAdapter;
  private isMockMode: boolean = false;
  private initialized: boolean = false;
  private incomingMessageHandlers: Array<(msg: WhatsAppIncomingMessage) => Promise<void>> = [];

  constructor() {
    // Check if running in mock/test mode
    if (process.env.WA_USE_MOCK === 'true' || process.env.NODE_ENV === 'test') {
      this.adapter = new MockWhatsAppAdapter();
      this.isMockMode = true;
    } else {
      this.adapter = new BaileysAdapter();
    }
  }

  public setAdapter(adapter: IWhatsAppAdapter): void {
    this.adapter = adapter;
    this.setupListeners();
    for (const h of this.incomingMessageHandlers) {
      this.adapter.onIncomingMessage(h);
    }
  }

  public getAdapter(): IWhatsAppAdapter {
    return this.adapter;
  }

  public async init(): Promise<void> {
    if (this.initialized) return;

    await this.adapter.init();
    this.setupListeners();
    this.initialized = true;

    // Check if session was previously active in DB and attempt reconnection
    try {
      const activeSession = await db.getOne<{ id: number; status: string; is_active: number }>(
        'SELECT id, status, is_active FROM whatsapp_sessions WHERE session_name = ?',
        ['default']
      );

      if (activeSession && activeSession.status === 'connected' && activeSession.is_active === 1) {
        logSystem('INFO', 'WHATSAPP', 'Sesi sebelumnya terdeteksi aktif. Menyambungkan kembali...');
        this.connect().catch((err) => {
          logSystem('WARNING', 'WHATSAPP', `Gagal menghubungkan sesi tersimpan: ${err.message}`);
        });
      }
    } catch (e) {
      // Ignore DB error during initial bootstrap
    }
  }

  private setupListeners(): void {
    this.adapter.onConnectionChange(async (info) => {
      await this.handleConnectionChange(info);
    });
  }

  private async handleConnectionChange(info: WhatsAppAccountInfo): Promise<void> {
    const io = getSocketIO();
    if (io) {
      io.emit('wa:status', {
        status: info.status,
        phone: info.phone,
        name: info.name,
        qrCode: info.qrCode
      });
    }

    try {
      const existing = await db.getOne('SELECT id FROM whatsapp_sessions WHERE session_name = ?', ['default']);
      if (existing) {
        await db.execute(
          `UPDATE whatsapp_sessions SET 
             phone_number = ?, 
             push_name = ?, 
             status = ?, 
             qr_code = ?, 
             last_connected_at = CASE WHEN ? = 'connected' THEN CURRENT_TIMESTAMP ELSE last_connected_at END,
             updated_at = CURRENT_TIMESTAMP
           WHERE session_name = ?`,
          [info.phone, info.name, info.status, info.qrCode, info.status, 'default']
        );
      } else {
        await db.execute(
          `INSERT INTO whatsapp_sessions (session_name, phone_number, push_name, status, qr_code, is_active) 
           VALUES (?, ?, ?, ?, ?, 1)`,
          ['default', info.phone, info.name, info.status, info.qrCode]
        );
      }
    } catch (err) {
      console.error('Failed to update whatsapp_sessions in DB:', err);
    }

    if (info.status === 'connected') {
      await logSystem('SUCCESS', 'WHATSAPP', `WhatsApp Terhubung: ${info.phone} (${info.name})`);
      this.notifyAdmins(`🟢 *NOTIFIKASI SISTEM*\n\nWhatsApp Bot berhasil TERHUBUNG!\nNomor: ${info.phone}\nNama: ${info.name}\nWaktu: ${new Date().toLocaleString('id-ID')}`);
    } else if (info.status === 'disconnected') {
      await logSystem('WARNING', 'WHATSAPP', 'WhatsApp Terputus sementara.');
    } else if (info.status === 'logged_out') {
      await logSystem('ERROR', 'WHATSAPP', 'Sesi WhatsApp telah Logout. Silakan scan ulang QR.');
      this.notifyAdmins(`🔴 *NOTIFIKASI SISTEM*\n\nSesi WhatsApp telah KELUAR / LOGOUT.\nSilakan buka dashboard website dan scan ulang QR code.`);
    }
  }

  public async notifyAdmins(messageText: string): Promise<void> {
    try {
      const admins = await db.query<{ phone_number: string; notify_on_events: number }>(
        'SELECT phone_number, notify_on_events FROM whatsapp_admins WHERE is_active = 1 AND notify_on_events = 1'
      );

      for (const admin of admins) {
        await this.adapter.sendTextMessage(admin.phone_number, messageText);
        await db.execute(
          'INSERT INTO notification_logs (admin_phone, event_type, message, status) VALUES (?, ?, ?, ?)',
          [admin.phone_number, 'SYSTEM_ALERT', messageText, 'sent']
        );
      }
    } catch (err) {
      console.error('Failed to notify admins:', err);
    }
  }

  public async connect(): Promise<void> {
    await logSystem('INFO', 'WHATSAPP', 'Memulai koneksi WhatsApp...');
    await this.adapter.connect();
  }

  public async disconnect(): Promise<void> {
    await logSystem('INFO', 'WHATSAPP', 'Memutuskan koneksi WhatsApp...');
    await this.adapter.disconnect();
  }

  public async logout(): Promise<void> {
    await logSystem('WARNING', 'WHATSAPP', 'Mengeluarkan sesi WhatsApp (Logout)...');
    await this.adapter.logout();
  }

  public getAccountInfo(): WhatsAppAccountInfo {
    return this.adapter.getAccountInfo();
  }

  public async sendTextMessage(toPhone: string, text: string): Promise<SendMessageResult> {
    return this.adapter.sendTextMessage(toPhone, text);
  }

  public async sendImageMessage(toPhone: string, imagePath: string, caption?: string): Promise<SendMessageResult> {
    return this.adapter.sendImageMessage(toPhone, imagePath, caption);
  }

  public onIncomingMessage(handler: (msg: WhatsAppIncomingMessage) => Promise<void>): void {
    this.incomingMessageHandlers.push(handler);
    this.adapter.onIncomingMessage(handler);
  }
}

export const whatsappService = new WhatsAppService();
