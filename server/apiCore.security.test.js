import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import {
  createSession,
  destroySession,
  getClientIp,
  isBlockedRemoteHost,
  verifySession
} from './core/apiCore.js';

const originalTrustProxy = process.env.TRUST_PROXY;

afterEach(() => {
  if (originalTrustProxy === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = originalTrustProxy;
});

describe('getClientIp', () => {
  it('ignores forwarded headers by default', () => {
    delete process.env.TRUST_PROXY;
    const request = {
      headers: { 'x-forwarded-for': '203.0.113.10' },
      socket: { remoteAddress: '127.0.0.1' }
    };
    expect(getClientIp(request)).toBe('127.0.0.1');
  });

  it('uses proxy headers only when enabled', () => {
    process.env.TRUST_PROXY = '1';
    const request = {
      headers: {
        'x-real-ip': '203.0.113.20',
        'x-forwarded-for': '198.51.100.1, 203.0.113.20'
      },
      socket: { remoteAddress: '127.0.0.1' }
    };
    expect(getClientIp(request)).toBe('203.0.113.20');
  });
});

describe('session storage', () => {
  it('creates, verifies and destroys sessions', () => {
    const database = new Database(':memory:');
    database.exec('CREATE TABLE kv_store (key TEXT PRIMARY KEY, value TEXT)');

    const session = createSession(database, false);
    expect(verifySession(database, session.token)).toBe(true);
    destroySession(database, session.token);
    expect(verifySession(database, session.token)).toBe(false);

    database.close();
  });
});

describe('remote host filtering', () => {
  it('blocks private hosts and permits public hosts', () => {
    expect(isBlockedRemoteHost('127.0.0.1')).toBe(true);
    expect(isBlockedRemoteHost('192.168.1.10')).toBe(true);
    expect(isBlockedRemoteHost('localhost')).toBe(true);
    expect(isBlockedRemoteHost('example.com')).toBe(false);
  });
});
