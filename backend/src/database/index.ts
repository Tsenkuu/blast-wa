import mysql from 'mysql2/promise';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';

export interface DatabaseInterface {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  getOne<T = any>(sql: string, params?: any[]): Promise<T | null>;
  execute(sql: string, params?: any[]): Promise<{ insertId: number; affectedRows: number }>;
  transaction<T>(cb: (trx: DatabaseInterface) => Promise<T>): Promise<T>;
}

class DatabaseManager implements DatabaseInterface {
  private mysqlPool: mysql.Pool | null = null;
  private sqliteDb: SqlJsDatabase | null = null;
  public isUsingSqlite: boolean = false;
  private initialized: boolean = false;
  private sqliteFilePath: string = '';
  private inTransaction: boolean = false;

  public async init(): Promise<void> {
    if (this.initialized) return;

    if (config.db.client === 'sqlite') {
      await this.initSqlite();
      this.initialized = true;
      return;
    }

    try {
      this.mysqlPool = mysql.createPool({
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
        database: config.db.database,
        waitForConnections: config.db.waitForConnections,
        connectionLimit: config.db.connectionLimit,
        queueLimit: config.db.queueLimit,
        multipleStatements: true,
        charset: 'utf8mb4'
      });

      // Test connection
      const conn = await this.mysqlPool.getConnection();
      conn.release();
      this.isUsingSqlite = false;
      this.initialized = true;
      console.log('✅ Connected to MySQL database:', config.db.database);
    } catch (err: any) {
      console.warn('⚠️ MySQL connection failed (' + err.message + '). Falling back to SQLite/WASM for local development & testing.');
      await this.initSqlite();
      this.initialized = true;
    }
  }

  private async initSqlite(): Promise<void> {
    const SQL = await initSqlJs();
    this.sqliteFilePath = config.db.sqlitePath;
    const dir = path.dirname(this.sqliteFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.sqliteFilePath)) {
      const fileBuffer = fs.readFileSync(this.sqliteFilePath);
      this.sqliteDb = new SQL.Database(fileBuffer);
    } else {
      this.sqliteDb = new SQL.Database();
    }

