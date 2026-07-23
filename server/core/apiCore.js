import { createStorageApiHandler } from './storageApiHandler.js';
import { getPublicDataUpdatedAt } from '../publicDataValidation.js';
import { appendAuditLog } from './auditStore.js';
import { normalizeAuditWritePayload } from './auditContract.js';
import { BODY_LIMIT_BYTES, MEDIA_BODY_LIMIT_BYTES, SESSION_COOKIE } from './constants.js';
import { dbDelete, dbGetJson, dbSetJson, ensureDb } from './kvStore.js';
import {
  errorResponse,
  getClientIp,
  jsonResponse,
  methodNotAllowed,
  parseCookies,
  readBody,
  readBoundedInteger,
  readJsonObject
} from './httpUtils.js';
import { isBlockedRemoteHost } from './remoteSecurity.js';
import {
  buildAdminCredentialsForSave,
  buildAdminCredentialsResponse,
  ensureSqliteAdminFromEnv,
  resolveAdminCredentials
} from './adminCredentials.js';
import {
  cleanupSqliteUnusedMedia,
  collectSqliteMediaNames,
  parseMediaReferences
} from './mediaGc.js';
import {
  buildCookie,
  clearAllSessions,
  clearCookie,
  createSession,
  destroySession,
  requireAuth,
  verifySession
} from './sessionStore.js';

const createSqliteHandler = (env, isProduction) => createStorageApiHandler({
  driver: 'sqlite',
  runtime: 'node',
  env,
  isProduction,
  getContext: async () => ensureDb(),
  auth: {
    require: (request, response, database) => requireAuth(request, response, database),
    getToken: (request) => parseCookies(request.headers.cookie || '')[SESSION_COOKIE],
    create: (database, remember) => createSession(database, remember),
    verify: (database, token) => verifySession(database, token),
    destroy: (database, token) => destroySession(database, token),
    clear: (database) => clearAllSessions(database),
    buildCookie,
    clearCookie
  },
  credentials: {
    load: (database) => resolveAdminCredentials(database, env),
    buildSave: buildAdminCredentialsForSave,
    buildResponse: buildAdminCredentialsResponse
  },
  data: {
    read: (database, key) => dbGetJson(database, key),
    write: (database, key, value) => dbSetJson(database, key, value),
    savePublic: (database, value, expectedUpdatedAt) => {
      if (expectedUpdatedAt !== undefined) {
        const current = dbGetJson(database, 'public_data');
        const currentUpdatedAt = getPublicDataUpdatedAt(current);
        if (currentUpdatedAt !== expectedUpdatedAt) {
          return { success: false, currentUpdatedAt };
        }
      }
      dbSetJson(database, 'public_data', value);
      return { success: true };
    }
  },
  media: {
    read: (database, name) => {
      const media = dbGetJson(database, `media:${name}`);
      if (!media?.base64) return null;
      return { contentType: String(media.contentType || 'application/octet-stream'), bytes: Buffer.from(media.base64, 'base64') };
    },
    write: (database, name, contentType, bytes) => dbSetJson(database, `media:${name}`, {
      contentType,
      base64: bytes.toString('base64'),
      updatedAt: Date.now()
    }),
    delete: (database, name) => dbDelete(database, `media:${name}`),
    gc: (database, publicData, limit) => cleanupSqliteUnusedMedia(database, parseMediaReferences(publicData), limit)
  },
  audit: {
    append: (entry, database) => appendAuditLog(database, entry),
    read: (database, limit) => {
      const logs = dbGetJson(database, 'audit_logs');
      return Array.isArray(logs) ? logs.slice(0, limit) : [];
    }
  }
});

export const handleStorageApi = async (req, res, { env = process.env, isProduction = false } = {}) => (
  createSqliteHandler(env, isProduction)(req, res)
);

export {
  BODY_LIMIT_BYTES,
  MEDIA_BODY_LIMIT_BYTES,
  SESSION_COOKIE,
  appendAuditLog,
  buildCookie,
  clearAllSessions,
  clearCookie,
  createSession,
  dbDelete,
  dbGetJson,
  dbSetJson,
  destroySession,
  ensureDb,
  errorResponse,
  getClientIp,
  isBlockedRemoteHost,
  jsonResponse,
  methodNotAllowed,
  parseCookies,
  readBody,
  readBoundedInteger,
  readJsonObject,
  requireAuth,
  verifySession,
  buildAdminCredentialsForSave,
  cleanupSqliteUnusedMedia,
  collectSqliteMediaNames,
  ensureSqliteAdminFromEnv,
  normalizeAuditWritePayload,
  parseMediaReferences,
  resolveAdminCredentials
};
