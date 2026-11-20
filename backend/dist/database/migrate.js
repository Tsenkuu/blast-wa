"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const index_js_1 = require("./index.js");
async function runMigrations() {
    console.log('🔄 Running migrations...');
    await index_js_1.db.init();
    if (index_js_1.db.isUsingSqlite) {
        console.log('✅ SQLite schema initialized automatically.');
        return;
    }
    // MySQL migration runner
    const schemaPath = path_1.default.resolve(__dirname, 'schema.sql');
    if (fs_1.default.existsSync(schemaPath)) {
        const sql = fs_1.default.readFileSync(schemaPath, 'utf8');
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);
        for (const statement of statements) {
            await index_js_1.db.execute(statement);
        }
        console.log(`✅ Applied ${statements.length} MySQL migration statements successfully.`);
    }
}
if (process.argv[1]?.includes('migrate')) {
    runMigrations()
        .then(() => process.exit(0))
        .catch((err) => {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    });
}
