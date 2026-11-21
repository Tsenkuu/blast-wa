import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
  Browsers,
  proto,
  WASocket
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import {
  IWhatsAppAdapter,
  WhatsAppAccountInfo,
  WhatsAppIncomingMessage,
  SendMessageResult,
  ConnectionState
} from './whatsappAdapter.js';
import { config } from '../../config/index.js';
import { formatToWhatsAppJid, extractPhoneFromJid } from '../../utils/normalizer.js';

export class BaileysAdapter implements IWhatsAppAdapter {
  private socket: WASocket | null = null;
  private status: ConnectionState = 'disconnected';
  private qrCode: string | null = null;
  private jid: string | null = null;
  private phone: string | null = null;
  private pushName: string | null = null;
  private incomingHandlers: Array<(msg: WhatsAppIncomingMessage) => Promise<void>> = [];
  private connectionChangeHandlers: Array<(info: WhatsAppAccountInfo) => void> = [];
  private reconnectAttempts = 0;
  private maxAutoReconnectAttempts = 5;
  private isExplicitDisconnect = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  public async init(): Promise<void> {
    if (!fs.existsSync(config.storage.sessionsDir)) {
      fs.mkdirSync(config.storage.sessionsDir, { recursive: true });
    }
  }

  public getAccountInfo(): WhatsAppAccountInfo {
    return {
      jid: this.jid,
      phone: this.phone,
      name: this.pushName,
      status: this.status,
      qrCode: this.qrCode
    };
  }

  public onIncomingMessage(handler: (msg: WhatsAppIncomingMessage) => Promise<void>): void {
    this.incomingHandlers.push(handler);
  }

  public onConnectionChange(handler: (info: WhatsAppAccountInfo) => void): void {
    this.connectionChangeHandlers.push(handler);
  }

  private notifyConnectionChange(): void {
    const info = this.getAccountInfo();
    for (const handler of this.connectionChangeHandlers) {
      try {
        handler(info);
      } catch (e) {
        console.error('Error in connectionChange handler:', e);
      }
    }
  }

