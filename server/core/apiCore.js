import { createStorageApiHandler } from './storageApiHandler.js';
import { getPublicDataRevision } from '../publicDataValidation.js';
import { buildSqliteDataMetrics } from './dataMetrics.js';
import { appendAuditLog } from './auditStore.js';
import { normalizeAuditWritePayload } from './auditContract.js';
import { BODY_LIMIT_BYTES, MEDIA_BODY_LIMIT_BYTES, SESSION_COOKIE } from './constants.js';
import { dbDelete, dbDeleteMedia, dbGetJson, dbGetMedia, dbSetJson, dbSetMedia, ensureDb } from './kvStore.js';
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
  health: async () => { ensureDb(); },
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
    savePublic: (database, value, expectedRevision) => {
      const save = database.transaction(() => {
        const currentRevision = getPublicDataRevision(dbGetJson(database, 'public_data'));
        if (currentRevision !== expectedRevision) return { success: false, currentRevision };
        dbSetJson(database, 'public_data', value);
        return { success: true };
      });
      return save();
    },
    metrics: (database) => buildSqliteDataMetrics(database, dbGetJson(database, 'public_data'))
  },
  media: {
    read: (database, name) => dbGetMedia(database, name),
    write: (database, name, contentType, bytes) => dbSetMedia(database, name, contentType, bytes),
    delete: (database, name) => dbDeleteMedia(database, name),
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
