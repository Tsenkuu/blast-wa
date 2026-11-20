import ExcelJS from 'exceljs';
import fs from 'fs';
import { db } from '../../database/index.js';
import { normalizePhoneNumber } from '../../utils/normalizer.js';
import { logSystem } from '../../utils/logger.js';

export interface ColumnMapping {
  phoneCol?: string; // Column letter or header name (e.g. 'A' or 'Nomor WhatsApp')
  nameCol?: string;  // Column letter or header name (e.g. 'B' or 'Nama')
  notesCol?: string; // Column letter or header name (e.g. 'C' or 'Keterangan')
}

export interface ParsedContactRow {
  rowNumber: number;
  phone: string;
  normalizedPhone: string;
  name: string;
  notes: string;
  isValid: boolean;
  errorReason?: string;
  extraData: Record<string, any>;
}

export interface ExcelParseResult {
  sheetName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  columns: Array<{ letter: string; name: string; header: string }>;
  rows: ParsedContactRow[];
}

export class ExcelService {
  /**
   * Helper to convert 1-based column index to letter (1 -> A, 2 -> B, 27 -> AA)
   */
  public static colIndexToLetter(colIndex: number): string {
    let letter = '';
    while (colIndex > 0) {
      const mod = (colIndex - 1) % 26;
      letter = String.fromCharCode(65 + mod) + letter;
      colIndex = Math.floor((colIndex - mod) / 26);
    }
    return letter;
  }

  /**
   * Check if a string looks like a phone number
   */
  private static isLikelyPhoneNumber(val: string): boolean {
    if (!val) return false;
    const cleaned = String(val).replace(/[^\d+]/g, '');
    if (cleaned.length >= 9 && cleaned.length <= 16) {
      return cleaned.startsWith('08') || cleaned.startsWith('62') || cleaned.startsWith('+62') || cleaned.startsWith('8');
    }
    return false;
  }

  /**
   * Check if a row is completely blank (e.g. empty or only commas/whitespace)
   */
  private static isRowBlank(values: string[]): boolean {
    return values.every(v => !v || v.trim().length === 0);
  }

  /**
   * Parse CSV text lines into cell values matrix
   */
  private static parseCsvLines(csvText: string): Array<{ rowNumber: number; cellValues: string[] }> {
    const lines = csvText.split(/\r?\n/);
    const result: Array<{ rowNumber: number; cellValues: string[] }> = [];

    lines.forEach((line, idx) => {
      if (!line.trim()) return;

      const cells: string[] = [];
      let insideQuotes = false;
      let current = '';

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
          cells.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      cells.push(current.trim());

      // Trim trailing empty strings
      while (cells.length > 0 && cells[cells.length - 1] === '') {
        cells.pop();
      }

      if (!ExcelService.isRowBlank(cells)) {
        result.push({ rowNumber: idx + 1, cellValues: cells });
      }
    });

    return result;
  }

