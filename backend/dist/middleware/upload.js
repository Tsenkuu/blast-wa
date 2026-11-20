"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadMedia = exports.uploadExcel = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
const index_js_1 = require("../config/index.js");
const uploadDir = index_js_1.config.storage.uploadDir;
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
// Storage engine
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        const uniqueSuffix = `${Date.now()}_${crypto_1.default.randomBytes(6).toString('hex')}`;
        cb(null, `${uniqueSuffix}${ext}`);
    }
});
// Excel upload filter
exports.uploadExcel = (0, multer_1.default)({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
    fileFilter: (req, file, cb) => {
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        const mime = file.mimetype;
        if (ext === '.xlsx' ||
            ext === '.xls' ||
            ext === '.csv' ||
            mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            mime === 'application/vnd.ms-excel' ||
            mime === 'text/csv' ||
            mime === 'application/csv' ||
            mime === 'text/plain') {
            cb(null, true);
        }
        else {
            cb(new Error('Format file tidak didukung. Harap upload file .xlsx, .xls, atau .csv'));
        }
    }
});
// Media upload filter (Images)
exports.uploadMedia = (0, multer_1.default)({
    storage,
    limits: { fileSize: index_js_1.config.storage.maxFileSizeMb * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        const validExts = ['.jpg', '.jpeg', '.png', '.webp'];
        const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
        if (validExts.includes(ext) && (validMimes.includes(file.mimetype) || file.mimetype.startsWith('image/'))) {
            cb(null, true);
        }
        else {
            cb(new Error('Hanya file gambar (JPG, JPEG, PNG, WebP) yang diizinkan'));
        }
    }
});
