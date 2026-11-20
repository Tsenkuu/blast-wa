import { describe, it, expect, beforeAll } from 'vitest';
import ExcelJS from 'exceljs';
import { ExcelService } from '../src/modules/excel/excelService.js';
import { db } from '../src/database/index.js';
import { runSeed } from '../src/database/seed.js';

describe('Excel Upload & Processing Service', () => {
  beforeAll(async () => {
    await db.init();
    await runSeed();
  });

  it('should parse Excel buffer with columns A, B, C and dynamic extra columns', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Data Relawan');

    // Header row
    sheet.addRow(['Nomor WhatsApp', 'Nama', 'Keterangan', 'Divisi']);

    // Data rows
    sheet.addRow(['081234567890', 'Ahmad', 'Tulungagung', 'Logistik']);
    sheet.addRow(['081298765432', 'Budi', 'Bandung', 'Medis']);
    sheet.addRow(['081355566677', 'Siti', 'Campurdarat', 'Konsumsi']);
    sheet.addRow(['081234567890', 'Ahmad Duplikat', 'Tulungagung', 'Logistik']); // Duplicate
    sheet.addRow(['12345', 'Invalid Number', 'Jakarta', 'IT']); // Invalid number

    const buffer = await workbook.xlsx.writeBuffer();
    const result = await ExcelService.parseExcelFile(Buffer.from(buffer) as any);

    expect(result.totalRows).toBe(5);
    expect(result.validRows).toBe(3);
    expect(result.invalidRows).toBe(2);
    expect(result.duplicateRows).toBe(1);

    const first = result.rows[0];
    expect(first.normalizedPhone).toBe('6281234567890');
    expect(first.name).toBe('Ahmad');
    expect(first.extraData['Divisi']).toBe('Logistik');
  });

  it('should save dataset to database and record consent for valid contacts', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Relawan November');
    sheet.addRow(['Nomor WhatsApp', 'Nama', 'Keterangan']);
    sheet.addRow(['089911223344', 'Eko', 'Surabaya']);

    const buffer = await workbook.xlsx.writeBuffer();
    const parsed = await ExcelService.parseExcelFile(Buffer.from(buffer) as any);

    const saved = await ExcelService.saveDatasetToDb(
      'Test Dataset November',
      'test_november.xlsx',
      parsed,
      'test_admin'
    );

    expect(saved.datasetId).toBeGreaterThan(0);
    expect(saved.validRows).toBe(1);

    const contact = await db.getOne<{ phone_number: string }>(
      'SELECT phone_number FROM contacts WHERE dataset_id = ?',
      [saved.datasetId]
    );
    expect(contact?.phone_number).toBe('6289911223344');

    const consent = await db.getOne<{ status: string }>(
      'SELECT status FROM contact_consents WHERE phone_number = ?',
      ['6289911223344']
    );
    expect(consent?.status).toBe('granted');
  });
});
