import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  jwtSecret: process.env.JWT_SECRET || 'wa-blast-manager-pro-super-secret-key-2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  
  db: {
    client: process.env.DB_CLIENT || 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'wa_blast_pro',
    waitForConnections: true,
    connectionLimit: 15,
    queueLimit: 0,
    sqlitePath: process.env.DB_SQLITE_PATH || path.resolve(process.cwd(), 'data/wa_blast.db')
  },

  storage: {
    dataDir: process.env.DATA_DIR || path.resolve(process.cwd(), 'data'),
    uploadDir: process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'data/uploads'),
    sessionsDir: process.env.SESSIONS_DIR || path.resolve(process.cwd(), 'data/sessions'),
    maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '15', 10)
  },

  queue: {
    minDelayMs: parseInt(process.env.MESSAGE_DELAY_MIN_MS || '10000', 10),  // Default 10 detik (lebih aman)
    maxDelayMs: parseInt(process.env.MESSAGE_DELAY_MAX_MS || '20000', 10),  // Default 20 detik
    maxRetries: parseInt(process.env.MAX_RETRY_LIMIT || '2', 10),
    circuitBreakerFailStreak: parseInt(process.env.CIRCUIT_BREAKER_FAIL_STREAK || '5', 10),
    circuitBreakerFailRate: parseFloat(process.env.CIRCUIT_BREAKER_FAIL_RATE || '0.25')
  },

  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000', 'http://127.0.0.1:3000']
  }
};
