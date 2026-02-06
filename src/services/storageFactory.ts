
import { PublicData, PrivateData } from '../types';
import { DEFAULT_PUBLIC_DATA, DEFAULT_PRIVATE_DATA, webdav as rawWebDav } from './webdavService';
import { StorageAdapter } from './storageAdapter';

const SQLITE_API_URL = '/api/sqlite';

let sqliteToken = localStorage.getItem('tat_sqlite_token');

export const webdavAdapter: StorageAdapter = {
  type: 'webdav',
  ...rawWebDav
};

export const sqliteAdapter: StorageAdapter = {
  type: 'sqlite',
  login: async (username, password) => {
    try {
      const res = await fetch('/api/sqlite/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success) {
        sqliteToken = data.token;
        localStorage.setItem('tat_sqlite_token', data.token);
        return { success: true };
      }
      return { success: false, error: data.error || 'Login failed' };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
  getPublicData: async () => {
    try {
      const res = await fetch(`${SQLITE_API_URL}?key=public_data`);
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
      const res = await fetch(`${SQLITE_API_URL}?key=public_data`, {
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
      const headers: Record<string, string> = {};
      if (sqliteToken) headers['Authorization'] = sqliteToken;
      
      const res = await fetch(`${SQLITE_API_URL}?key=private_data`, { headers });
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
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sqliteToken) headers['Authorization'] = sqliteToken;

      const res = await fetch(`${SQLITE_API_URL}?key=private_data`, {
        method: 'POST',
        headers,
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
       const res = await fetch(`${SQLITE_API_URL}?key=ping`);
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
