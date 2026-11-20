import { describe, it, expect, beforeAll } from 'vitest';
import ExcelJS from 'exceljs';
import { db } from '../src/database/index.js';
import { runSeed } from '../src/database/seed.js';
import { whatsappService } from '../src/modules/whatsapp/baileysService.js';
import { MockWhatsAppAdapter } from '../src/modules/whatsapp/mockAdapter.js';
import { whatsappAdminController } from '../src/modules/admin-bot/adminBotService.js';

describe('WhatsApp Admin Bot Controller', () => {
  let mockAdapter: MockWhatsAppAdapter;
  const adminPhone = '6281234567890';
  const strangerPhone = '6289999999999';

  beforeAll(async () => {
    process.env.WA_USE_MOCK = 'true';
    await db.init();
    await runSeed();

    mockAdapter = new MockWhatsAppAdapter();
    whatsappService.setAdapter(mockAdapter);
    await mockAdapter.connect();

    whatsappAdminController.init();
  });

  it('should ignore commands from unauthorized numbers', async () => {
    const initialSentCount = mockAdapter.sentMessages.length;
    await mockAdapter.simulateIncomingMessage({
      fromJid: `${strangerPhone}@s.whatsapp.net`,
      senderPhone: strangerPhone,
      pushName: 'Stranger',
      isGroup: false,
      messageType: 'text',
      text: '!status'
    });

    // Should NOT respond with status to a stranger
    expect(mockAdapter.sentMessages.length).toBe(initialSentCount);
  });

  it('should respond to !status and !menu from verified admin', async () => {
    mockAdapter.sentMessages = [];
    await mockAdapter.simulateIncomingMessage({
      fromJid: `${adminPhone}@s.whatsapp.net`,
      senderPhone: adminPhone,
      pushName: 'Admin',
      isGroup: false,
      messageType: 'text',
      text: '!status'
    });

    expect(mockAdapter.sentMessages.length).toBeGreaterThan(0);
    const lastMsg = mockAdapter.sentMessages[mockAdapter.sentMessages.length - 1];
    expect(lastMsg.to).toBe(adminPhone);
    expect(lastMsg.content).toContain('STATUS SISTEM WA BLAST PRO');

    // Test !menu
    await mockAdapter.simulateIncomingMessage({
      fromJid: `${adminPhone}@s.whatsapp.net`,
      senderPhone: adminPhone,
      pushName: 'Admin',
      isGroup: false,
      messageType: 'text',
      text: '!menu'
    });

    const menuMsg = mockAdapter.sentMessages[mockAdapter.sentMessages.length - 1];
    expect(menuMsg.content).toContain('WA BLAST MANAGER PRO - ADMIN CONTROLLER');
  });

  it('should allow admin to upload Excel directly from WhatsApp chat', async () => {
    mockAdapter.sentMessages = [];

    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Sheet1');
    sheet.addRow(['Nomor WhatsApp', 'Nama', 'Keterangan']);
    sheet.addRow(['081234567890', 'Joko', 'Jakarta']);
    sheet.addRow(['081399887766', 'Dewi', 'Semarang']);

    const buffer = await wb.xlsx.writeBuffer();

    await mockAdapter.simulateIncomingMessage({
      fromJid: `${adminPhone}@s.whatsapp.net`,
      senderPhone: adminPhone,
      pushName: 'Admin',
      isGroup: false,
      messageType: 'document',
      fileName: 'relawan_wa.xlsx',
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      mediaBuffer: Buffer.from(buffer),
      caption: '!excel simpan "Data WA Khusus"'
    });

    const reply = mockAdapter.sentMessages.find(m => m.content?.includes('DATASET BERHASIL DIIMPOR'));
    expect(reply).toBeDefined();
    expect(reply?.content).toContain('Data WA Khusus');
    expect(reply?.content).toContain('Nomor valid: 2');

    // Verify dataset exists in database
    const ds = await db.getOne<{ id: number; name: string }>(
      'SELECT id, name FROM contact_datasets WHERE name = ?',
      ['Data WA Khusus']
    );
    expect(ds).toBeDefined();
    expect(ds?.name).toBe('Data WA Khusus');
  });

  it('should support interactive broadcast creation with preview and confirmation', async () => {
    mockAdapter.sentMessages = [];

    // Step 1: !blast buat "Data WA Khusus"
    await mockAdapter.simulateIncomingMessage({
      fromJid: `${adminPhone}@s.whatsapp.net`,
      senderPhone: adminPhone,
      pushName: 'Admin',
      isGroup: false,
      messageType: 'text',
      text: '!blast buat "Data WA Khusus"'
    });

    let lastReply = mockAdapter.sentMessages[mockAdapter.sentMessages.length - 1];
    expect(lastReply.content).toContain('Silakan balas dengan *teks template pesan*');

    // Step 2: Send template text
    await mockAdapter.simulateIncomingMessage({
      fromJid: `${adminPhone}@s.whatsapp.net`,
      senderPhone: adminPhone,
      pushName: 'Admin',
      isGroup: false,
      messageType: 'text',
      text: 'Halo {{nama}}, salam hormat dari kami untuk domisili {{keterangan}}!'
    });

    lastReply = mockAdapter.sentMessages[mockAdapter.sentMessages.length - 1];
    expect(lastReply.content).toContain('Template pesan tersimpan');

    // Step 3: Type !tanpagambar
    await mockAdapter.simulateIncomingMessage({
      fromJid: `${adminPhone}@s.whatsapp.net`,
      senderPhone: adminPhone,
      pushName: 'Admin',
      isGroup: false,
      messageType: 'text',
      text: '!tanpagambar'
    });

    lastReply = mockAdapter.sentMessages[mockAdapter.sentMessages.length - 1];
    expect(lastReply.content).toContain('BROADCAST SIAP DIJALANKAN');
    expect(lastReply.content).toContain('Preview untuk Joko');
    expect(lastReply.content).toContain('!blast konfirmasi CFM-');

    // Extract confirmation code
    const match = lastReply.content?.match(/!blast\s+konfirmasi\s+(CFM-[A-F0-9]+)/i);
    expect(match).toBeDefined();
    const confCode = match![1];

    // Step 4: Confirm broadcast
    await mockAdapter.simulateIncomingMessage({
      fromJid: `${adminPhone}@s.whatsapp.net`,
      senderPhone: adminPhone,
      pushName: 'Admin',
      isGroup: false,
      messageType: 'text',
      text: `!blast konfirmasi ${confCode}`
    });

    lastReply = mockAdapter.sentMessages[mockAdapter.sentMessages.length - 1];
    expect(lastReply.content).toContain('BROADCAST BERHASIL DIMULAI');

    // Verify broadcast in database
    const broadcast = await db.getOne<{ id: number; status: string }>(
      'SELECT id, status FROM broadcasts ORDER BY id DESC LIMIT 1'
    );
    expect(broadcast?.status).toBe('running');
  });
});
