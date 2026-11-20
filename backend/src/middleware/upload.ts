import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { config } from '../config/index.js';

const uploadDir = config.storage.uploadDir;
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Storage engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

// Excel upload filter
export const uploadExcel = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;
    if (
      ext === '.xlsx' ||
      ext === '.xls' ||
      ext === '.csv' ||
      mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mime === 'application/vnd.ms-excel' ||
      mime === 'text/csv' ||
      mime === 'application/csv' ||
      mime === 'text/plain'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Format file tidak didukung. Harap upload file .xlsx, .xls, atau .csv'));
    }
  }
});

// Media upload filter (Images)
export const uploadMedia = multer({
  storage,
  limits: { fileSize: config.storage.maxFileSizeMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const validExts = ['.jpg', '.jpeg', '.png', '.webp'];
    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];

    if (validExts.includes(ext) && (validMimes.includes(file.mimetype) || file.mimetype.startsWith('image/'))) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar (JPG, JPEG, PNG, WebP) yang diizinkan'));
    }
  }
});
