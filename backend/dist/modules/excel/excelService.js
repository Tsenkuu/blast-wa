"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExcelService = void 0;
const exceljs_1 = __importDefault(require("exceljs"));
const index_js_1 = require("../../database/index.js");
const normalizer_js_1 = require("../../utils/normalizer.js");
const logger_js_1 = require("../../utils/logger.js");
class ExcelService {
    /**
     * Helper to convert 1-based column index to letter (1 -> A, 2 -> B, 27 -> AA)
     */
    static colIndexToLetter(colIndex) {
        let letter = '';
        while (colIndex > 0) {
            const mod = (colIndex - 1) % 26;
            letter = String.fromCharCode(65 + mod) + letter;
            colIndex = Math.floor((colIndex - mod) / 26);
        }
        return letter;
    }
    /**
     * Parse an Excel file (.xlsx or .xls buffer) with preview and validation
     */
    static async parseExcelFile(filePathOrBuffer, sheetIndexOrName = 1, mapping = {}) {
        const workbook = new exceljs_1.default.Workbook();
        if (typeof filePathOrBuffer === 'string') {
            await workbook.xlsx.readFile(filePathOrBuffer);
        }
        else {
            await workbook.xlsx.load(filePathOrBuffer);
        }
        let worksheet;
        if (typeof sheetIndexOrName === 'number') {
            worksheet = workbook.getWorksheet(sheetIndexOrName);
        }
        else {
            worksheet = workbook.getWorksheet(sheetIndexOrName);
        }
        if (!worksheet) {
            worksheet = workbook.worksheets[0];
        }
        if (!worksheet) {
            throw new Error('File Excel tidak memiliki lembar kerja (worksheet).');
        }
        const headerRow = worksheet.getRow(1);
        const columns = [];
        // Read column headers
        headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            const letter = ExcelService.colIndexToLetter(colNumber);
            const rawVal = cell.value ? String(cell.value).trim() : `Kolom ${letter}`;
            // Clean header name for alias (lowercase alphanumeric without special characters)
            const cleanName = rawVal.toLowerCase().replace(/[^a-z0-9_]/g, '_');
            columns.push({
                letter,
                name: cleanName || `col_${letter.toLowerCase()}`,
                header: rawVal,
                colNumber
            });
        });
        // Default mapping if not provided:
        // A -> Phone, B -> Name, C -> Notes
        const phoneColLetter = (mapping.phoneCol || 'A').toUpperCase();
        const nameColLetter = (mapping.nameCol || 'B').toUpperCase();
        const notesColLetter = (mapping.notesCol || 'C').toUpperCase();
        const seenPhones = new Set();
        const rows = [];
        let validCount = 0;
        let invalidCount = 0;
        let duplicateCount = 0;
        const rowCount = worksheet.rowCount;
        for (let rowNumber = 2; rowNumber <= rowCount; rowNumber++) {
            const row = worksheet.getRow(rowNumber);
            if (!row || !row.hasValues)
                continue;
            let rawPhone = '';
            let rawName = '';
            let rawNotes = '';
            const extraData = {};
            for (const col of columns) {
                const cell = row.getCell(col.colNumber);
                const cellValue = cell.value !== null && cell.value !== undefined ? String(cell.value).trim() : '';
                extraData[col.letter] = cellValue;
                extraData[col.name] = cellValue;
                extraData[col.header] = cellValue;
                if (col.letter === phoneColLetter || col.name === mapping.phoneCol?.toLowerCase()) {
                    rawPhone = cellValue;
                }
                if (col.letter === nameColLetter || col.name === mapping.nameCol?.toLowerCase()) {
                    rawName = cellValue;
                }
                if (col.letter === notesColLetter || col.name === mapping.notesCol?.toLowerCase()) {
                    rawNotes = cellValue;
                }
            }
            // If phone wasn't mapped through specific columns, check Column A fallback
            if (!rawPhone && extraData['A']) {
                rawPhone = extraData['A'];
            }
            if (!rawName && extraData['B']) {
                rawName = extraData['B'];
            }
            if (!rawNotes && extraData['C']) {
                rawNotes = extraData['C'];
            }
            // Normalize phone
            const norm = (0, normalizer_js_1.normalizePhoneNumber)(rawPhone);
            let isValid = norm.isValid;
            let errorReason = norm.errorMessage;
            if (isValid) {
                if (seenPhones.has(norm.normalized)) {
                    isValid = false;
                    errorReason = 'Nomor duplikat terdeteksi dalam file';
                    duplicateCount++;
                    invalidCount++;
                }
                else {
                    seenPhones.add(norm.normalized);
                    validCount++;
                }
            }
            else {
                invalidCount++;
            }
            // Set standard aliases
            extraData['nomor'] = norm.normalized || rawPhone;
            extraData['nama'] = rawName;
            extraData['keterangan'] = rawNotes;
            rows.push({
                rowNumber,
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
            sheetName: worksheet.name,
            totalRows: rows.length,
            validRows: validCount,
            invalidRows: invalidCount,
            duplicateRows: duplicateCount,
            columns: columns.map(c => ({ letter: c.letter, name: c.name, header: c.header })),
            rows
        };
    }
    /**
     * Import parsed data into MySQL / Database tables
     */
    static async saveDatasetToDb(name, filename, parseResult, createdBy = 'system') {
        return await index_js_1.db.transaction(async (trx) => {
            // 1. Insert dataset
            const dsRes = await trx.execute(`INSERT INTO contact_datasets (name, filename, total_rows, valid_rows, invalid_rows, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`, [name, filename, parseResult.totalRows, parseResult.validRows, parseResult.invalidRows, createdBy]);
            const datasetId = dsRes.insertId;
            // 2. Insert columns
            for (const col of parseResult.columns) {
                await trx.execute(`INSERT INTO dataset_columns (dataset_id, column_letter, column_name, original_header)
           VALUES (?, ?, ?, ?)`, [datasetId, col.letter, col.name, col.header]);
            }
            // 3. Insert contacts & auto-grant consent for valid rows
            for (const row of parseResult.rows) {
                await trx.execute(`INSERT INTO contacts (dataset_id, phone_number, name, notes, extra_data_json, is_valid, validation_error)
           VALUES (?, ?, ?, ?, ?, ?, ?)`, [
                    datasetId,
                    row.normalizedPhone || row.phone,
                    row.name,
                    row.notes,
                    JSON.stringify(row.extraData),
                    row.isValid ? 1 : 0,
                    row.errorReason || null
                ]);
                // Record consent for valid phone if not exists
                if (row.isValid && row.normalizedPhone) {
                    const existingConsent = await trx.getOne('SELECT id FROM contact_consents WHERE phone_number = ?', [row.normalizedPhone]);
                    if (!existingConsent) {
                        await trx.execute(`INSERT INTO contact_consents (phone_number, status, source)
               VALUES (?, 'granted', ?)`, [row.normalizedPhone, `import_${name}`]);
                    }
                }
            }
            await (0, logger_js_1.logSystem)('SUCCESS', 'EXCEL', `Dataset "${name}" berhasil disimpan (${parseResult.validRows} nomor valid, ${parseResult.invalidRows} tidak valid).`);
            return {
                datasetId,
                validRows: parseResult.validRows,
                invalidRows: parseResult.invalidRows
            };
        });
    }
}
exports.ExcelService = ExcelService;