    this.isUsingSqlite = true;
    console.log('✅ SQLite WASM database active at:', this.sqliteFilePath);
    this.bootstrapSqliteTables();
    this.persistSqlite();
  }

  private persistSqlite(): void {
    if (this.sqliteDb && this.sqliteFilePath) {
      const data = this.sqliteDb.export();
      fs.writeFileSync(this.sqliteFilePath, Buffer.from(data));
    }
  }

  private bootstrapSqliteTables(): void {
    if (!this.sqliteDb) return;
    this.sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role_id INTEGER NOT NULL,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (role_id) REFERENCES roles(id)
      );

      CREATE TABLE IF NOT EXISTS whatsapp_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_name TEXT NOT NULL UNIQUE,
        phone_number TEXT,
        push_name TEXT,
        status TEXT DEFAULT 'disconnected',
        last_connected_at DATETIME,
        is_active INTEGER DEFAULT 1,
        qr_code TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS whatsapp_admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone_number TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        can_broadcast INTEGER DEFAULT 1,
        can_manage_excel INTEGER DEFAULT 1,
        can_manage_sessions INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        notify_on_events INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS contact_datasets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        filename TEXT NOT NULL,
        total_rows INTEGER DEFAULT 0,
        valid_rows INTEGER DEFAULT 0,
        invalid_rows INTEGER DEFAULT 0,
        created_by TEXT DEFAULT 'system',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS dataset_columns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dataset_id INTEGER NOT NULL,
        column_letter TEXT NOT NULL,
        column_name TEXT NOT NULL,
        original_header TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (dataset_id) REFERENCES contact_datasets(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dataset_id INTEGER NOT NULL,
        phone_number TEXT NOT NULL,
        name TEXT,
        notes TEXT,
        extra_data_json TEXT,
        is_valid INTEGER DEFAULT 1,
        validation_error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (dataset_id) REFERENCES contact_datasets(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS contact_consents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone_number TEXT NOT NULL UNIQUE,
        status TEXT DEFAULT 'granted',
        source TEXT DEFAULT 'import',
        consented_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS opt_outs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone_number TEXT NOT NULL UNIQUE,
        reason TEXT DEFAULT 'user_requested',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS message_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        has_media INTEGER DEFAULT 0,
        default_media_id INTEGER,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS media_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        storage_path TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS broadcasts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        broadcast_code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        dataset_id INTEGER NOT NULL,
        template_id INTEGER,
        custom_message TEXT NOT NULL,
        media_id INTEGER,
        delay_seconds INTEGER DEFAULT 4,
        status TEXT DEFAULT 'draft',
        total_recipients INTEGER DEFAULT 0,
        sent_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        skipped_count INTEGER DEFAULT 0,
        pending_count INTEGER DEFAULT 0,
        scheduled_at DATETIME,
        started_at DATETIME,
        completed_at DATETIME,
        paused_at DATETIME,
        created_by_admin_id INTEGER,
        created_by_user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS broadcast_recipients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        broadcast_id INTEGER NOT NULL,
        contact_id INTEGER,
        phone_number TEXT NOT NULL,
        recipient_name TEXT,
        personalized_message TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        error_reason TEXT,
        attempts INTEGER DEFAULT 0,
        last_attempt_at DATETIME,
        sent_at DATETIME,
        idempotency_key TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (broadcast_id) REFERENCES broadcasts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS outgoing_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        broadcast_id INTEGER,
        recipient_id INTEGER,
        phone_number TEXT NOT NULL,
        message_type TEXT DEFAULT 'text',
        content TEXT,
        media_path TEXT,
        status TEXT DEFAULT 'sent',
        baileys_message_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS notification_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_phone TEXT NOT NULL,
        event_type TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'sent',
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT DEFAULT 'INFO',
        module TEXT NOT NULL,
        message TEXT NOT NULL,
        metadata_json TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        resource TEXT,
        details_json TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key_name TEXT NOT NULL UNIQUE,
        value_text TEXT NOT NULL,
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Auto-migrate delay_seconds if not exists
    try {
      this.sqliteDb.exec('ALTER TABLE broadcasts ADD COLUMN delay_seconds INTEGER DEFAULT 4;');
    } catch (e) {
      // Column already exists
    }
  }

  public async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.initialized) await this.init();

    if (this.isUsingSqlite && this.sqliteDb) {
      try {
        const stmt = this.sqliteDb.prepare(sql);
        if (params && params.length > 0) {
          stmt.bind(params);
        }
        const rows: T[] = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject() as unknown as T);
        }
        stmt.free();
        return rows;
      } catch (err: any) {
        throw new Error(`SQLite Query error: ${err.message} in: ${sql}`);
      }
    } else if (this.mysqlPool) {
      const [rows] = await this.mysqlPool.query(sql, params);
      return rows as T[];
    }
    throw new Error('Database not initialized');
  }

  public async getOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  public async execute(sql: string, params: any[] = []): Promise<{ insertId: number; affectedRows: number }> {
    if (!this.initialized) await this.init();

    if (this.isUsingSqlite && this.sqliteDb) {
      try {
        this.sqliteDb.run(sql, params);
        const lastIdResult = this.sqliteDb.exec('SELECT last_insert_rowid() as id');
        const insertId = lastIdResult[0]?.values[0]?.[0] ? Number(lastIdResult[0].values[0][0]) : 0;
        const affectedRows = this.sqliteDb.getRowsModified();
        if (!this.inTransaction) {
          this.persistSqlite();
        }
        return { insertId, affectedRows };
      } catch (err: any) {
        throw new Error(`SQLite Execute error: ${err.message} in: ${sql}`);
      }
    } else if (this.mysqlPool) {
      const [res]: any = await this.mysqlPool.execute(sql, params);
      return {
        insertId: res.insertId || 0,
        affectedRows: res.affectedRows || 0
      };
    }
    throw new Error('Database not initialized');
  }

  public async transaction<T>(cb: (trx: DatabaseInterface) => Promise<T>): Promise<T> {
    if (!this.initialized) await this.init();

    if (this.isUsingSqlite && this.sqliteDb) {
      this.inTransaction = true;
      this.sqliteDb.exec('BEGIN TRANSACTION');
      try {
        const result = await cb(this);
        this.sqliteDb.exec('COMMIT');
        this.inTransaction = false;
        this.persistSqlite();
        return result;
      } catch (err) {
        this.sqliteDb.exec('ROLLBACK');
        this.inTransaction = false;
        throw err;
      }
    } else if (this.mysqlPool) {
      const conn = await this.mysqlPool.getConnection();
      await conn.beginTransaction();
      try {
        const trxInterface: DatabaseInterface = {
          query: async <U>(sql: string, params?: any[]) => {
            const [rows] = await conn.query(sql, params);
            return rows as U[];
          },
          getOne: async <U>(sql: string, params?: any[]) => {
            const [rows]: any = await conn.query(sql, params);
            return rows.length > 0 ? rows[0] : null;
          },
          execute: async (sql: string, params?: any[]) => {
            const [res]: any = await conn.execute(sql, params);
            return {
              insertId: res.insertId || 0,
              affectedRows: res.affectedRows || 0
            };
          },
          transaction: async <U>(innerCb: any) => innerCb(trxInterface)
        };
        const res = await cb(trxInterface);
        await conn.commit();
        conn.release();
        return res;
      } catch (err) {
        await conn.rollback();
        conn.release();
        throw err;
      }
    }
    throw new Error('Database not initialized');
  }
}

export const db = new DatabaseManager();
