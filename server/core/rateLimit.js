export const createInMemoryRateLimiter = () => {
  const store = new Map();

  const cleanup = (now) => {
    for (const [key, value] of store) {
      if (value.resetAt <= now) store.delete(key);
    }
  };

  const check = (scope, clientIp, max, windowMs) => {
    const now = Date.now();
    cleanup(now);
    const key = `${scope}:${clientIp}`;
    const record = store.get(key);
    if (!record || record.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, retryAfterSec: 0 };
    }
    if (record.count >= max) {
      return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((record.resetAt - now) / 1000)) };
    }
    record.count += 1;
    return { allowed: true, retryAfterSec: 0 };
  };

  return { check, clear: () => store.clear() };
};
