import fs from 'node:fs';

export const createFileStatCache = ({
  ttlMs = 5000,
  maxEntries = 512,
  stat = (filePath) => fs.promises.stat(filePath),
  now = () => Date.now()
} = {}) => {
  const entries = new Map();

  const prune = (currentTime) => {
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= currentTime) entries.delete(key);
    }
    while (entries.size >= maxEntries) {
      const oldest = entries.keys().next().value;
      if (oldest === undefined) break;
      entries.delete(oldest);
    }
  };

  const get = async (filePath) => {
    const currentTime = now();
    const cached = entries.get(filePath);
    if (cached && cached.expiresAt > currentTime) {
      entries.delete(filePath);
      entries.set(filePath, cached);
      return cached.value;
    }
    if (cached) entries.delete(filePath);

    let value;
    try {
      const fileStat = await stat(filePath);
      value = { stat: fileStat, isDirectory: fileStat.isDirectory(), missing: false };
    } catch (error) {
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT') throw error;
      value = { stat: null, isDirectory: false, missing: true };
    }

    prune(currentTime);
    entries.set(filePath, { value, expiresAt: currentTime + ttlMs });
    return value;
  };

  return { get, size: () => entries.size, clear: () => entries.clear() };
};
