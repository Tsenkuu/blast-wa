import { describe, it, expect, beforeAll } from 'vitest';
import { whatsappService } from '../src/modules/whatsapp/baileysService.js';
import { MockWhatsAppAdapter } from '../src/modules/whatsapp/mockAdapter.js';
import { db } from '../src/database/index.js';

describe('WhatsApp Connection Lifecycle (Reconnect & Reset Session)', () => {
  let mockAdapter: MockWhatsAppAdapter;

  beforeAll(async () => {
    mockAdapter = new MockWhatsAppAdapter();
    whatsappService.setAdapter(mockAdapter);
    await whatsappService.init();
  });

  it('should connect and update status to connected', async () => {
    await whatsappService.connect();
    const info = whatsappService.getAccountInfo();
    expect(info.status).toBe('connected');
    expect(info.phone).toBe('6281234567890');

    // DB session check
    const session = await db.getOne<{ status: string; phone_number: string }>(
      'SELECT status, phone_number FROM whatsapp_sessions WHERE session_name = ?',
      ['default']
    );
    expect(session?.status).toBe('connected');
    expect(session?.phone_number).toBe('6281234567890');
  });

  it('should reconnect cleanly when reconnect is called', async () => {
    await whatsappService.reconnect();
    const info = whatsappService.getAccountInfo();
    expect(info.status).toBe('connected');
    expect(info.phone).toBe('6281234567890');
  });

  it('should reset session and wipe credentials in DB when resetSession is called', async () => {
    await whatsappService.resetSession();
    const info = whatsappService.getAccountInfo();
    expect(info.status).toBe('disconnected');
    expect(info.phone).toBeNull();
    expect(info.qrCode).toBeNull();

    const session = await db.getOne<{ status: string; phone_number: string | null }>(
      'SELECT status, phone_number FROM whatsapp_sessions WHERE session_name = ?',
      ['default']
    );
    expect(session?.status).toBe('disconnected');
    expect(session?.phone_number).toBeNull();
  });
});
