import bcrypt from 'bcryptjs';
import { db } from './index.js';

export async function runSeed() {
  console.log('🌱 Starting database seeding...');
  await db.init();

  // 1. Roles
  const roles = [
    { name: 'Super Admin', description: 'Akses penuh ke semua fitur dan pengaturan sistem' },
    { name: 'Operator', description: 'Dapat mengelola broadcast, Excel, dan media tanpa akses sistem/admin' }
  ];

  for (const role of roles) {
    const existing = await db.getOne('SELECT id FROM roles WHERE name = ?', [role.name]);
    if (!existing) {
      await db.execute('INSERT INTO roles (name, description) VALUES (?, ?)', [role.name, role.description]);
    }
  }

  // 2. Initial Admin User
  const adminRole = await db.getOne<{ id: number }>('SELECT id FROM roles WHERE name = ?', ['Super Admin']);
  if (adminRole) {
    const existingAdmin = await db.getOne('SELECT id FROM users WHERE username = ?', ['admin']);
    if (!existingAdmin) {
      const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@WA2026';
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(defaultPassword, salt);
      await db.execute(
        'INSERT INTO users (role_id, username, password_hash, full_name, is_active) VALUES (?, ?, ?, ?, 1)',
        [adminRole.id, 'admin', hash, 'Administrator Utama']
      );
      console.log(`👤 Created default admin user: "admin" (Password: "${defaultPassword}")`);
    }
  }

  // 3. Initial WhatsApp Admin (for DM bot controller)
  const existingWaAdmin = await db.getOne('SELECT id FROM whatsapp_admins WHERE phone_number = ?', ['6281234567890']);
  if (!existingWaAdmin) {
    await db.execute(
      'INSERT INTO whatsapp_admins (phone_number, name, can_broadcast, can_manage_excel, can_manage_sessions, is_active, notify_on_events) VALUES (?, ?, 1, 1, 1, 1, 1)',
      ['6281234567890', 'Admin Utama WA']
    );
    console.log('📱 Created default WhatsApp Admin phone: 6281234567890');
  }

  // 4. App Settings
  const settings = [
    { key: 'min_delay_ms', value: '3000', desc: 'Jeda minimal antar pengiriman pesan (milidetik)' },
    { key: 'max_delay_ms', value: '6000', desc: 'Jeda maksimal antar pengiriman pesan (milidetik)' },
    { key: 'max_retries', value: '2', desc: 'Maksimum percobaan ulang untuk pesan gagal' },
    { key: 'circuit_breaker_fails', value: '5', desc: 'Jumlah kegagalan beruntun sebelum circuit breaker memutus jeda' },
    { key: 'emergency_stop', value: '0', desc: 'Tombol darurat penghentian seluruh antrean (1 = aktif)' },
    { key: 'daily_send_limit', value: '1000', desc: 'Batas kuota pengiriman pesan per hari' },
    { key: 'consent_required', value: '1', desc: 'Hanya kirim ke nomor yang berstatus consent granted' }
  ];

  for (const s of settings) {
    const existing = await db.getOne('SELECT id FROM app_settings WHERE key_name = ?', [s.key]);
    if (!existing) {
      await db.execute('INSERT INTO app_settings (key_name, value_text, description) VALUES (?, ?, ?)', [s.key, s.value, s.desc]);
    }
  }

  // 5. Sample Message Template
  const existingTpl = await db.getOne('SELECT id FROM message_templates WHERE name = ?', ['Undangan Kegiatan Relawan']);
  if (!existingTpl) {
    await db.execute(
      'INSERT INTO message_templates (name, content, has_media) VALUES (?, ?, 0)',
      [
        'Undangan Kegiatan Relawan',
        'Halo {{B}}, selamat datang!\n\nKami mengundang Anda untuk mengikuti kegiatan di wilayah {{C}}.\nNomor kontak terdaftar Anda: {{A}}.\n\nKetik STOP jika tidak ingin menerima pesan ini lagi.\nTerima kasih, {{nama}}.'
      ]
    );
  }

  // 6. Sample Initial Dataset
  const existingDs = await db.getOne('SELECT id FROM contact_datasets WHERE name = ?', ['Data Contoh Relawan']);
  if (!existingDs) {
    const dsRes = await db.execute(
      'INSERT INTO contact_datasets (name, filename, total_rows, valid_rows, invalid_rows, created_by) VALUES (?, ?, 3, 3, 0, ?)',
      ['Data Contoh Relawan', 'sample_relawan.xlsx', 'system']
    );
    const dsId = dsRes.insertId;

    await db.execute('INSERT INTO dataset_columns (dataset_id, column_letter, column_name, original_header) VALUES (?, ?, ?, ?)', [dsId, 'A', 'nomor', 'Nomor WhatsApp']);
    await db.execute('INSERT INTO dataset_columns (dataset_id, column_letter, column_name, original_header) VALUES (?, ?, ?, ?)', [dsId, 'B', 'nama', 'Nama']);
    await db.execute('INSERT INTO dataset_columns (dataset_id, column_letter, column_name, original_header) VALUES (?, ?, ?, ?)', [dsId, 'C', 'keterangan', 'Keterangan']);

    const sampleContacts = [
      { phone: '6281234567890', name: 'Ahmad', notes: 'Tulungagung' },
      { phone: '6281298765432', name: 'Budi', notes: 'Bandung' },
      { phone: '6281355566677', name: 'Siti', notes: 'Campurdarat' }
    ];

    for (const c of sampleContacts) {
      await db.execute(
        'INSERT INTO contacts (dataset_id, phone_number, name, notes, extra_data_json, is_valid) VALUES (?, ?, ?, ?, ?, 1)',
        [dsId, c.phone, c.name, c.notes, JSON.stringify({ A: c.phone, B: c.name, C: c.notes, nomor: c.phone, nama: c.name, keterangan: c.notes })]
      );
      const existingConsent = await db.getOne('SELECT id FROM contact_consents WHERE phone_number = ?', [c.phone]);
      if (!existingConsent) {
        await db.execute(
          'INSERT INTO contact_consents (phone_number, status, source) VALUES (?, ?, ?)',
          [c.phone, 'granted', 'sample_import']
        );
      }
    }
  }

  console.log('✅ Seeding completed successfully!');
}

if (process.argv[1]?.includes('seed')) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seeding failed:', err);
      process.exit(1);
    });
}
