export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'logged_out';

export interface WhatsAppAccountInfo {
  jid: string | null;
  phone: string | null;
  name: string | null;
  status: ConnectionState;
  qrCode: string | null;
}

export interface WhatsAppIncomingMessage {
  fromJid: string;
  senderPhone: string;
  pushName: string;
  isGroup: boolean;
  messageType: 'text' | 'image' | 'document' | 'unknown';
  text?: string;
  caption?: string;
  mediaBuffer?: Buffer;
  fileName?: string;
  mimetype?: string;
  rawMessage?: any;
}

export interface SendMessageResult {
  success: boolean;
  messageId: string;
  timestamp?: number;
  error?: string;
}

export interface IWhatsAppAdapter {
  init(): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  logout(): Promise<void>;
  getAccountInfo(): WhatsAppAccountInfo;
  sendTextMessage(toPhone: string, text: string): Promise<SendMessageResult>;
  sendImageMessage(toPhone: string, imagePath: string, caption?: string): Promise<SendMessageResult>;
  onIncomingMessage(handler: (msg: WhatsAppIncomingMessage) => Promise<void>): void;
  onConnectionChange(handler: (info: WhatsAppAccountInfo) => void): void;
}
