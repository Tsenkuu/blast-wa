import fs from 'fs';
import path from 'path';
import { db } from './index.js';

export async function runMigrations() {
  console.log('🔄 Running migrations...');
  await db.init();

  if (db.isUsingSqlite) {
    console.log('✅ SQLite schema initialized automatically.');
    return;
  }

  // MySQL migration runner
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const sql = fs.readFileSync(schemaPath, 'utf8');
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      await db.execute(statement);
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
