import { MEDIA_GC_GRACE_MS, cleanupSqliteUnusedMedia, parseMediaReferences } from './mediaGc.js';
import { normalizePublicDataPayload } from '../publicDataValidation.js';
import { dbSetMedia } from './kvStore.js';

const readLegacyRows = (database) => database
  .prepare("SELECT key, value FROM kv_store WHERE key LIKE 'media:%'")
  .all();

const parseLegacyMedia = (row) => {
  try {
    const value = JSON.parse(String(row.value || ''));
    if (typeof value?.base64 !== 'string' || value.base64.length === 0) return null;
    return {
      name: String(row.key).slice('media:'.length),
      contentType: String(value.contentType || 'application/octet-stream'),
      bytes: Buffer.from(value.base64, 'base64')
    };
  } catch {
    return null;
  }
};

const readMaintenancePublicData = (database) => {
  const row = database.prepare('SELECT value FROM kv_store WHERE key = ?').get('public_data');
  if (!row) return { cards: [] };

  let value;
  try {
    value = JSON.parse(String(row.value || ''));
  } catch {
    throw new Error('Stored public_data is invalid; maintenance aborted');
  }
  const normalized = normalizePublicDataPayload(value);
  if (!normalized) throw new Error('Stored public_data is invalid; maintenance aborted');
  return normalized;
};

export const inspectSqliteStorage = (database) => {
  const pageSize = Number(database.pragma('page_size', { simple: true }) || 0);
  const pageCount = Number(database.pragma('page_count', { simple: true }) || 0);
  const freePages = Number(database.pragma('freelist_count', { simple: true }) || 0);
  const publicData = readMaintenancePublicData(database);
  const references = parseMediaReferences(publicData);
  const legacyRows = readLegacyRows(database);
  const mediaTable = database.prepare(`
    SELECT COUNT(*) AS count,
           COALESCE(SUM(LENGTH(bytes)), 0) AS bytes
    FROM media_store
  `).get();

  let legacyBytes = 0;
  let referencedLegacy = 0;
  let unreferencedLegacy = 0;
  let invalidLegacy = 0;
  for (const row of legacyRows) {
    const media = parseLegacyMedia(row);
    if (!media) {
      invalidLegacy += 1;
      continue;
    }
    legacyBytes += media.bytes.length;
    if (references.has(media.name)) referencedLegacy += 1;
    else unreferencedLegacy += 1;
  }

  return {
    pageSize,
    pageCount,
    freePages,
    fileBytes: pageSize * pageCount,
    freeBytes: pageSize * freePages,
    legacyMedia: {
      count: legacyRows.length,
      bytes: legacyBytes,
      referenced: referencedLegacy,
      unreferenced: unreferencedLegacy,
      invalid: invalidLegacy
    },
    mediaTable: {
      count: Number(mediaTable?.count || 0),
      bytes: Number(mediaTable?.bytes || 0)
    }
  };
};

export const applySqliteMaintenance = (
  database,
  { now = Date.now(), graceMs = MEDIA_GC_GRACE_MS, vacuum = true } = {}
) => {
  const publicData = readMaintenancePublicData(database);
  const references = parseMediaReferences(publicData);
  let migrated = 0;

  for (const row of readLegacyRows(database)) {
    const media = parseLegacyMedia(row);
    if (!media || !references.has(media.name)) continue;
    dbSetMedia(database, media.name, media.contentType, media.bytes);
    migrated += 1;
  }

  const gc = cleanupSqliteUnusedMedia(database, references, Number.MAX_SAFE_INTEGER, now, graceMs);
  if (vacuum) database.exec('VACUUM');
  return { migrated, gc, report: inspectSqliteStorage(database) };
};
