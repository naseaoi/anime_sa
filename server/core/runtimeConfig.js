import fs from 'fs';
import path from 'path';
import { resolveStorageDriver } from './storageDriver.js';
import { resolveSqliteDataDir } from './kvStore.js';

export const loadEnvFile = (env = process.env, cwd = process.cwd()) => {
  const envPath = path.join(cwd, '.env');
  if (!fs.existsSync(envPath)) return env;
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    const value = rawValue.replace(/^['"](.*)['"]$/, '$1');
    if (env[key] === undefined) env[key] = value;
  }
  return env;
};

export const resolvePort = (value) => {
  const port = Number(value || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535');
  return port;
};

export const resolveTrustProxy = (value) => {
  const normalized = String(value || '0').trim();
  if (normalized !== '0' && normalized !== '1') throw new Error('TRUST_PROXY must be 0 or 1');
  return normalized === '1';
};

export const loadRuntimeConfig = (env = process.env) => {
  loadEnvFile(env);
  return {
    port: resolvePort(env.PORT),
    dataDir: resolveSqliteDataDir(env),
    isProduction: env.NODE_ENV === 'production',
    storageDriver: resolveStorageDriver(env),
    trustProxy: resolveTrustProxy(env.TRUST_PROXY)
  };
};
