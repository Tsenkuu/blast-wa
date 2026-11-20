import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
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

  public async init(): Promise<void> {
    // Session directory
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

  public async connect(): Promise<void> {
    this.isExplicitDisconnect = false;
    this.status = 'connecting';
    this.notifyConnectionChange();

    try {
      const { state, saveCreds } = await useMultiFileAuthState(config.storage.sessionsDir);
      const { version } = await fetchLatestBaileysVersion();

      this.socket = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        generateHighQualityLinkPreview: false,
        browser: ['WA Blast Manager Pro', 'Chrome', '124.0.0']
      });

      this.socket.ev.on('creds.update', saveCreds);

      this.socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            this.qrCode = await QRCode.toDataURL(qr);
            this.status = 'connecting';
            this.notifyConnectionChange();
          } catch (err) {
            console.error('Error generating QR code data URL:', err);
          }
        }

        if (connection === 'close') {
          this.qrCode = null;
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;

          if (isLoggedOut) {
            this.status = 'logged_out';
            this.jid = null;
            this.phone = null;
            this.pushName = null;
            this.notifyConnectionChange();
            // Clear session files on logout
            try {
              if (fs.existsSync(config.storage.sessionsDir)) {
                fs.rmSync(config.storage.sessionsDir, { recursive: true, force: true });
                fs.mkdirSync(config.storage.sessionsDir, { recursive: true });
              }
            } catch (e) {
              console.error('Failed to clear sessions dir:', e);
            }
          } else {
            this.status = 'disconnected';
            this.notifyConnectionChange();

            // Auto-reconnect if not explicit disconnect and not exceeded max attempts
            if (!this.isExplicitDisconnect && this.reconnectAttempts < this.maxAutoReconnectAttempts) {
              this.reconnectAttempts++;
              const delay = Math.min(3000 * this.reconnectAttempts, 15000);
              console.log(`[Baileys] Disconnected temporarily. Auto-reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxAutoReconnectAttempts})...`);
              setTimeout(() => {
                if (this.status !== 'connected' && !this.isExplicitDisconnect) {
                  this.connect();
                }
              }, delay);
            }
          }
        } else if (connection === 'open') {
          this.reconnectAttempts = 0;
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
    if (this.socket) {
      try {
        this.socket.end(undefined);
      } catch (e) {
        console.error('Error ending socket:', e);
      }
      this.socket = null;
    }
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
      this.socket = null;
    }
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