  private async cleanupSocket(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.socket) {
      try {
        this.socket.ev.removeAllListeners('connection.update');
        this.socket.ev.removeAllListeners('creds.update');
        this.socket.ev.removeAllListeners('messages.upsert');
        this.socket.end(undefined);
      } catch (e) {
        // Safe ignore
      }
      this.socket = null;
    }
  }

  public forceClearSessionsDir(): void {
    try {
      if (fs.existsSync(config.storage.sessionsDir)) {
        const files = fs.readdirSync(config.storage.sessionsDir);
        for (const file of files) {
          const filePath = path.join(config.storage.sessionsDir, file);
          try {
            if (fs.lstatSync(filePath).isDirectory()) {
              fs.rmSync(filePath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
            } else {
              try { fs.writeFileSync(filePath, ''); } catch (_) {}
              fs.unlinkSync(filePath);
            }
          } catch (e) {
            console.warn(`[Baileys] Gagal menghapus berkas sesi ${file}:`, e);
          }
        }
      } else {
        fs.mkdirSync(config.storage.sessionsDir, { recursive: true });
      }
      console.log('[Baileys] Berkas sesi berhasil dibersihkan total.');
    } catch (err) {
      console.error('[Baileys] Error membersihkan folder sesi:', err);
    }
  }

  public async connect(): Promise<void> {
    this.isExplicitDisconnect = false;

    // Clean up any stale socket instance before creating a new one
    await this.cleanupSocket();

    this.status = 'connecting';
    this.notifyConnectionChange();

    try {
      if (!fs.existsSync(config.storage.sessionsDir)) {
        fs.mkdirSync(config.storage.sessionsDir, { recursive: true });
      }

      // Check if creds.json exists and is corrupted or empty
      const credsPath = path.join(config.storage.sessionsDir, 'creds.json');
      if (fs.existsSync(credsPath)) {
        try {
          const raw = fs.readFileSync(credsPath, 'utf8');
          if (!raw || raw.trim() === '' || raw.trim() === '{}') {
            fs.unlinkSync(credsPath);
          }
        } catch (_) {
          try { fs.unlinkSync(credsPath); } catch (__) {}
        }
      }

      let authState;
      try {
        authState = await useMultiFileAuthState(config.storage.sessionsDir);
      } catch (authErr) {
        console.warn('[Baileys] Sesi auth rusak/tidak valid. Mengosongkan folder sesi untuk pairing baru...', authErr);
        this.forceClearSessionsDir();
        authState = await useMultiFileAuthState(config.storage.sessionsDir);
      }

      const { state, saveCreds } = authState;

      let version = [2, 3000, 1043857760] as any;
      try {
        const fetched = await fetchLatestBaileysVersion();
        if (fetched?.version) {
          version = fetched.version;
        }
      } catch (e) {
        console.warn('[Baileys] Gagal mengambil versi terbaru Baileys, menggunakan versi fallback stabil.');
      }

      this.socket = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        browser: Browsers.ubuntu('Chrome')
      });

      this.socket.ev.on('creds.update', saveCreds);

      this.socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            this.qrCode = await QRCode.toDataURL(qr);
            this.status = 'connecting';
            console.log('[Baileys] QR code baru berhasil di-generate.');
            this.notifyConnectionChange();
          } catch (err) {
            console.error('Error generating QR code data URL:', err);
          }
        }

        if (connection === 'close') {
          this.qrCode = null;
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          console.log(`[Baileys] Koneksi terputus dengan statusCode: ${statusCode}`);

          if (statusCode === DisconnectReason.loggedOut || statusCode === 401 || statusCode === 403) {
            console.log('[Baileys] Sesi telah logout / ditolak WhatsApp (401/403). Membersihkan kredensial lama...');
            await this.cleanupSocket();
            this.forceClearSessionsDir();

            this.status = 'connecting';
            this.jid = null;
            this.phone = null;
            this.pushName = null;
            this.notifyConnectionChange();

            // Auto-trigger fresh connect agar QR code baru langsung muncul di layar user tanpa stuck di logged_out
            console.log('[Baileys] Menyiapkan inisialisasi sesi bersih untuk generate QR code...');
            if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = setTimeout(() => {
              this.connect().catch((e) => console.error('[Baileys] Fresh pairing connect failed:', e));
            }, 1000);
            return;
          } else if (statusCode === DisconnectReason.restartRequired) {
            // Error code 515: Baileys handshake required restart. Immediate reconnection without resetting auth!
            console.log('[Baileys] Status 515 (Restart Required). Mengkoneksi ulang secara otomatis...');
            this.status = 'connecting';
            this.notifyConnectionChange();
            this.reconnectTimeout = setTimeout(() => {
              this.connect().catch((err) => console.error('[Baileys] Reconnect after 515 failed:', err));
            }, 800);
          } else if (statusCode === DisconnectReason.connectionReplaced) {
            console.warn('[Baileys] Sesi digantikan oleh koneksi WhatsApp Web lain (440). Hentikan auto-reconnect.');
            this.status = 'disconnected';
            this.notifyConnectionChange();
          } else {
            this.status = 'disconnected';
            this.notifyConnectionChange();

            // Auto-reconnect if not explicit disconnect and not exceeded max attempts
            if (!this.isExplicitDisconnect && this.reconnectAttempts < this.maxAutoReconnectAttempts) {
              this.reconnectAttempts++;
              const delay = Math.min(3000 * this.reconnectAttempts, 15000);
              console.log(`[Baileys] Disconnected sementara. Auto-reconnecting dalam ${delay}ms (upaya ${this.reconnectAttempts}/${this.maxAutoReconnectAttempts})...`);
              
              if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
              this.reconnectTimeout = setTimeout(() => {
                if (this.status !== 'connected' && !this.isExplicitDisconnect) {
                  this.connect().catch((e) => console.error('[Baileys] Auto-reconnect attempt failed:', e));
                }
              }, delay);
            }
          }
        } else if (connection === 'open') {
          this.reconnectAttempts = 0;
          if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
          }
          this.status = 'connected';
          this.qrCode = null;

          const userJid = this.socket?.user?.id || '';
          this.jid = userJid;
          this.phone = extractPhoneFromJid(userJid);
          this.pushName = this.socket?.user?.name || 'WA Blast Bot';

          console.log(`[Baileys] WhatsApp Connected! User: ${this.phone} (${this.pushName})`);
          this.notifyConnectionChange();
        }
      });

      // Handle incoming messages
      this.socket.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
          if (!msg.message || msg.key.fromMe) continue;

          const fromJid = msg.key.remoteJid || '';
          const isGroup = fromJid.endsWith('@g.us');
          const senderPhone = extractPhoneFromJid(msg.key.participant || fromJid);
          const pushName = msg.pushName || senderPhone;

          let messageType: 'text' | 'image' | 'document' | 'unknown' = 'unknown';
          let text: string | undefined;
          let caption: string | undefined;
          let mediaBuffer: Buffer | undefined;
          let fileName: string | undefined;
          let mimetype: string | undefined;

          if (msg.message.conversation) {
            messageType = 'text';
            text = msg.message.conversation;
          } else if (msg.message.extendedTextMessage) {
            messageType = 'text';
            text = msg.message.extendedTextMessage.text || '';
          } else if (msg.message.imageMessage) {
            messageType = 'image';
            caption = msg.message.imageMessage.caption || '';
            mimetype = msg.message.imageMessage.mimetype || 'image/jpeg';
            try {
              mediaBuffer = (await downloadMediaMessage(msg as any, 'buffer', {})) as Buffer;
            } catch (err) {
              console.error('Failed to download incoming image:', err);
            }
          } else if (msg.message.documentMessage) {
            messageType = 'document';
            caption = msg.message.documentMessage.caption || '';
            fileName = msg.message.documentMessage.fileName || 'file.bin';
            mimetype = msg.message.documentMessage.mimetype || 'application/octet-stream';
            try {
              mediaBuffer = (await downloadMediaMessage(msg as any, 'buffer', {})) as Buffer;
            } catch (err) {
              console.error('Failed to download incoming document:', err);
            }
          }

          const incomingPayload: WhatsAppIncomingMessage = {
            fromJid,
            senderPhone,
            pushName,
            isGroup,
            messageType,
            text: text || caption,
            caption,
            mediaBuffer,
            fileName,
            mimetype,
            rawMessage: msg
          };

          for (const handler of this.incomingHandlers) {
            try {
              await handler(incomingPayload);
            } catch (err) {
              console.error('Error in message handler:', err);
            }
          }
        }
      });
    } catch (err: any) {
      this.status = 'disconnected';
      this.notifyConnectionChange();
      console.error('[Baileys] Connect error:', err);
      throw err;
    }
  }

  public async disconnect(): Promise<void> {
    this.isExplicitDisconnect = true;
    await this.cleanupSocket();
    this.status = 'disconnected';
    this.qrCode = null;
    this.notifyConnectionChange();
  }

  public async logout(): Promise<void> {
    this.isExplicitDisconnect = true;
    if (this.socket) {
      try {
        await this.socket.logout();
      } catch (e) {
        console.error('Error during Baileys logout:', e);
      }
    }
    await this.cleanupSocket();

    this.status = 'logged_out';
    this.qrCode = null;
    this.jid = null;
    this.phone = null;
    this.pushName = null;
    this.notifyConnectionChange();

    try {
      if (fs.existsSync(config.storage.sessionsDir)) {
        fs.rmSync(config.storage.sessionsDir, { recursive: true, force: true });
        fs.mkdirSync(config.storage.sessionsDir, { recursive: true });
      }
    } catch (e) {
      console.error('Failed to clean sessions directory:', e);
    }
  }

  public async resetSession(): Promise<void> {
    this.isExplicitDisconnect = true;
    this.reconnectAttempts = 0;
    await this.cleanupSocket();

    this.status = 'disconnected';
    this.qrCode = null;
    this.jid = null;
    this.phone = null;
    this.pushName = null;

    this.forceClearSessionsDir();
    this.notifyConnectionChange();
  }

  public async reconnect(): Promise<void> {
    console.log('[Baileys] Menjalankan reconnect / koneksi ulang...');
    this.reconnectAttempts = 0;
    this.isExplicitDisconnect = false;
    await this.cleanupSocket();
    // Tunggu sejenak agar socket dilepas oleh sistem operasi
    await new Promise((res) => setTimeout(res, 500));
    await this.connect();
  }

  public async sendTextMessage(toPhone: string, text: string): Promise<SendMessageResult> {
    if (!this.socket || this.status !== 'connected') {
      return { success: false, messageId: '', error: 'WhatsApp tidak terhubung' };
    }

    const jid = formatToWhatsAppJid(toPhone);
    if (!jid) {
      return { success: false, messageId: '', error: 'Format nomor telepon tidak valid' };
    }

    try {
      const sent = await this.socket.sendMessage(jid, { text });
      return {
        success: true,
        messageId: sent?.key?.id || `msg_${Date.now()}`,
        timestamp: Date.now()
      };
    } catch (err: any) {
      return {
        success: false,
        messageId: '',
        error: err.message || 'Gagal mengirim pesan WhatsApp'
      };
    }
  }

  public async sendImageMessage(toPhone: string, imagePath: string, caption?: string): Promise<SendMessageResult> {
    if (!this.socket || this.status !== 'connected') {
      return { success: false, messageId: '', error: 'WhatsApp tidak terhubung' };
    }

    const jid = formatToWhatsAppJid(toPhone);
    if (!jid) {
      return { success: false, messageId: '', error: 'Format nomor telepon tidak valid' };
    }

    if (!fs.existsSync(imagePath)) {
      return { success: false, messageId: '', error: 'File gambar tidak ditemukan di server' };
    }

    try {
      const buffer = fs.readFileSync(imagePath);
      const sent = await this.socket.sendMessage(jid, {
        image: buffer,
        caption: caption || undefined
      });
      return {
        success: true,
        messageId: sent?.key?.id || `msg_${Date.now()}`,
        timestamp: Date.now()
      };
    } catch (err: any) {
      return {
        success: false,
        messageId: '',
        error: err.message || 'Gagal mengirim gambar WhatsApp'
      };
    }
  }
}
