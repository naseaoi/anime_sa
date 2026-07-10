import {
  hashPassword,
  isValidUsername,
  normalizePrivateDataPayload,
  PASSWORD_MAX_LEN,
  PASSWORD_MIN_LEN
} from '../sharedSecurity.js';
import { dbGetJson, dbSetJson, getStorageMode } from './kvStore.js';
import { fetchWebDavJson } from './webdavStore.js';

export const ensureSqliteAdminFromEnv = async (database, env) => {
  const username = (env.ADMIN_USERNAME || '').trim();
  const password = env.ADMIN_PASSWORD || '';
  if (!username || !password) return null;
  const credentials = { username, passwordHash: await hashPassword(password), passwordUpdatedAt: Date.now() };
  dbSetJson(database, 'private_data', credentials);
  return credentials;
};

export const resolveAdminCredentials = async (database, env) => {
  const mode = getStorageMode(database);
  if (mode === 'webdav') {
    try {
      const webdavCredentials = await fetchWebDavJson(env, 'private_data.json');
      if (webdavCredentials?.username && (webdavCredentials?.password || webdavCredentials?.passwordHash)) {
        return { creds: webdavCredentials, source: 'webdav' };
      }
    } catch {
      return { error: 'WebDAV 凭据读取失败，请检查 WebDAV 配置' };
    }
  }

  const sqliteCredentials = dbGetJson(database, 'private_data');
  if (sqliteCredentials?.username && (sqliteCredentials?.password || sqliteCredentials?.passwordHash)) {
    return { creds: sqliteCredentials, source: 'sqlite' };
  }

  const seeded = await ensureSqliteAdminFromEnv(database, env);
  if (seeded) return { creds: seeded, source: 'sqlite' };
  return { error: '管理员账号未初始化，请先配置 ADMIN_USERNAME 和 ADMIN_PASSWORD' };
};

export const buildAdminCredentialsForSave = async (existing, payload) => {
  const username = String(payload?.username || '').trim();
  if (!isValidUsername(username)) return { error: '账号需由 3–64 位字母、数字、下划线或横线组成' };

  const newPassword = typeof payload?.newPassword === 'string' ? payload.newPassword : '';
  const hasNewPassword = newPassword.length > 0;
  if (hasNewPassword && (newPassword.length < PASSWORD_MIN_LEN || newPassword.length > PASSWORD_MAX_LEN)) {
    return { error: `密码长度需在 ${PASSWORD_MIN_LEN}–${PASSWORD_MAX_LEN} 之间` };
  }

  const existingHash = typeof existing?.passwordHash === 'string' ? existing.passwordHash : '';
  const legacyPassword = typeof existing?.password === 'string' ? existing.password : '';
  let passwordHash = existingHash;
  const usernameChanged = username !== String(existing?.username || '');
  if (hasNewPassword) passwordHash = await hashPassword(newPassword);
  else if (!passwordHash && legacyPassword) passwordHash = await hashPassword(legacyPassword);
  if (!passwordHash) return { error: '请提供新密码' };

  return {
    data: {
      username,
      passwordHash,
      passwordUpdatedAt: hasNewPassword ? Date.now() : Number(existing?.passwordUpdatedAt || Date.now())
    },
    passwordChanged: hasNewPassword,
    changed: usernameChanged || hasNewPassword
  };
};

export const buildPrivateDataForTarget = async (payload) => {
  const normalized = normalizePrivateDataPayload(payload);
  if (!normalized) return { error: 'Invalid private_data payload' };
  return {
    data: {
      username: normalized.username,
      passwordHash: normalized.passwordHash,
      passwordUpdatedAt: normalized.passwordUpdatedAt || Date.now()
    }
  };
};
