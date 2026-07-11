import crypto from 'crypto';
import { appendAuditLog } from '../core/auditStore.js';
import { getClientIp, jsonResponse, readBody } from '../core/httpUtils.js';
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
    if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
    if (!(await requireActiveAuth(req, res, env, driver))) return;

    const rawBody = await readBody(req);
    let body;
    try { body = JSON.parse(rawBody.toString() || '{}'); }
    catch { return jsonResponse(res, 400, { success: false, error: 'Invalid JSON body' }); }

    const source = String(body?.source || '');
    const target = String(body?.target || '');
    const scope = String(body?.scope || '');
    if (!available.includes(source) || !available.includes(target) || source === target) {
      return jsonResponse(res, 400, { success: false, error: 'Invalid source/target driver' });
    }
    if (!TRANSFER_SCOPES.has(scope)) {
      return jsonResponse(res, 400, { success: false, error: 'Invalid transfer scope' });
    }

    const sourceDriver = await openTransferDriver(env, source);
    const targetDriver = await openTransferDriver(env, target);

    if (scope === 'data') {
      const result = await transferStorageData(sourceDriver, targetDriver);
      await appendActiveAudit(env, driver, {
        action: 'transfer_storage',
        status: 'success',
        details: `scope=data source=${source} target=${target} copied=${result.copied.join(',') || 'none'} ip=${getClientIp(req)}`
      });
      return jsonResponse(res, 200, { success: true, copied: result.copied });
    }

    const limitRaw = Number(body?.limit || 50);
    const limit = Math.min(200, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 50));
    const result = await transferStorageMediaBatch(sourceDriver, targetDriver, limit);
    await appendActiveAudit(env, driver, {
      action: 'transfer_storage',
      status: 'success',
      details: `scope=media source=${source} target=${target} copied=${result.copied} skipped=${result.skipped} pending=${result.pending} ip=${getClientIp(req)}`
    });
    return jsonResponse(res, 200, { success: true, ...result });
  } catch (error) {
    if (error?.code === 'PAYLOAD_TOO_LARGE') return jsonResponse(res, 413, { success: false, error: 'Payload too large' });
    console.error('Storage transfer API error:', error);
    try {
      await appendActiveAudit(env, driver, {
        action: 'transfer_storage',
        status: 'failed',
        details: `ip=${getClientIp(req)}`,
        message: '存储数据传输失败'
      });
    } catch {}
    return jsonResponse(res, 500, { success: false, error: '存储数据传输失败' });
  }
};
