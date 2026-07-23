import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

let dbInstance = null;
let maintenanceStarted = false;

const ensureMediaTable = (database) => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS media_store (
      name TEXT PRIMARY KEY,
      content_type TEXT NOT NULL,
      bytes BLOB NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
};

export const resolveSqliteDataDir = (env = process.env) => {
  const configuredDir = String(env.SQLITE_DATA_DIR || '').trim();
  if (configuredDir.includes('\0') || configuredDir.length > 4096) {
    throw new Error('Invalid SQLITE_DATA_DIR');
  }
  return path.resolve(configuredDir || path.join(process.cwd(), 'data'));
};

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
  const dataDir = resolveSqliteDataDir();
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  dbInstance = new Database(path.join(dataDir, 'local.db'));
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS media_store (
      name TEXT PRIMARY KEY,
      content_type TEXT NOT NULL,
      bytes BLOB NOT NULL,
      updated_at INTEGER NOT NULL
    );
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

export const dbGetMedia = (database, name) => {
  ensureMediaTable(database);
  const row = database.prepare('SELECT content_type, bytes FROM media_store WHERE name = ?').get(name);
  if (row?.bytes) return { contentType: String(row.content_type), bytes: Buffer.from(row.bytes) };

  const legacy = dbGetJson(database, `media:${name}`);
  if (!legacy?.base64) return null;
  const media = {
    contentType: String(legacy.contentType || 'application/octet-stream'),
    bytes: Buffer.from(legacy.base64, 'base64')
  };
  dbSetMedia(database, name, media.contentType, media.bytes);
  return media;
};

export const dbSetMedia = (database, name, contentType, bytes) => {
  ensureMediaTable(database);
  const transaction = database.transaction(() => {
    database.prepare(`
      INSERT INTO media_store (name, content_type, bytes, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        content_type = excluded.content_type,
        bytes = excluded.bytes,
        updated_at = excluded.updated_at
    `).run(name, contentType, Buffer.from(bytes), Date.now());
    database.prepare('DELETE FROM kv_store WHERE key = ?').run(`media:${name}`);
  });
  transaction();
};

export const dbDeleteMedia = (database, name) => {
  ensureMediaTable(database);
  const transaction = database.transaction(() => {
    database.prepare('DELETE FROM media_store WHERE name = ?').run(name);
    database.prepare('DELETE FROM kv_store WHERE key = ?').run(`media:${name}`);
  });
  transaction();
};

export const dbListMediaNames = (database) => {
  ensureMediaTable(database);
  const names = new Set(database.prepare('SELECT name FROM media_store').all().map((row) => String(row.name)));
  const legacyRows = database.prepare("SELECT key FROM kv_store WHERE key LIKE 'media:%'").all();
  for (const row of legacyRows) names.add(String(row.key).slice('media:'.length));
  return [...names];
};

export const dbListMediaEntries = (database) => {
  ensureMediaTable(database);
  const entries = new Map(database.prepare('SELECT name, updated_at FROM media_store').all().map((row) => [
    String(row.name),
    { name: String(row.name), updatedAt: Number(row.updated_at || 0) }
  ]));
  const legacyRows = database.prepare("SELECT key FROM kv_store WHERE key LIKE 'media:%'").all();
  for (const row of legacyRows) {
    const name = String(row.key).slice('media:'.length);
    if (!entries.has(name)) entries.set(name, { name, updatedAt: 0 });
  }
  return [...entries.values()];
};
