import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { applySqliteMaintenance, inspectSqliteStorage } from './sqliteMaintenance.js';
import { buildSqliteDataMetrics } from './dataMetrics.js';

const temporaryDirectories = [];

const createDatabase = () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'anime-sa-maintenance-'));
  temporaryDirectories.push(directory);
  const database = new Database(path.join(directory, 'local.db'));
  database.exec(`
    CREATE TABLE kv_store (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE media_store (
      name TEXT PRIMARY KEY,
      content_type TEXT NOT NULL,
      bytes BLOB NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  return database;
};

const writeJson = (database, key, value) => {
  database.prepare('INSERT INTO kv_store (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
};

const publicDataWithCover = (coverUrl) => ({
  version: 1,
  updatedAt: 1,
  revision: 'revision-1',
  settings: { title: '收藏', iconUrl: '' },
  tags: [],
  cards: [{
    id: 'card-1',
    title: '条目',
    coverUrl,
    description: '',
    startDate: '',
    endDate: '',
    rating: 0,
    tagIds: [],
    isRecommended: false,
    isWatching: false,
    createdAt: 1,
    updatedAt: 1
  }]
});

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('SQLite maintenance', () => {
  it('reports storage pages and legacy media references without writing', () => {
    const database = createDatabase();
    writeJson(database, 'public_data', publicDataWithCover('/api/storage/media?name=used.webp'));
    writeJson(database, 'media:used.webp', { contentType: 'image/webp', base64: Buffer.from('used').toString('base64') });
    writeJson(database, 'media:unused.webp', { contentType: 'image/webp', base64: Buffer.from('unused').toString('base64') });

    const report = inspectSqliteStorage(database);

    expect(report.legacyMedia).toMatchObject({ count: 2, referenced: 1, unreferenced: 1 });
    expect(report.pageCount).toBeGreaterThan(0);
    expect(buildSqliteDataMetrics(database, { tags: [], cards: [] }).storage.driver).toBe('sqlite');
    database.close();
  });

  it('migrates referenced legacy media and removes unused media', () => {
    const database = createDatabase();
    writeJson(database, 'public_data', publicDataWithCover('/api/storage/media?name=used.webp'));
    writeJson(database, 'media:used.webp', { contentType: 'image/webp', base64: Buffer.from('used').toString('base64') });
    writeJson(database, 'media:unused.webp', { contentType: 'image/webp', base64: Buffer.from('unused').toString('base64') });

    const result = applySqliteMaintenance(database, { graceMs: 0, vacuum: false });

    expect(result.migrated).toBe(1);
    expect(result.gc.removed).toBe(1);
    expect(result.report.legacyMedia.count).toBe(0);
    expect(result.report.mediaTable.count).toBe(1);
    database.close();
  });

  it('aborts cleanup when public data is invalid', () => {
    const database = createDatabase();
    database.prepare('INSERT INTO kv_store (key, value) VALUES (?, ?)').run('public_data', '{invalid');
    database.prepare(`
      INSERT INTO media_store (name, content_type, bytes, updated_at)
      VALUES (?, ?, ?, ?)
    `).run('used.webp', 'image/webp', Buffer.from('used'), 0);

    expect(() => applySqliteMaintenance(database, { graceMs: 0, vacuum: false }))
      .toThrow('Stored public_data is invalid; maintenance aborted');
    expect(database.prepare('SELECT COUNT(*) AS count FROM media_store').get().count).toBe(1);
    database.close();
  });
});
