import crypto from 'crypto';
import { appendAuditLog } from '../core/auditStore.js';
import {
  errorResponse,
  getClientIp,
  jsonResponse,
  methodNotAllowed,
  readBoundedInteger,
  readJsonObject
} from '../core/httpUtils.js';
import { ensureDb } from '../core/kvStore.js';
import { enforceSameOrigin } from '../core/requestOrigin.js';
import { requireAuth } from '../core/sessionStore.js';
import { listAvailableDrivers } from '../core/storageDriver.js';
import { requireRedisAuth } from './redisSession.js';
import { appendRedisAudit, getRedisClient } from './redisStore.js';
import {
  createRedisTransferDriver,
  createSqliteTransferDriver,
  transferStorageData,
  transferStorageMediaBatch
} from './transfer.js';

const TRANSFER_SCOPES = new Set(['data', 'media']);

const openTransferDriver = async (env, mode) => {
  if (mode === 'redis') return createRedisTransferDriver(await getRedisClient(env), env);
  return createSqliteTransferDriver(ensureDb());
};

const requireActiveAuth = async (req, res, env, driver) => {
  if (driver === 'redis') return requireRedisAuth(req, res, await getRedisClient(env), env);
  return requireAuth(req, res, ensureDb());
};

const appendActiveAudit = async (env, driver, entry) => {
  const record = {
    action: String(entry.action || 'transfer_storage'),
    status: entry.status === 'failed' ? 'failed' : 'success',
    details: entry.details || '',
    message: entry.message || ''
  };
  if (driver === 'redis') {
    await appendRedisAudit(await getRedisClient(env), env, { id: crypto.randomUUID(), ts: Date.now(), ...record });
    return;
  }
  appendAuditLog(ensureDb(), record);
};

export const handleStorageTransferApi = async (req, res, { env, driver }) => {
  if (!enforceSameOrigin(req, res)) return;
  try {
    const available = listAvailableDrivers(env);

    if (req.method === 'GET') {
      if (!(await requireActiveAuth(req, res, env, driver))) return;
      return jsonResponse(res, 200, { driver, available });
    }
    if (req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST']);
    if (!(await requireActiveAuth(req, res, env, driver))) return;

    const parsedBody = await readJsonObject(req);
    if (!parsedBody.ok) return errorResponse(res, 400, parsedBody.error);
    const body = parsedBody.data;

    const source = String(body?.source || '');
    const target = String(body?.target || '');
    const scope = String(body?.scope || '');
    if (!available.includes(source) || !available.includes(target) || source === target) {
      return errorResponse(res, 400, 'Invalid source/target driver');
    }
    if (!TRANSFER_SCOPES.has(scope)) {
      return errorResponse(res, 400, 'Invalid transfer scope');
    }

    const sourceDriver = await openTransferDriver(env, source);
    const targetDriver = await openTransferDriver(env, target);

    if (scope === 'data') {
      const result = await transferStorageData(sourceDriver, targetDriver);
      await appendActiveAudit(env, driver, {
        action: 'transfer_storage',
        status: 'success',
        details: `scope=data source=${source} target=${target} copied=${result.copied.join(',') || 'none'} ip=${getClientIp(req, env)}`
      });
      return jsonResponse(res, 200, { success: true, copied: result.copied });
    }

    const limit = readBoundedInteger(body.limit, 50, 1, 200);
    const result = await transferStorageMediaBatch(sourceDriver, targetDriver, limit);
    await appendActiveAudit(env, driver, {
      action: 'transfer_storage',
      status: 'success',
      details: `scope=media source=${source} target=${target} copied=${result.copied} skipped=${result.skipped} pending=${result.pending} ip=${getClientIp(req, env)}`
    });
    return jsonResponse(res, 200, { success: true, ...result });
  } catch (error) {
    if (error?.code === 'PAYLOAD_TOO_LARGE') return errorResponse(res, 413, 'Payload too large');
    console.error('Storage transfer API error:', error);
    try {
      await appendActiveAudit(env, driver, {
        action: 'transfer_storage',
        status: 'failed',
        details: `ip=${getClientIp(req, env)}`,
        message: '存储数据传输失败'
      });
    } catch {}
    return errorResponse(res, 500, '存储数据传输失败');
  }
};
