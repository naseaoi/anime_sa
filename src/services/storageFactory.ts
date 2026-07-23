import { AdminCredentialsUpdate, AdminProfile, AuditLogEntry, PrivateData, PublicData } from '../types';
import { applyDerivedPublicDataVersion, DEFAULT_PRIVATE_DATA, DEFAULT_PUBLIC_DATA } from '../domain/publicData';
import { isStorageMode, StorageMode } from '../domain/storage';
import { conflictResult, failedResult, persistedResult } from '../domain/persistence';
import { readApiError, requestWithSession } from './apiClient';
import { SavePublicDataOptions, StorageAdapter } from './storageAdapter';
import { normalizePublicDataPayload } from '../../shared/publicDataSchema.js';

const STORAGE_API_URL = '/api/storage';

const sessionAuth = {
  login: async (username: string, password: string, remember = false) => {
    try {
      const response = await requestWithSession(`${STORAGE_API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, remember })
      });
      const data = await response.json();
      return response.ok && data.success
        ? { success: true as const }
        : { success: false as const, error: data.error || 'Login failed' };
    } catch (error: any) {
      return { success: false as const, error: error.message };
    }
  },
  logout: async () => {
    try { await requestWithSession(`${STORAGE_API_URL}/logout`, { method: 'POST' }); } catch {}
  },
  check: async () => {
    try {
      const response = await requestWithSession(`${STORAGE_API_URL}/session`);
      if (!response.ok) return false;
      return !!(await response.json())?.authenticated;
    } catch {
      return false;
    }
  }
};

const adminAuth = {
  getProfile: async (): Promise<AdminProfile> => {
    const response = await requestWithSession(`${STORAGE_API_URL}/admin-profile`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || '获取管理员信息失败');
    return { username: String(data?.username || '') };
  },
  updateCredentials: async (payload: AdminCredentialsUpdate) => {
    try {
      const response = await requestWithSession(`${STORAGE_API_URL}/admin-credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) return { success: false as const, error: data?.error || '保存失败' };
      return { success: true as const, requireRelogin: !!data?.requireRelogin };
    } catch (error: any) {
      return { success: false as const, error: error.message };
    }
  }
};

