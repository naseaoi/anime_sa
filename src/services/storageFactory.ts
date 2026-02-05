
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
export const getStorage = (): StorageAdapter => {
  // Allow runtime switching via localStorage for testing
  // console command: localStorage.setItem('tat_storage_mode', 'sqlite')
  const manualOverride = localStorage.getItem('tat_storage_mode');
  if (manualOverride === 'sqlite') return sqliteAdapter;
  if (manualOverride === 'webdav') return webdavAdapter;

  // Default to SQLite unless specifically disabled or VITE_USE_WEBDAV is true
  const useWebDav = import.meta.env.VITE_USE_WEBDAV === 'true'; 
  return useWebDav ? webdavAdapter : sqliteAdapter;
};
