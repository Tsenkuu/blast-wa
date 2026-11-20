"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
const sql_js_1 = __importDefault(require("sql.js"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const index_js_1 = require("../config/index.js");
class DatabaseManager {
    mysqlPool = null;
    sqliteDb = null;
    isUsingSqlite = false;
    initialized = false;
    sqliteFilePath = '';
    inTransaction = false;
    async init() {
        if (this.initialized)
            return;
        if (index_js_1.config.db.client === 'sqlite') {
            await this.initSqlite();
            this.initialized = true;
            return;
        }
        try {
            this.mysqlPool = promise_1.default.createPool({
                host: index_js_1.config.db.host,
                port: index_js_1.config.db.port,
                user: index_js_1.config.db.user,
                password: index_js_1.config.db.password,
                database: index_js_1.config.db.database,
                waitForConnections: index_js_1.config.db.waitForConnections,
                connectionLimit: index_js_1.config.db.connectionLimit,
                queueLimit: index_js_1.config.db.queueLimit,
                multipleStatements: true,
                charset: 'utf8mb4'
            });
            // Test connection
            const conn = await this.mysqlPool.getConnection();
            conn.release();
            this.isUsingSqlite = false;
            this.initialized = true;
            console.log('✅ Connected to MySQL database:', index_js_1.config.db.database);
        }
        catch (err) {
            console.warn('⚠️ MySQL connection failed (' + err.message + '). Falling back to SQLite/WASM for local development & testing.');
            await this.initSqlite();
            this.initialized = true;
        }
    }
    async initSqlite() {
        const SQL = await (0, sql_js_1.default)();
        this.sqliteFilePath = index_js_1.config.db.sqlitePath;
        const dir = path_1.default.dirname(this.sqliteFilePath);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        if (fs_1.default.existsSync(this.sqliteFilePath)) {
            const fileBuffer = fs_1.default.readFileSync(this.sqliteFilePath);
            this.sqliteDb = new SQL.Database(fileBuffer);
        }
        else {
            this.sqliteDb = new SQL.Database();
        }
        this.isUsingSqlite = true;
        console.log('✅ SQLite WASM database active at:', this.sqliteFilePath);
        this.bootstrapSqliteTables();
        this.persistSqlite();
    }
    persistSqlite() {
        if (this.sqliteDb && this.sqliteFilePath) {
            const data = this.sqliteDb.export();
            fs_1.default.writeFileSync(this.sqliteFilePath, Buffer.from(data));
        }
    }
    bootstrapSqliteTables() {
        if (!this.sqliteDb)
            return;
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
        }
        catch (e) {
            // Column already exists
        }
    }
    async query(sql, params = []) {
        if (!this.initialized)
            await this.init();
        if (this.isUsingSqlite && this.sqliteDb) {
            try {
                const stmt = this.sqliteDb.prepare(sql);
                if (params && params.length > 0) {
                    stmt.bind(params);
                }
                const rows = [];
                while (stmt.step()) {
                    rows.push(stmt.getAsObject());
                }
                stmt.free();
                return rows;
            }
            catch (err) {
                throw new Error(`SQLite Query error: ${err.message} in: ${sql}`);
            }
        }
        else if (this.mysqlPool) {
            const [rows] = await this.mysqlPool.query(sql, params);
            return rows;
        }
        throw new Error('Database not initialized');
    }
    async getOne(sql, params = []) {
        const rows = await this.query(sql, params);
        return rows.length > 0 ? rows[0] : null;
    }
    async execute(sql, params = []) {
        if (!this.initialized)
            await this.init();
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
            }
            catch (err) {
                throw new Error(`SQLite Execute error: ${err.message} in: ${sql}`);
            }
        }
        else if (this.mysqlPool) {
            const [res] = await this.mysqlPool.execute(sql, params);
            return {
                insertId: res.insertId || 0,
                affectedRows: res.affectedRows || 0
            };
        }
        throw new Error('Database not initialized');
    }
    async transaction(cb) {
        if (!this.initialized)
            await this.init();
        if (this.isUsingSqlite && this.sqliteDb) {
            this.inTransaction = true;
            this.sqliteDb.exec('BEGIN TRANSACTION');
            try {
                const result = await cb(this);
                this.sqliteDb.exec('COMMIT');
                this.inTransaction = false;
                this.persistSqlite();
                return result;
            }
            catch (err) {
                this.sqliteDb.exec('ROLLBACK');
                this.inTransaction = false;
                throw err;
            }
        }
        else if (this.mysqlPool) {
            const conn = await this.mysqlPool.getConnection();
            await conn.beginTransaction();
            try {
                const trxInterface = {
                    query: async (sql, params) => {
                        const [rows] = await conn.query(sql, params);
                        return rows;
                    },
                    getOne: async (sql, params) => {
                        const [rows] = await conn.query(sql, params);
                        return rows.length > 0 ? rows[0] : null;
                    },
                    execute: async (sql, params) => {
                        const [res] = await conn.execute(sql, params);
                        return {
                            insertId: res.insertId || 0,
                            affectedRows: res.affectedRows || 0
                        };
                    },
                    transaction: async (innerCb) => innerCb(trxInterface)
                };
                const res = await cb(trxInterface);
                await conn.commit();
                conn.release();
                return res;
            }
            catch (err) {
                await conn.rollback();
                conn.release();
                throw err;
            }
        }
        throw new Error('Database not initialized');
    }
}
exports.db = new DatabaseManager();
