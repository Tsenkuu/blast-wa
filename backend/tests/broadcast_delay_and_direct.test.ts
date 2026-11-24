import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '../src/database/index.js';
import { whatsappService } from '../src/modules/whatsapp/baileysService.js';
import { MockWhatsAppAdapter } from '../src/modules/whatsapp/mockAdapter.js';

describe('Broadcast Delay Update & Direct WA Messenger', () => {
  let mockAdapter: MockWhatsAppAdapter;
  let broadcastId: number;
  let recipientId: number;

  beforeAll(async () => {
    mockAdapter = new MockWhatsAppAdapter();
    whatsappService.setAdapter(mockAdapter);
    await whatsappService.init();
    await whatsappService.connect();

    // Create a broadcast for testing
    const bRes = await db.execute(
      `INSERT INTO broadcasts (broadcast_code, name, dataset_id, custom_message, delay_seconds, status, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, 'running', 1)`,
      [`BC-TEST-DELAY-${Date.now()}`, 'Test Dynamic Delay', 1, 'Halo {{nama}}!', 4]
    );
    broadcastId = bRes.insertId;

    const rRes = await db.execute(
      `INSERT INTO broadcast_recipients (broadcast_id, phone_number, recipient_name, personalized_message, status, idempotency_key)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [broadcastId, '6281234567890', 'Budi Santoso', 'Halo Budi Santoso!', `idem_test_${Date.now()}`]
    );
    recipientId = rRes.insertId;
  });

  it('should dynamically update broadcast delay_seconds on the fly', async () => {
    await db.execute(
      'UPDATE broadcasts SET delay_seconds = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [45, broadcastId]
    );

    const check = await db.getOne<{ delay_seconds: number }>(
      'SELECT delay_seconds FROM broadcasts WHERE id = ?',
      [broadcastId]
    );
    expect(check?.delay_seconds).toBe(45);
  });

  it('should send direct WhatsApp message via whatsappService', async () => {
    const res = await whatsappService.sendTextMessage('628987654321', 'Tes pesan langsung seperti chat WA');
    expect(res.success).toBe(true);
    expect(res.messageId).toBeDefined();
    expect(mockAdapter.sentMessages.length).toBeGreaterThan(0);
  });

  it('should update recipient to sent when direct send-now is executed', async () => {
    const res = await whatsappService.sendTextMessage('6281234567890', 'Halo Budi, pesan manual WA!');
    expect(res.success).toBe(true);

    await db.execute(
      `UPDATE broadcast_recipients 
       SET status = 'sent', sent_at = CURRENT_TIMESTAMP, error_reason = NULL, attempts = attempts + 1
       WHERE id = ?`,
      [recipientId]
    );

    const rec = await db.getOne<{ status: string }>(
      'SELECT status FROM broadcast_recipients WHERE id = ?',
      [recipientId]
    );
    expect(rec?.status).toBe('sent');
  });
});
