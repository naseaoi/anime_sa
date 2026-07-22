import crypto from 'crypto';
import { SESSION_COOKIE } from './constants.js';
import { dbDelete, dbGetJson, dbSetJson } from './kvStore.js';
import { errorResponse, parseCookies } from './httpUtils.js';
export { buildCookie, clearCookie } from './sessionCookie.js';

export const createSession = (database, remember) => {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const maxAgeSec = remember ? 30 * 24 * 60 * 60 : 24 * 60 * 60;
  const expiresAt = now + maxAgeSec * 1000;
  dbSetJson(database, `session:${token}`, { createdAt: now, expiresAt });
  return { token, maxAgeSec, expiresAt };
};

export const verifySession = (database, token) => {
  if (!token) return false;
  const data = dbGetJson(database, `session:${token}`);
  if (!data?.expiresAt || data.expiresAt <= Date.now()) {
    dbDelete(database, `session:${token}`);
    return false;
  }
  return true;
};

export const destroySession = (database, token) => {
  if (token) dbDelete(database, `session:${token}`);
};

export const clearAllSessions = (database) => {
  database.prepare("DELETE FROM kv_store WHERE key LIKE 'session:%'").run();
};

export const requireAuth = (request, response, database) => {
  const cookies = parseCookies(request.headers.cookie || '');
  if (!verifySession(database, cookies[SESSION_COOKIE])) {
    errorResponse(response, 401, 'Unauthorized: Login required');
    return false;
  }
  return true;
};
