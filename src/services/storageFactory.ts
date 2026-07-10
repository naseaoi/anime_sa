
import { AdminCredentialsUpdate, AdminProfile, AuditLogEntry, PublicData, PrivateData } from '../types';
import { applyDerivedPublicDataVersion, DEFAULT_PRIVATE_DATA, DEFAULT_PUBLIC_DATA } from '../domain/publicData';
import { isStorageMode, StorageMode } from '../domain/storage';
import { readApiError, requestWithSession } from './apiClient';
import { webdav as rawWebDav } from './webdavService';
import { SavePublicDataOptions, StorageAdapter } from './storageAdapter';

const SQLITE_API_URL = '/api/sqlite';

const sessionAuth = {
  login: async (username: string, password: string, remember = false) => {
    try {
      const res = await requestWithSession('/api/sqlite/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, remember })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        return { success: true as const };
      }
      return { success: false as const, error: data.error || 'Login failed' };
    } catch (e: any) {
      return { success: false as const, error: e.message };
    }
  },
  logout: async () => {
    try {
      await requestWithSession('/api/sqlite/logout', { method: 'POST' });
    } catch (e) {}
  },
  check: async () => {
    try {
      const res = await requestWithSession('/api/sqlite/session');
      if (!res.ok) return false;
      const data = await res.json();
      return !!data?.authenticated;
    } catch (e) {
      return false;
    }
  }
};

const adminAuth = {
  getProfile: async (): Promise<AdminProfile> => {
    const res = await requestWithSession('/api/sqlite/admin-profile');
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || '获取管理员信息失败');
    }
    const data = await res.json();
    return { username: String(data?.username || '') };
  },
  updateCredentials: async (payload: AdminCredentialsUpdate) => {
    try {
      const res = await requestWithSession('/api/sqlite/admin-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        return { success: false as const, error: data?.error || '保存失败' };
      }
      return { success: true as const, requireRelogin: !!data?.requireRelogin };
    } catch (e: any) {
      return { success: false as const, error: e.message };
    }
  }
};

export const webdavAdapter: StorageAdapter = {
  type: 'webdav',
  login: sessionAuth.login,
  getAdminProfile: adminAuth.getProfile,
  updateAdminCredentials: adminAuth.updateCredentials,
  ...rawWebDav
};