  /**
   * Parse an Excel or CSV file (.xlsx, .xls, .csv, or buffer) with auto-header detection
   */
  public static async parseExcelFile(
    filePathOrBuffer: string | Buffer,
    sheetIndexOrName: number | string = 1,
    mapping: ColumnMapping = {}
  ): Promise<ExcelParseResult> {
    const rawRowsData: Array<{ rowNumber: number; cellValues: string[] }> = [];
    let maxColumns = 1;
    let sheetName = 'Sheet1';

    // Check if input is CSV
    let isCsv = false;
    if (typeof filePathOrBuffer === 'string') {
      isCsv = filePathOrBuffer.toLowerCase().endsWith('.csv');
    } else if (Buffer.isBuffer(filePathOrBuffer)) {
      // Check if does NOT start with ZIP magic bytes (PK..)
      const isZip = filePathOrBuffer.length > 4 &&
        filePathOrBuffer[0] === 0x50 &&
        filePathOrBuffer[1] === 0x4B &&
        filePathOrBuffer[2] === 0x03 &&
        filePathOrBuffer[3] === 0x04;
      isCsv = !isZip;
    }

    if (isCsv) {
      const text = typeof filePathOrBuffer === 'string'
        ? fs.readFileSync(filePathOrBuffer, 'utf8')
        : filePathOrBuffer.toString('utf8');

      const parsedLines = ExcelService.parseCsvLines(text);
      for (const row of parsedLines) {
        maxColumns = Math.max(maxColumns, row.cellValues.length);
        rawRowsData.push(row);
      }
      sheetName = 'CSV Data';
    } else {
      // Load with ExcelJS
      const workbook = new ExcelJS.Workbook();
      try {
        if (typeof filePathOrBuffer === 'string') {
          await workbook.xlsx.readFile(filePathOrBuffer);
        } else {
          await workbook.xlsx.load(filePathOrBuffer as any);
        }

        let worksheet = typeof sheetIndexOrName === 'number'
          ? workbook.getWorksheet(sheetIndexOrName)
          : workbook.getWorksheet(sheetIndexOrName);

        if (!worksheet) worksheet = workbook.worksheets[0];
        if (!worksheet) throw new Error('Worksheet tidak ditemukan.');

        sheetName = worksheet.name || 'Sheet1';
        const totalSheetRows = worksheet.rowCount;

        for (let r = 1; r <= totalSheetRows; r++) {
          const row = worksheet.getRow(r);
          if (!row) continue;

          const cellValues: string[] = [];
          const cellCount = Math.max(row.cellCount || 0, 10);

          for (let c = 1; c <= cellCount; c++) {
            const val = row.getCell(c).value;
            const strVal = val !== null && val !== undefined ? String(val).trim() : '';
            cellValues.push(strVal);
          }

          while (cellValues.length > 0 && cellValues[cellValues.length - 1] === '') {
            cellValues.pop();
          }

          if (!ExcelService.isRowBlank(cellValues)) {
            maxColumns = Math.max(maxColumns, cellValues.length);
            rawRowsData.push({ rowNumber: r, cellValues });
          }
        }
      } catch (xlsxErr) {
        // Fallback to CSV parse if XLSX parser throws
        const text = typeof filePathOrBuffer === 'string'
          ? fs.readFileSync(filePathOrBuffer, 'utf8')
          : filePathOrBuffer.toString('utf8');

        const parsedLines = ExcelService.parseCsvLines(text);
        for (const row of parsedLines) {
          maxColumns = Math.max(maxColumns, row.cellValues.length);
          rawRowsData.push(row);
        }
        sheetName = 'Data File';
      }
    }

    if (rawRowsData.length === 0) {
      throw new Error('File Excel / CSV kosong atau tidak memiliki data.');
    }

    // Step 2: Determine if first non-empty row is a Header or Data
    const firstRowValues = rawRowsData[0].cellValues;
    const firstCell = firstRowValues[0] || '';

    const isFirstCellPhone = ExcelService.isLikelyPhoneNumber(firstCell);
    const hasHeaderKeywords = firstRowValues.some(v => {
      const lower = v.toLowerCase();
      return (
        lower.includes('nomor') ||
        lower.includes('nama') ||
        lower.includes('phone') ||
        lower.includes('name') ||
        lower.includes('telepon') ||
        lower.includes('kontak') ||
        lower.includes('keterangan')
      );
    });

    const hasHeader = hasHeaderKeywords && !isFirstCellPhone;

    // Build columns definition
    const columns: Array<{ letter: string; name: string; header: string; colNumber: number }> = [];

    if (hasHeader) {
      firstRowValues.forEach((headerVal, idx) => {
        const colNumber = idx + 1;
        const letter = ExcelService.colIndexToLetter(colNumber);
        const headerText = headerVal || `Kolom ${letter}`;
        const cleanName = headerText.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        columns.push({
          letter,
          name: cleanName || `col_${letter.toLowerCase()}`,
          header: headerText,
          colNumber
        });
      });
    } else {
      // Auto-assign headers: A (Nomor WhatsApp), B (Nama), C (Keterangan), D...
      const defaultHeaderNames = ['Nomor WhatsApp', 'Nama', 'Keterangan'];
      const defaultAliases = ['nomor', 'nama', 'keterangan'];

      for (let c = 1; c <= Math.max(maxColumns, 3); c++) {
        const letter = ExcelService.colIndexToLetter(c);
        const headerText = defaultHeaderNames[c - 1] || `Kolom ${letter}`;
        const cleanName = defaultAliases[c - 1] || `col_${letter.toLowerCase()}`;
        columns.push({
          letter,
          name: cleanName,
          header: headerText,
          colNumber: c
        });
      }
    }

    // Step 3: Parse Data Rows
    const startIndex = hasHeader ? 1 : 0;
    const phoneColLetter = (mapping.phoneCol || 'A').toUpperCase();
    const nameColLetter = (mapping.nameCol || 'B').toUpperCase();
    const notesColLetter = (mapping.notesCol || 'C').toUpperCase();

    const seenPhones = new Set<string>();
    const rows: ParsedContactRow[] = [];
    let validCount = 0;
    let invalidCount = 0;
    let duplicateCount = 0;

    for (let i = startIndex; i < rawRowsData.length; i++) {
      const rowItem = rawRowsData[i];
      const cellValues = rowItem.cellValues;

      let rawPhone = '';
      let rawName = '';
      let rawNotes = '';
      const extraData: Record<string, any> = {};

      for (const col of columns) {
        const val = cellValues[col.colNumber - 1] || '';
        extraData[col.letter] = val;
        extraData[col.name] = val;
        extraData[col.header] = val;

        if (col.letter === phoneColLetter || col.name === mapping.phoneCol?.toLowerCase()) {
          rawPhone = val;
        }
        if (col.letter === nameColLetter || col.name === mapping.nameCol?.toLowerCase()) {
          rawName = val;
        }
        if (col.letter === notesColLetter || col.name === mapping.notesCol?.toLowerCase()) {
          rawNotes = val;
        }
      }

      // Fallbacks if not mapped
      if (!rawPhone && extraData['A']) rawPhone = extraData['A'];
      if (!rawName && extraData['B']) rawName = extraData['B'];
      if (!rawNotes && extraData['C']) rawNotes = extraData['C'];

      // Normalize phone
      const norm = normalizePhoneNumber(rawPhone);
      let isValid = norm.isValid;
      let errorReason = norm.errorMessage;

      if (isValid) {
        if (seenPhones.has(norm.normalized)) {
          isValid = false;
          errorReason = 'Nomor duplikat terdeteksi dalam file';
          duplicateCount++;
          invalidCount++;
        } else {
          seenPhones.add(norm.normalized);
          validCount++;
        }
      } else {
        invalidCount++;
      }

      // Set standard aliases
      extraData['nomor'] = norm.normalized || rawPhone;
      extraData['nama'] = rawName;
      extraData['keterangan'] = rawNotes;

      rows.push({
        rowNumber: rowItem.rowNumber,
        phone: rawPhone,
        normalizedPhone: norm.normalized,
        name: rawName,
        notes: rawNotes,
        isValid,
        errorReason,
        extraData
      });
    }

    return {
      sheetName,
      totalRows: rows.length,
      validRows: validCount,
      invalidRows: invalidCount,
      duplicateRows: duplicateCount,
      columns: columns.map(c => ({ letter: c.letter, name: c.name, header: c.header })),
      rows
    };
  }

