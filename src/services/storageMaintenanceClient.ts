import type { AuditLogEntry } from '../types';
import { isStorageMode, type StorageMode } from '../domain/storage';
import { errorMessage, requestJson } from './apiClient';
import { getStorageDriver } from './storageRuntime';

const STORAGE_API_URL = '/api/storage';

export interface StorageTransferInfo {
  driver: StorageMode;
  available: StorageMode[];
}

export const fetchStorageTransferInfo = async (): Promise<StorageTransferInfo> => {
  const current = getStorageDriver();
  try {
    const data = await requestJson<{ driver?: unknown; available?: unknown }>(`${STORAGE_API_URL}/transfer`, {}, '存储信息读取失败');
    const driver = isStorageMode(data.driver) ? data.driver : current;
    const available = Array.isArray(data.available) ? data.available.filter(isStorageMode) : [];
    return { driver, available: available.length > 0 ? available : [driver] };
  } catch {
    return { driver: current, available: [current] };
  }
};

const postTransfer = (payload: Record<string, unknown>) => requestJson<Record<string, unknown>>(`${STORAGE_API_URL}/transfer`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
}, '存储数据传输失败');

export const runStorageDataTransfer = async (source: StorageMode, target: StorageMode) => {
  try {
    const data = await postTransfer({ source, target, scope: 'data' });
    return { success: true as const, copied: Array.isArray(data.copied) ? data.copied as string[] : [] };
  } catch (error) {
    return { success: false as const, error: errorMessage(error, '存储数据传输失败') };
  }
};

export const runStorageMediaTransferBatch = async (source: StorageMode, target: StorageMode, limit = 50) => {
  try {
    const data = await postTransfer({ source, target, scope: 'media', limit });
    return {
      success: true as const,
      total: Number(data.total || 0),
      copied: Number(data.copied || 0),
      skipped: Number(data.skipped || 0),
      pending: Number(data.pending || 0),
      hasMore: !!data.hasMore
    };
  } catch (error) {
    return { success: false as const, error: errorMessage(error, '封面传输失败') };
  }
};

export const runCoverGarbageCollectionBatch = async (limit = 100) => {
  try {
    const data = await requestJson<Record<string, unknown>>(`${STORAGE_API_URL}/media-gc?limit=${encodeURIComponent(String(limit))}`, { method: 'POST' }, '封面资源清理失败');
    return {
      success: true as const,
      removed: Number(data.removed || 0),
      checked: Number(data.checked || 0),
      pending: Number(data.pending || 0),
      hasMore: !!data.hasMore
    };
  } catch (error) {
    return { success: false as const, error: errorMessage(error, '封面资源清理失败') };
  }
};

export const getAuditLogs = async (limit = 50) => {
  try {
    const data = await requestJson<{ items?: unknown; error?: string }>(`${STORAGE_API_URL}/audit-logs?limit=${encodeURIComponent(String(limit))}`, {}, '读取日志失败');
    if (!Array.isArray(data.items)) return { success: false as const, error: data.error || '读取日志失败' };
    return { success: true as const, items: data.items as AuditLogEntry[] };
  } catch (error) {
    return { success: false as const, error: errorMessage(error, '读取日志失败') };
  }
};

export const writeAuditLog = async (payload: Pick<AuditLogEntry, 'action' | 'status'> & Partial<Pick<AuditLogEntry, 'details' | 'message'>>) => {
  try {
    await requestJson(`${STORAGE_API_URL}/audit-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, '写入日志失败');
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: errorMessage(error, '写入日志失败') };
  }
};
