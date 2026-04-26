
import { AdminCredentialsUpdate, AdminProfile, AuditLogEntry, PublicData, PrivateData } from '../types';
import { DEFAULT_PUBLIC_DATA, DEFAULT_PRIVATE_DATA, webdav as rawWebDav } from './webdavService';
import { StorageAdapter } from './storageAdapter';

const SQLITE_API_URL = '/api/sqlite';

const authFetch = (path: string, options: RequestInit = {}) => {
  return fetch(path, {
    credentials: 'include',
    ...options
  });
};

const sessionAuth = {
  login: async (username: string, password: string, remember = false) => {
    try {
      const res = await authFetch('/api/sqlite/login', {
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
      await authFetch('/api/sqlite/logout', { method: 'POST' });
    } catch (e) {}
  },
  check: async () => {
    try {
      const res = await authFetch('/api/sqlite/session');
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
    const res = await authFetch('/api/sqlite/admin-profile');
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || '获取管理员信息失败');
    }
    const data = await res.json();
    return { username: String(data?.username || '') };
  },
  updateCredentials: async (payload: AdminCredentialsUpdate) => {
    try {
      const res = await authFetch('/api/sqlite/admin-credentials', {
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
    try {
      const res = await authFetch(`${SQLITE_API_URL}?key=public_data`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      if (data && typeof data === 'object' && !data.updatedAt && Array.isArray(data.cards)) {
        const maxTime = data.cards.reduce((max: number, c: any) => Math.max(max, c.updatedAt || 0), 0);
        if (maxTime > 0) data.updatedAt = maxTime;
      }
      return data || DEFAULT_PUBLIC_DATA;
    } catch (e) {
      console.error('SQLite getPublicData error:', e);
      return DEFAULT_PUBLIC_DATA;
    }
  },
  savePublicData: async (data: PublicData) => {
    try {
      const res = await authFetch(`${SQLITE_API_URL}?key=public_data`, {
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
  getPrivateData: async () => {
    try {
      const res = await authFetch(`${SQLITE_API_URL}?key=private_data`);
      if (res.status === 401) throw new Error('Unauthorized');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      return data || DEFAULT_PRIVATE_DATA;
    } catch (e) {
      console.error('SQLite getPrivateData error:', e);
      return DEFAULT_PRIVATE_DATA;
    }
  },
  savePrivateData: async (data: PrivateData) => {
    try {
      const res = await authFetch(`${SQLITE_API_URL}?key=private_data`, {
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
       const res = await authFetch(`${SQLITE_API_URL}?key=ping`);
       if (res.ok || res.status === 404) return { success: true, message: "SQLite 本地数据库连接正常" };
       return { success: false, message: "SQLite 服务无响应" };
     } catch(e: any) {
       return { success: false, message: `SQLite 连接错误: ${e.message}` };
     }
  }
};

// Factory or Current Instance
// You can switch this based on env vars or local storage settings

// 缓存服务端模式，避免重复请求
let cachedServerMode: 'sqlite' | 'webdav' | null = null;

// 异步获取服务端配置的存储模式
export const fetchServerStorageMode = async (): Promise<'sqlite' | 'webdav'> => {
  if (cachedServerMode) return cachedServerMode;
  
  try {
    const res = await fetch(`${SQLITE_API_URL}?key=storage_mode`);
    if (res.ok) {
      const data = await res.json();
      if (data?.mode === 'webdav' || data?.mode === 'sqlite') {
        cachedServerMode = data.mode;
        return data.mode;
      }
    }
  } catch (e) {
    console.error('Failed to fetch storage mode:', e);
  }
  
  // 默认 SQLite
  cachedServerMode = 'sqlite';
  return 'sqlite';
};

// 管理员切换模式时调用，同步写入服务端
export const setServerStorageMode = async (mode: 'sqlite' | 'webdav'): Promise<boolean> => {
  try {
    const res = await fetch(`${SQLITE_API_URL}?key=storage_mode`, {
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

// 同步版本 - 使用缓存或 localStorage
export const getStorage = (): StorageAdapter => {
  // 优先使用已缓存的服务端模式
  if (cachedServerMode) {
    return cachedServerMode === 'webdav' ? webdavAdapter : sqliteAdapter;
  }
  
  // 回退到 localStorage
  const manualOverride = localStorage.getItem('tat_storage_mode');
  if (manualOverride === 'sqlite') return sqliteAdapter;
  if (manualOverride === 'webdav') return webdavAdapter;

  // 默认 SQLite
  return sqliteAdapter;
};

// 异步版本 - 确保从服务端获取最新模式
export const getStorageAsync = async (): Promise<StorageAdapter> => {
  const mode = await fetchServerStorageMode();
  return mode === 'webdav' ? webdavAdapter : sqliteAdapter;
};

export const syncAdminCredentialsToTarget = async (target: 'sqlite' | 'webdav', payload: PrivateData) => {
  // 客户端 sanitize：永远不向后端传明文 password；服务端也会拒绝，但前端先剔除可避免 400
  const safePayload: PrivateData = {
    username: payload.username,
    passwordHash: payload.passwordHash,
    passwordUpdatedAt: payload.passwordUpdatedAt
  };
  try {
    const res = await authFetch(`/api/sqlite/admin-credentials-sync?target=${target}`, {
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

export const runCoverGarbageCollection = async (target: 'sqlite' | 'webdav') => {
  return runCoverGarbageCollectionBatch(target, 100);
};

export const runCoverGarbageCollectionBatch = async (target: 'sqlite' | 'webdav', limit = 100) => {
  try {
    const res = await authFetch(`/api/sqlite/media-gc?target=${target}&limit=${encodeURIComponent(String(limit))}`, {
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
    const res = await authFetch(`/api/sqlite/audit-logs?limit=${encodeURIComponent(String(limit))}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !Array.isArray(data?.items)) {
      return { success: false as const, error: data?.error || '读取操作日志失败' };
    }
    return { success: true as const, items: data.items as AuditLogEntry[] };
  } catch (e: any) {
    return { success: false as const, error: e.message };
  }
};

export const checkServerSession = sessionAuth.check;
export const logoutServerSession = sessionAuth.logout;
export const getAdminProfile = adminAuth.getProfile;
export const updateAdminCredentials = adminAuth.updateCredentials;
