export const STORAGE_DRIVERS = ['sqlite', 'redis'];

const hasRedisUrl = (env) => !!String(env?.REDIS_URL || '').trim();

export const resolveStorageDriver = (env) => {
  const raw = String(env?.STORAGE_DRIVER || 'sqlite').trim().toLowerCase();
  if (!STORAGE_DRIVERS.includes(raw)) {
    throw new Error(`Invalid STORAGE_DRIVER "${raw}", expected one of: ${STORAGE_DRIVERS.join(', ')}`);
  }
  if (raw === 'redis' && !hasRedisUrl(env)) {
    throw new Error('STORAGE_DRIVER=redis requires REDIS_URL');
  }
  return raw;
};

export const listAvailableDrivers = (env) => (hasRedisUrl(env) ? STORAGE_DRIVERS.slice() : ['sqlite']);
