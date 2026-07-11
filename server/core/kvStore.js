import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

let dbInstance = null;
let maintenanceStarted = false;

const cleanupExpiredSessions = (database) => {
  const rows = database.prepare("SELECT key, value FROM kv_store WHERE key LIKE 'session:%'").all();
  if (rows.length === 0) return 0;

  const now = Date.now();
  const expiredKeys = [];
  for (const row of rows) {
    let data = null;
    try { data = JSON.parse(row.value); } catch {}
    if (!data || typeof data.expiresAt !== 'number' || data.expiresAt <= now) expiredKeys.push(row.key);
  }
  if (expiredKeys.length === 0) return 0;

  const statement = database.prepare('DELETE FROM kv_store WHERE key = ?');
  const transaction = database.transaction((keys) => {
    for (const key of keys) statement.run(key);
  });
  transaction(expiredKeys);
  return expiredKeys.length;
};

const startMaintenance = (database) => {
  try { cleanupExpiredSessions(database); } catch {}
  setInterval(() => {
    try { cleanupExpiredSessions(database); } catch {}
  }, 60 * 60 * 1000).unref();
};

export const ensureDb = () => {
  if (dbInstance) return dbInstance;
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  dbInstance = new Database(path.join(dataDir, 'local.db'));
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  if (!maintenanceStarted) {
    maintenanceStarted = true;
    startMaintenance(dbInstance);
  }
  return dbInstance;
};

export const dbGetJson = (database, key) => {
  const row = database.prepare('SELECT value FROM kv_store WHERE key = ?').get(key);
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
};

export const dbSetJson = (database, key, value) => {
  database.prepare('INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
};

export const dbDelete = (database, key) => {
  database.prepare('DELETE FROM kv_store WHERE key = ?').run(key);
};
