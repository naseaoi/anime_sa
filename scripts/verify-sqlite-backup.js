import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const backupPath = process.argv[2];
if (!backupPath) {
  console.error('Usage: node scripts/verify-sqlite-backup.js <backup.db>');
  process.exit(2);
}

const resolvedPath = path.resolve(backupPath);
if (!fs.existsSync(resolvedPath)) {
  console.error(`Backup not found: ${resolvedPath}`);
  process.exit(1);
}

let database;
try {
  database = new Database(resolvedPath, { readonly: true, fileMustExist: true });
  const integrity = database.pragma('integrity_check', { simple: true });
  if (integrity !== 'ok') throw new Error(`SQLite integrity check failed: ${integrity}`);
  const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name);
  if (!tables.includes('kv_store')) throw new Error('Backup does not contain kv_store');
  console.log(JSON.stringify({ ok: true, path: resolvedPath, tables }));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  database?.close();
}
