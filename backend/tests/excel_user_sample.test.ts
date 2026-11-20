import { describe, it, expect } from 'vitest';
import { ExcelService } from '../src/modules/excel/excelService.js';

describe('User Sample Excel/CSV Format Detection', () => {
  it('should parse user sample file with blank lines, repeated columns, and duplicate rows', async () => {
    // Exact user sample data
    const csvContent = 
`,,,
6285806917113,Pixel,6285806917113,Pixel
6281547507180,Azizah,6281547507180,Azizah
628973276977,Bima,628973276977,Bima
6285806917113,Pixel,,
6281547507180,Azizah,,
628973276977,Bima,,
,,,
,,,
6285806917113,Pixel,6285806917113,Pixel
6281547507180,Azizah,6281547507180,Azizah
628973276977,Bima,628973276977,Bima
`;

    const buffer = Buffer.from(csvContent, 'utf-8');
    const result = await ExcelService.parseExcelFile(buffer);

    // It should skip blank rows (,,,), detect the 9 data rows
    expect(result.totalRows).toBe(9);
    // 3 unique contacts: Pixel, Azizah, Bima
    expect(result.validRows).toBe(3);
    // 6 duplicates
    expect(result.duplicateRows).toBe(6);

    // First contact check
    const contact1 = result.rows[0];
    expect(contact1.isValid).toBe(true);
    expect(contact1.normalizedPhone).toBe('6285806917113');
    expect(contact1.name).toBe('Pixel');

    // Second contact check
    const contact2 = result.rows[1];
    expect(contact2.isValid).toBe(true);
    expect(contact2.normalizedPhone).toBe('6281547507180');
    expect(contact2.name).toBe('Azizah');

    // Third contact check
    const contact3 = result.rows[2];
    expect(contact3.isValid).toBe(true);
    expect(contact3.normalizedPhone).toBe('628973276977');
    expect(contact3.name).toBe('Bima');

    // Fourth row check (duplicate of Pixel)
    const contact4 = result.rows[3];
    expect(contact4.isValid).toBe(false);
    expect(contact4.errorReason).toContain('duplikat');

    // Columns should be auto-assigned properly
    expect(result.columns.length).toBeGreaterThanOrEqual(2);
    expect(result.columns[0].letter).toBe('A');
    expect(result.columns[1].letter).toBe('B');
  });
});