export const sqliteAdapter: StorageAdapter = {
  type: 'sqlite',
  login: sessionAuth.login,
  getAdminProfile: adminAuth.getProfile,
  updateAdminCredentials: adminAuth.updateCredentials,
  getPublicData: async () => {
    const res = await requestWithSession(`${SQLITE_API_URL}?key=public_data`);
    if (!res.ok) {
      const message = await res.text().catch(() => '');
      throw new Error(message || `SQLite 读取失败 (${res.status})`);
    }
    const data = await res.json();
    return data ? applyDerivedPublicDataVersion(data) : DEFAULT_PUBLIC_DATA;
  },
  savePublicData: async (data: PublicData, options: SavePublicDataOptions = {}) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (options.expectedUpdatedAt !== undefined) {
        headers['X-Expected-Updated-At'] = String(options.expectedUpdatedAt);
      }
      const res = await requestWithSession(`${SQLITE_API_URL}?key=public_data`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        return {
          success: false,
          conflict: res.status === 409,
          error: await readApiError(res, `SQLite 保存失败 (${res.status})`)
        };
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
  getPrivateData: async () => {
    const res = await requestWithSession(`${SQLITE_API_URL}?key=private_data`);
    if (!res.ok) {
      const message = await res.text().catch(() => '');
      throw new Error(message || `SQLite 私有数据读取失败 (${res.status})`);
    }
    const data = await res.json();
    return data || DEFAULT_PRIVATE_DATA;
  },
  savePrivateData: async (data: PrivateData) => {
    try {
      const res = await requestWithSession(`${SQLITE_API_URL}?key=private_data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(await res.text());
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
  testConnection: async () => {
     try {
      const res = await requestWithSession(`${SQLITE_API_URL}?key=ping`);
       if (res.ok || res.status === 404) return { success: true, message: "SQLite 本地数据库连接正常" };
       return { success: false, message: "SQLite 服务无响应" };
     } catch(e: any) {
       return { success: false, message: `SQLite 连接错误: ${e.message}` };
     }
  }
};

const storageAdapters: Record<StorageMode, StorageAdapter> = {
  sqlite: sqliteAdapter,
  webdav: webdavAdapter
};

export const getStorageAdapter = (mode: StorageMode): StorageAdapter => storageAdapters[mode];

let cachedServerMode: StorageMode | null = null;

export const fetchServerStorageMode = async (): Promise<StorageMode> => {
  if (cachedServerMode) return cachedServerMode;

  const res = await requestWithSession(`${SQLITE_API_URL}?key=storage_mode`);
  if (!res.ok) {
    throw new Error(await readApiError(res, `存储模式读取失败 (${res.status})`));
  }
  const data = await res.json();
  if (isStorageMode(data?.mode)) {
    cachedServerMode = data.mode;
    return data.mode;
  }
  if (data !== null) throw new Error('存储模式数据无效');

  cachedServerMode = 'sqlite';
  return 'sqlite';
};

export const setServerStorageMode = async (mode: StorageMode): Promise<boolean> => {
  try {
    const res = await requestWithSession(`${SQLITE_API_URL}?key=storage_mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    });
    if (res.ok) {
      cachedServerMode = mode;
      localStorage.setItem('tat_storage_mode', mode);
      return true;
    }
  } catch (e) {
    console.error('Failed to set storage mode:', e);
  }
  return false;
};

export const getStorage = (): StorageAdapter => {
  if (cachedServerMode) {
    return getStorageAdapter(cachedServerMode);
  }

  const manualOverride = localStorage.getItem('tat_storage_mode');
  if (isStorageMode(manualOverride)) return getStorageAdapter(manualOverride);

  return sqliteAdapter;
};

export const getStorageAsync = async (): Promise<StorageAdapter> => {
  const mode = await fetchServerStorageMode();
  return getStorageAdapter(mode);
};

export const syncAdminCredentialsToTarget = async (target: StorageMode, payload: PrivateData) => {
  const safePayload: PrivateData = {
    username: payload.username,
    passwordHash: payload.passwordHash,
    passwordUpdatedAt: payload.passwordUpdatedAt
  };
  try {
    const res = await requestWithSession(`/api/sqlite/admin-credentials-sync?target=${target}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(safePayload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      return { success: false as const, error: data?.error || '同步管理员凭据失败' };
    }
    return { success: true as const };
  } catch (e: any) {
    return { success: false as const, error: e.message };
  }
};

export const runCoverGarbageCollection = async (target: StorageMode) => {
  return runCoverGarbageCollectionBatch(target, 100);
};

export const runCoverGarbageCollectionBatch = async (target: StorageMode, limit = 100) => {
  try {
    const res = await requestWithSession(`/api/sqlite/media-gc?target=${target}&limit=${encodeURIComponent(String(limit))}`, {
      method: 'POST'
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      return { success: false as const, error: data?.error || '封面资源清理失败' };
    }
    return {
      success: true as const,
      removed: Number(data?.removed || 0),
      checked: Number(data?.checked || 0),
      pending: Number(data?.pending || 0),
      hasMore: !!data?.hasMore
    };
  } catch (e: any) {
    return { success: false as const, error: e.message };
  }
};

export const getAuditLogs = async (limit = 50) => {
  try {
    const res = await requestWithSession(`/api/sqlite/audit-logs?limit=${encodeURIComponent(String(limit))}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !Array.isArray(data?.items)) {
      return { success: false as const, error: data?.error || '读取日志失败' };
    }
    return { success: true as const, items: data.items as AuditLogEntry[] };
  } catch (e: any) {
    return { success: false as const, error: e.message };
  }
};

export const writeAuditLog = async (payload: Pick<AuditLogEntry, 'action' | 'status'> & Partial<Pick<AuditLogEntry, 'details' | 'message'>>) => {
  try {
    const res = await requestWithSession('/api/sqlite/audit-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      return { success: false as const, error: data?.error || '写入日志失败' };
    }
    return { success: true as const };
  } catch (e: any) {
    return { success: false as const, error: e.message };
  }
};

export const checkServerSession = sessionAuth.check;
export const logoutServerSession = sessionAuth.logout;
export const getAdminProfile = adminAuth.getProfile;
export const updateAdminCredentials = adminAuth.updateCredentials;
