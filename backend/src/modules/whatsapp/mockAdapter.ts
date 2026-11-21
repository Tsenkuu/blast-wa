import {
  IWhatsAppAdapter,
  WhatsAppAccountInfo,
  WhatsAppIncomingMessage,
  SendMessageResult,
  ConnectionState
} from './whatsappAdapter.js';

export class MockWhatsAppAdapter implements IWhatsAppAdapter {
  private status: ConnectionState = 'disconnected';
  private qrCode: string | null = null;
  private jid: string | null = null;
  private phone: string | null = null;
  private pushName: string | null = null;
  private incomingHandlers: Array<(msg: WhatsAppIncomingMessage) => Promise<void>> = [];
  private connectionChangeHandlers: Array<(info: WhatsAppAccountInfo) => void> = [];
  public sentMessages: Array<{ to: string; type: 'text' | 'image'; content?: string; mediaPath?: string }> = [];
  public shouldFailNextSend: boolean = false;
  public failErrorMessage: string = 'Simulated connection failure';

  public async init(): Promise<void> {
    // No-op for mock
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

  private notify(): void {
    const info = this.getAccountInfo();
    for (const h of this.connectionChangeHandlers) {
      h(info);
    }
  }

  public async connect(): Promise<void> {
    this.status = 'connected';
    this.qrCode = null;
    this.phone = '6281234567890';
    this.jid = '6281234567890@s.whatsapp.net';
    this.pushName = 'WA Blast Mock Bot';
    this.notify();
  }

  public async disconnect(): Promise<void> {
    this.status = 'disconnected';
    this.qrCode = null;
    this.notify();
  }

  public async logout(): Promise<void> {
    this.status = 'logged_out';
    this.qrCode = null;
    this.jid = null;
    this.phone = null;
    this.pushName = null;
    this.notify();
  }

  public async resetSession(): Promise<void> {
    this.status = 'disconnected';
    this.qrCode = null;
    this.jid = null;
    this.phone = null;
    this.pushName = null;
    this.notify();
  }

  public async reconnect(): Promise<void> {
    await this.disconnect();
    await this.connect();
  }

  public async sendTextMessage(toPhone: string, text: string): Promise<SendMessageResult> {
    if (this.status !== 'connected') {
      return { success: false, messageId: '', error: 'WhatsApp mock tidak terhubung' };
    }

    if (this.shouldFailNextSend) {
      this.shouldFailNextSend = false;
      return { success: false, messageId: '', error: this.failErrorMessage };
    }

    this.sentMessages.push({ to: toPhone, type: 'text', content: text });
    return {
      success: true,
      messageId: `mock_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: Date.now()
    };
  }

  public async sendImageMessage(toPhone: string, imagePath: string, caption?: string): Promise<SendMessageResult> {
    if (this.status !== 'connected') {
      return { success: false, messageId: '', error: 'WhatsApp mock tidak terhubung' };
    }

    if (this.shouldFailNextSend) {
      this.shouldFailNextSend = false;
      return { success: false, messageId: '', error: this.failErrorMessage };
    }

    this.sentMessages.push({ to: toPhone, type: 'image', mediaPath: imagePath, content: caption });
    return {
      success: true,
      messageId: `mock_img_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: Date.now()
    };
  }

  /**
   * Helper for tests to simulate incoming message from admin or contact
   */
  public async simulateIncomingMessage(msg: WhatsAppIncomingMessage): Promise<void> {
    for (const h of this.incomingHandlers) {
      await h(msg);
    }
  }
}
