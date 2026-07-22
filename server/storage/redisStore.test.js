import { describe, expect, it, vi } from 'vitest';
import {
  appendRedisAudit,
  clearRedisSessions,
  consumeRateLimit,
  createRedisSession,
  destroyRedisSession,
  readRedisAudit,
  verifyRedisSession
} from './redisStore.js';

vi.mock('redis', () => ({ createClient: vi.fn() }));

class FakeRedis {
  constructor() {
    this.values = new Map();
    this.sets = new Map();
    this.lists = new Map();
  }

  async set(key, value) { this.values.set(key, value); return 'OK'; }
  async get(key) { return this.values.get(key) ?? null; }
  async del(input) {
    const keys = Array.isArray(input) ? input : [input];
    let removed = 0;
    for (const key of keys) removed += this.values.delete(key) || this.sets.delete(key) || this.lists.delete(key) ? 1 : 0;
    return removed;
  }
  async expire() { return 1; }
  async incr(key) {
    const value = Number(this.values.get(key) || 0) + 1;
    this.values.set(key, value);
    return value;
  }
  async sAdd(key, ...members) {
    const values = this.sets.get(key) || new Set();
    for (const member of members) values.add(member);
    this.sets.set(key, values);
    return members.length;
  }
  async sRem(key, ...members) {
    const values = this.sets.get(key) || new Set();
    let removed = 0;
    for (const member of members) removed += values.delete(member) ? 1 : 0;
    return removed;
  }
  async sMembers(key) { return [...(this.sets.get(key) || [])]; }
  async lPush(key, ...elements) {
    const values = this.lists.get(key) || [];
    values.unshift(...elements);
    this.lists.set(key, values);
    return values.length;
  }
  async lTrim(key, start, end) {
    const values = this.lists.get(key) || [];
    this.lists.set(key, values.slice(start, end + 1));
    return 'OK';
  }
  async lRange(key, start, end) { return (this.lists.get(key) || []).slice(start, end + 1); }
}

const env = { REDIS_PREFIX: 'test' };

describe('Vercel Redis store', () => {
  it('creates, verifies, destroys and clears sessions', async () => {
    const redis = new FakeRedis();
    const first = await createRedisSession(redis, env, false);
    const second = await createRedisSession(redis, env, true);

    expect(await verifyRedisSession(redis, env, first.token)).toBe(true);
    await destroyRedisSession(redis, env, first.token);
    expect(await verifyRedisSession(redis, env, first.token)).toBe(false);

    await clearRedisSessions(redis, env);
    expect(await verifyRedisSession(redis, env, second.token)).toBe(false);
  });

  it('limits requests within a fixed window', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const redis = new FakeRedis();

    expect((await consumeRateLimit(redis, env, 'login', '127.0.0.1', 2, 60)).allowed).toBe(true);
    expect((await consumeRateLimit(redis, env, 'login', '127.0.0.1', 2, 60)).allowed).toBe(true);
    expect((await consumeRateLimit(redis, env, 'login', '127.0.0.1', 2, 60)).allowed).toBe(false);

    vi.restoreAllMocks();
  });

  it('keeps newest audit entries first', async () => {
    const redis = new FakeRedis();
    await appendRedisAudit(redis, env, { id: 'first' });
    await appendRedisAudit(redis, env, { id: 'second' });

    expect(await readRedisAudit(redis, env, 1)).toEqual([expect.objectContaining({
      id: 'second',
      action: 'unknown',
      status: 'success',
      details: '',
      message: ''
    })]);
  });

  it('rebuilds the client after a failed initial connection', async () => {
    vi.resetModules();
    const redisModule = await import('redis');
    const store = await import('./redisStore.js');
    const clients = [];
    redisModule.createClient.mockImplementation(() => {
      const client = {
        isOpen: false,
        isReady: false,
        on: vi.fn(),
        close: vi.fn(),
        connect: vi.fn(async () => {
          if (clients.indexOf(client) === 0) throw new Error('ECONNREFUSED');
          client.isReady = true;
          return client;
        })
      };
      clients.push(client);
      return client;
    });

    const connectEnv = { REDIS_URL: 'redis://localhost:6399' };
    await expect(store.getRedisClient(connectEnv)).rejects.toThrow('ECONNREFUSED');
    const client = await store.getRedisClient(connectEnv);

    expect(clients.length).toBe(2);
    expect(client).toBe(clients[1]);
    expect(client.isReady).toBe(true);
  });
});
