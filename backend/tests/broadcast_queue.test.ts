import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import { db } from '../src/database/index.js';
import { config } from '../src/config/index.js';
import { runSeed } from '../src/database/seed.js';
import { whatsappService } from '../src/modules/whatsapp/baileysService.js';
import { MockWhatsAppAdapter } from '../src/modules/whatsapp/mockAdapter.js';
import { broadcastQueueWorker } from '../src/modules/broadcast/broadcastQueueWorker.js';

describe('Broadcast Queue Worker & Safety Mechanism', () => {
  let mockAdapter: MockWhatsAppAdapter;

  beforeAll(async () => {
    process.env.WA_USE_MOCK = 'true';
    config.queue.minDelayMs = 0;
    config.queue.maxDelayMs = 5;
    await db.init();
    await runSeed();
    await db.execute("UPDATE broadcasts SET status = 'completed' WHERE status = 'running'");

    mockAdapter = new MockWhatsAppAdapter();
    whatsappService.setAdapter(mockAdapter);
    await mockAdapter.connect();
  });

  it('should process pending recipients in broadcast queue', async () => {
    const phone1 = `62811${Math.floor(1000000 + Math.random() * 9000000)}`;
    const phone2 = `62844${Math.floor(1000000 + Math.random() * 9000000)}`;
    const code = `BC-TEST-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // 1. Create a dataset
    const dsRes = await db.execute(
      `INSERT INTO contact_datasets (name, filename, total_rows, valid_rows) VALUES ('Test Queue DS', 'test.xlsx', 2, 2)`
    );
    const dsId = dsRes.insertId;

    // 2. Add 2 contacts
    const c1 = await db.execute(
      `INSERT INTO contacts (dataset_id, phone_number, name, notes, extra_data_json, is_valid)
       VALUES (?, ?, 'Penerima Satu', 'Jakarta', ?, 1)`,
      [dsId, phone1, JSON.stringify({ A: phone1, B: 'Penerima Satu', nama: 'Penerima Satu' })]
    );

    const c2 = await db.execute(
      `INSERT INTO contacts (dataset_id, phone_number, name, notes, extra_data_json, is_valid)
       VALUES (?, ?, 'Penerima Dua', 'Surabaya', ?, 1)`,
      [dsId, phone2, JSON.stringify({ A: phone2, B: 'Penerima Dua', nama: 'Penerima Dua' })]
    );

    // Grant consent to both
    await db.execute(`INSERT INTO contact_consents (phone_number, status) VALUES (?, 'granted')`, [phone1]);
    await db.execute(`INSERT INTO contact_consents (phone_number, status) VALUES (?, 'granted')`, [phone2]);

    // 3. Create broadcast
    const bRes = await db.execute(
      `INSERT INTO broadcasts (broadcast_code, name, dataset_id, custom_message, status)
       VALUES (?, 'Broadcast Uji Worker', ?, 'Halo {{nama}}, ini pesan uji coba.', 'running')`,
      [code, dsId]
    );
    const bId = bRes.insertId;

    const idem1 = `idem_${Date.now()}_1`;
    const idem2 = `idem_${Date.now()}_2`;

    // Add recipients
    await db.execute(
      `INSERT INTO broadcast_recipients (broadcast_id, contact_id, phone_number, recipient_name, personalized_message, status, idempotency_key)
       VALUES (?, ?, ?, 'Penerima Satu', 'Halo Penerima Satu, ini pesan uji coba.', 'pending', ?)`,
      [bId, c1.insertId, phone1, idem1]
    );

    await db.execute(
      `INSERT INTO broadcast_recipients (broadcast_id, contact_id, phone_number, recipient_name, personalized_message, status, idempotency_key)
       VALUES (?, ?, ?, 'Penerima Dua', 'Halo Penerima Dua, ini pesan uji coba.', 'pending', ?)`,
      [bId, c2.insertId, phone2, idem2]
    );

    // Run one processing step
    await broadcastQueueWorker.processNextInQueue();

    // Check that recipient 1 was sent
    const r1 = await db.getOne<{ status: string }>(
      `SELECT status FROM broadcast_recipients WHERE idempotency_key = ?`,
      [idem1]
    );
    expect(r1?.status).toBe('sent');

    // Run next processing step
    await broadcastQueueWorker.processNextInQueue();

    // Check that recipient 2 was sent
    const r2 = await db.getOne<{ status: string }>(
      `SELECT status FROM broadcast_recipients WHERE idempotency_key = ?`,
      [idem2]
    );
    expect(r2?.status).toBe('sent');

    // Check broadcast marked completed
    await broadcastQueueWorker.processNextInQueue();
    const finalB = await db.getOne<{ status: string; sent_count: number }>(
      `SELECT status, sent_count FROM broadcasts WHERE id = ?`,
      [bId]
    );
    expect(finalB?.status).toBe('completed');
    expect(finalB?.sent_count).toBe(2);
  });

  it('should skip recipients who opted out', async () => {
    await db.execute("UPDATE broadcasts SET status = 'completed' WHERE status = 'running'");
    const optPhone = `62877${Math.floor(1000000 + Math.random() * 9000000)}`;
    const bCode = `BC-OPT-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const idemOpt = `idem_opt_${Date.now()}`;

    // Add opt out for a test phone
    await db.execute(`INSERT INTO opt_outs (phone_number, reason) VALUES (?, 'Stop request')`, [optPhone]);

    const dsRes = await db.execute(
      `INSERT INTO contact_datasets (name, filename, total_rows, valid_rows) VALUES ('OptOut DS', 'opt.xlsx', 1, 1)`
    );
    const bRes = await db.execute(
      `INSERT INTO broadcasts (broadcast_code, name, dataset_id, custom_message, status)
       VALUES (?, 'Broadcast Optout', ?, 'Halo', 'running')`,
      [bCode, dsRes.insertId]
    );

    await db.execute(
      `INSERT INTO broadcast_recipients (broadcast_id, phone_number, recipient_name, personalized_message, status, idempotency_key)
       VALUES (?, ?, 'Opted User', 'Halo', 'pending', ?)`,
      [bRes.insertId, optPhone, idemOpt]
    );

    await broadcastQueueWorker.processNextInQueue();

    const recipient = await db.getOne<{ status: string; error_reason: string }>(
      `SELECT status, error_reason FROM broadcast_recipients WHERE idempotency_key = ?`,
      [idemOpt]
    );
    expect(recipient?.status).toBe('skipped');
    expect(recipient?.error_reason).toContain('Opt-Out');
  });

  it('should support pause and resume controls', async () => {
    const bCode = `BC-PAUSE-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const dsRes = await db.execute(
      `INSERT INTO contact_datasets (name, filename, total_rows, valid_rows) VALUES ('Pause DS', 'p.xlsx', 1, 1)`
    );
    const bRes = await db.execute(
      `INSERT INTO broadcasts (broadcast_code, name, dataset_id, custom_message, status)
       VALUES (?, 'Broadcast Pause', ?, 'Halo', 'running')`,
      [bCode, dsRes.insertId]
    );
    const bId = bRes.insertId;

    await broadcastQueueWorker.pauseBroadcast(bId);
    let b = await db.getOne<{ status: string }>('SELECT status FROM broadcasts WHERE id = ?', [bId]);
    expect(b?.status).toBe('paused');

    await broadcastQueueWorker.resumeBroadcast(bId);
    b = await db.getOne<{ status: string }>('SELECT status FROM broadcasts WHERE id = ?', [bId]);
    expect(b?.status).toBe('running');

    await broadcastQueueWorker.cancelBroadcast(bId);
    b = await db.getOne<{ status: string }>('SELECT status FROM broadcasts WHERE id = ?', [bId]);
    expect(b?.status).toBe('cancelled');
  });
});
