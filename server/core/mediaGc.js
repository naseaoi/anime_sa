import { normalizeMediaName } from '../sharedSecurity.js';
import { dbDeleteMedia, dbListMediaEntries, dbListMediaNames } from './kvStore.js';

export const MEDIA_GC_GRACE_MS = 24 * 60 * 60 * 1000;

export const parseMediaReferences = (publicData) => {
  const names = new Set();
  const cards = Array.isArray(publicData?.cards) ? publicData.cards : [];

  const collect = (rawUrl) => {
    const raw = String(rawUrl || '');
    if (!raw) return;
    let parsed;
    try { parsed = new URL(raw, 'http://local'); } catch { return; }

    if (parsed.pathname === '/api/storage/media' || parsed.pathname === '/api/sqlite/media') {
      const name = normalizeMediaName(parsed.searchParams.get('name'));
      if (name) names.add(name);
    }
  };

  for (const card of cards) {
    collect(card?.coverUrl);
    collect(card?.coverVariants?.thumb);
    collect(card?.coverVariants?.card);
    collect(card?.coverVariants?.original);
  }
  return names;
};

export const collectSqliteMediaNames = (database) => {
  const names = [];
  for (const rawName of dbListMediaNames(database)) {
    const name = normalizeMediaName(rawName);
    if (name) names.push(name);
  }
  return names;
};

export const cleanupSqliteUnusedMedia = (
  database,
  referencedNames,
  limit = 100,
  now = Date.now(),
  graceMs = MEDIA_GC_GRACE_MS
) => {
  const entries = dbListMediaEntries(database)
    .map((entry) => ({ name: normalizeMediaName(entry.name), updatedAt: Number(entry.updatedAt || 0) }))
    .filter((entry) => entry.name);
  const unreferenced = entries.filter((entry) => !referencedNames.has(entry.name));
  const removable = unreferenced.filter((entry) => entry.updatedAt <= now - graceMs);
  const candidates = removable.slice(0, Math.max(1, limit));
  for (const entry of candidates) dbDeleteMedia(database, entry.name);
  const removed = candidates.length;
  const pending = Math.max(0, removable.length - removed);
  return {
    checked: entries.length,
    removed,
    deferred: unreferenced.length - removable.length,
    pending,
    hasMore: pending > 0
  };
};