export const storageAdapter: StorageAdapter = {
  type: 'sqlite',
  login: sessionAuth.login,
  getAdminProfile: adminAuth.getProfile,
  updateAdminCredentials: adminAuth.updateCredentials,
  getPublicData: async () => {
    const response = await requestWithSession(`${STORAGE_API_URL}?key=public_data`);
    if (!response.ok) throw new Error(await response.text().catch(() => '') || `数据读取失败 (${response.status})`);
    const data = await response.json();
    if (!data) return DEFAULT_PUBLIC_DATA;
    const normalized = normalizePublicDataPayload(data);
    if (!normalized) throw new Error('服务端返回的公共数据格式无效');
    return applyDerivedPublicDataVersion(normalized);
  },
  savePublicData: async (data: PublicData, options: SavePublicDataOptions = {}) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (options.expectedUpdatedAt !== undefined) headers['X-Expected-Updated-At'] = String(options.expectedUpdatedAt);
      const response = await requestWithSession(`${STORAGE_API_URL}?key=public_data`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await readApiError(response, `数据保存失败 (${response.status})`);
        return response.status === 409 ? conflictResult(error) : failedResult(error);
      }
      return persistedResult();
    } catch (error: any) {
      return failedResult(error.message);
    }
  },
  getPrivateData: async () => {
    const response = await requestWithSession(`${STORAGE_API_URL}?key=private_data`);
    if (!response.ok) throw new Error(await response.text().catch(() => '') || `私有数据读取失败 (${response.status})`);
    return await response.json() || DEFAULT_PRIVATE_DATA;
  },
  savePrivateData: async (data: PrivateData) => {
    try {
      const response = await requestWithSession(`${STORAGE_API_URL}?key=private_data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error(await response.text());
      return persistedResult();
    } catch (error: any) {
      return failedResult(error.message);
    }
  },
  testConnection: async () => {
    try {
      const response = await fetch(`${STORAGE_API_URL}?key=ping`, { cache: 'no-store' });
      return response.ok
        ? { success: true, message: '连接成功' }
        : { success: false, message: `连接失败 (${response.status})` };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
};

let driverLoaded = false;

export const fetchStorageDriver = async (): Promise<StorageMode> => {
  const response = await fetch(`${STORAGE_API_URL}?key=driver`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`存储驱动读取失败 (${response.status})`);
  const data = await response.json();
  if (!isStorageMode(data?.driver)) throw new Error('存储驱动数据无效');
  storageAdapter.type = data.driver;
  driverLoaded = true;
  return data.driver;
};

export const getStorage = (): StorageAdapter => storageAdapter;

export const getStorageAsync = async (): Promise<StorageAdapter> => {
  if (!driverLoaded) await fetchStorageDriver();
  return storageAdapter;
};

export interface StorageTransferInfo {
  driver: StorageMode;
  available: StorageMode[];
}

export const fetchStorageTransferInfo = async (): Promise<StorageTransferInfo> => {
  const fallback: StorageTransferInfo = { driver: storageAdapter.type, available: [storageAdapter.type] };
  try {
    const response = await requestWithSession(`${STORAGE_API_URL}/transfer`);
    if (!response.ok) return fallback;
    const data = await response.json().catch(() => null);
    const driver = isStorageMode(data?.driver) ? data.driver : fallback.driver;
    const available = Array.isArray(data?.available) ? data.available.filter(isStorageMode) : [];
    return { driver, available: available.length > 0 ? available : [driver] };
  } catch {
    return fallback;
  }
};

const postStorageTransfer = async (payload: Record<string, unknown>) => {
  const response = await requestWithSession(`${STORAGE_API_URL}/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success) {
    throw new Error(data?.error || `存储数据传输失败 (${response.status})`);
  }
  return data;
};

export const runStorageDataTransfer = async (source: StorageMode, target: StorageMode) => {
  try {
    const data = await postStorageTransfer({ source, target, scope: 'data' });
    return { success: true as const, copied: Array.isArray(data.copied) ? data.copied as string[] : [] };
  } catch (error: any) {
    return { success: false as const, error: error.message };
  }
};

export const runStorageMediaTransferBatch = async (source: StorageMode, target: StorageMode, limit = 50) => {
  try {
    const data = await postStorageTransfer({ source, target, scope: 'media', limit });
    return {
      success: true as const,
      total: Number(data.total || 0),
      copied: Number(data.copied || 0),
      skipped: Number(data.skipped || 0),
      pending: Number(data.pending || 0),
      hasMore: !!data.hasMore
    };
  } catch (error: any) {
    return { success: false as const, error: error.message };
  }
};

export const runCoverGarbageCollectionBatch = async (limit = 100) => {
  try {
    const response = await requestWithSession(`${STORAGE_API_URL}/media-gc?limit=${encodeURIComponent(String(limit))}`, { method: 'POST' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.success) return { success: false as const, error: data?.error || '封面资源清理失败' };
    return {
      success: true as const,
      removed: Number(data?.removed || 0),
      checked: Number(data?.checked || 0),
      pending: Number(data?.pending || 0),
      hasMore: !!data?.hasMore
    };
  } catch (error: any) {
    return { success: false as const, error: error.message };
  }
};

export const getAuditLogs = async (limit = 50) => {
  try {
    const response = await requestWithSession(`${STORAGE_API_URL}/audit-logs?limit=${encodeURIComponent(String(limit))}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !Array.isArray(data?.items)) return { success: false as const, error: data?.error || '读取日志失败' };
    return { success: true as const, items: data.items as AuditLogEntry[] };
  } catch (error: any) {
    return { success: false as const, error: error.message };
  }
};

export const writeAuditLog = async (payload: Pick<AuditLogEntry, 'action' | 'status'> & Partial<Pick<AuditLogEntry, 'details' | 'message'>>) => {
  try {
    const response = await requestWithSession(`${STORAGE_API_URL}/audit-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    return response.ok && data?.success
      ? { success: true as const }
      : { success: false as const, error: data?.error || '写入日志失败' };
  } catch (error: any) {
    return { success: false as const, error: error.message };
  }
};

export const checkServerSession = sessionAuth.check;
export const logoutServerSession = sessionAuth.logout;
export const getAdminProfile = adminAuth.getProfile;
export const updateAdminCredentials = adminAuth.updateCredentials;
