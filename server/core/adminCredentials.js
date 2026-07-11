import { hashPassword } from '../sharedSecurity.js';
import { dbGetJson, dbSetJson } from './kvStore.js';
export { buildAdminCredentialsForSave } from './credentialPolicy.js';

export const ensureSqliteAdminFromEnv = async (database, env) => {
  const username = (env.ADMIN_USERNAME || '').trim();
  const password = env.ADMIN_PASSWORD || '';
  if (!username || !password) return null;
  const credentials = { username, passwordHash: await hashPassword(password), passwordUpdatedAt: Date.now() };
  dbSetJson(database, 'private_data', credentials);
  return credentials;
};

export const resolveAdminCredentials = async (database, env) => {
  const sqliteCredentials = dbGetJson(database, 'private_data');
  if (sqliteCredentials?.username && (sqliteCredentials?.password || sqliteCredentials?.passwordHash)) {
    return { creds: sqliteCredentials, source: 'sqlite' };
  }

  const seeded = await ensureSqliteAdminFromEnv(database, env);
  if (seeded) return { creds: seeded, source: 'sqlite' };
  return { error: '管理员账号未初始化，请先配置 ADMIN_USERNAME 和 ADMIN_PASSWORD' };
};