  /**
   * Import parsed data into Database tables
   */
  public static async saveDatasetToDb(
    name: string,
    filename: string,
    parseResult: ExcelParseResult,
    createdBy: string = 'system'
  ): Promise<{ datasetId: number; validRows: number; invalidRows: number }> {
    return await db.transaction(async (trx) => {
      // 1. Insert dataset
      const dsRes = await trx.execute(
        `INSERT INTO contact_datasets (name, filename, total_rows, valid_rows, invalid_rows, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name, filename, parseResult.totalRows, parseResult.validRows, parseResult.invalidRows, createdBy]
      );
      const datasetId = dsRes.insertId;

      // 2. Insert columns
      for (const col of parseResult.columns) {
        await trx.execute(
          `INSERT INTO dataset_columns (dataset_id, column_letter, column_name, original_header)
           VALUES (?, ?, ?, ?)`,
          [datasetId, col.letter, col.name, col.header]
        );
      }

      // 3. Insert contacts & auto-grant consent for valid rows
      for (const row of parseResult.rows) {
        await trx.execute(
          `INSERT INTO contacts (dataset_id, phone_number, name, notes, extra_data_json, is_valid, validation_error)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            datasetId,
            row.normalizedPhone || row.phone,
            row.name,
            row.notes,
            JSON.stringify(row.extraData),
            row.isValid ? 1 : 0,
            row.errorReason || null
          ]
        );

        // Record consent for valid phone if not exists
        if (row.isValid && row.normalizedPhone) {
          const existingConsent = await trx.getOne(
            'SELECT id FROM contact_consents WHERE phone_number = ?',
            [row.normalizedPhone]
          );
          if (!existingConsent) {
            await trx.execute(
              `INSERT INTO contact_consents (phone_number, status, source)
               VALUES (?, 'granted', ?)`,
              [row.normalizedPhone, `import_${name}`]
            );
          }
        }
      }

      await logSystem(
        'SUCCESS',
        'EXCEL',
        `Dataset "${name}" berhasil disimpan (${parseResult.validRows} nomor valid, ${parseResult.invalidRows} tidak valid).`
      );

      return {
        datasetId,
        validRows: parseResult.validRows,
        invalidRows: parseResult.invalidRows
      };
    });
  }
}
