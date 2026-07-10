import { normalizeMediaName } from '../sharedSecurity.js';
import { dbDelete } from './kvStore.js';
import { deleteWebDavCoverFile, listWebDavCoverNames } from './webdavStore.js';

export const parseCoverReferenceSets = (publicData) => {
  const sqliteNames = new Set();
  const webdavNames = new Set();
  const cards = Array.isArray(publicData?.cards) ? publicData.cards : [];

  const collect = (rawUrl) => {
    const raw = String(rawUrl || '');
    if (!raw) return;
    let parsed;
    try { parsed = new URL(raw, 'http://local'); } catch { return; }

    if (parsed.pathname === '/api/sqlite/media') {
      const name = normalizeMediaName(parsed.searchParams.get('name'));
      if (name) sqliteNames.add(name);
    }
    if (parsed.pathname === '/api/webdav') {
      const filename = decodeURIComponent(parsed.searchParams.get('filename') || '');
      if (filename.startsWith('covers/')) {
        const name = normalizeMediaName(filename.slice('covers/'.length));
        if (name) webdavNames.add(name);
      }
    }
  };

  for (const card of cards) {
    collect(card?.coverUrl);
    collect(card?.coverVariants?.thumb);
    collect(card?.coverVariants?.card);
    collect(card?.coverVariants?.original);
  }
  return { sqliteNames, webdavNames };
};

export const collectSqliteMediaNames = (database) => {
  const rows = database.prepare("SELECT key FROM kv_store WHERE key LIKE 'media:%'").all();
  const names = [];
  for (const row of rows) {
    const key = String(row.key || '');
    if (!key.startsWith('media:')) continue;
    const name = normalizeMediaName(key.slice('media:'.length));
    if (name) names.push(name);
  }
  return names;
};

export const cleanupSqliteUnusedMedia = (database, referencedNames, limit = 100) => {
  const allNames = collectSqliteMediaNames(database);
  const removable = allNames.filter((name) => !referencedNames.has(name));
  const candidates = removable.slice(0, Math.max(1, limit));
  for (const name of candidates) dbDelete(database, `media:${name}`);
  const removed = candidates.length;
  const pending = Math.max(0, removable.length - removed);
  return { checked: allNames.length, removed, pending, hasMore: pending > 0 };
};

export const cleanupWebDavUnusedMedia = async (env, referencedNames, limit = 100) => {
  const allNames = await listWebDavCoverNames(env);
  const removable = allNames.filter((name) => !referencedNames.has(name));
  const candidates = removable.slice(0, Math.max(1, limit));
  for (const name of candidates) await deleteWebDavCoverFile(env, name);
  const removed = candidates.length;
  const pending = Math.max(0, removable.length - removed);
  return { checked: allNames.length, removed, pending, hasMore: pending > 0 };
};
