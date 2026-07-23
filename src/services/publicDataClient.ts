import type { PublicData } from '../types';
import { applyDerivedPublicDataVersion, DEFAULT_PUBLIC_DATA } from '../domain/publicData';
import { conflictResult, failedResult, persistedResult } from '../domain/persistence';
import { normalizePublicDataPayload } from '../../shared/publicDataSchema.js';
import { errorMessage, readApiRequestError, requestJson, requestWithSession } from './apiClient';
import type { SavePublicDataOptions } from './storageAdapter';

const STORAGE_API_URL = '/api/storage';

export const getPublicData = async (): Promise<PublicData> => {
  const data = await requestJson<unknown>(`${STORAGE_API_URL}?key=public_data`, {}, '数据读取失败');
  if (!data) return DEFAULT_PUBLIC_DATA;
  const normalized = normalizePublicDataPayload(data);
  if (!normalized) throw new Error('服务端返回的公共数据格式无效');
  return applyDerivedPublicDataVersion(normalized);
};

export const savePublicData = async (data: PublicData, options: SavePublicDataOptions) => {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    headers['X-Expected-Revision'] = options.expectedRevision;
    const response = await requestWithSession(`${STORAGE_API_URL}?key=public_data`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const error = await readApiRequestError(response, `数据保存失败 (${response.status})`);
      return response.status === 409 ? conflictResult(error.message) : failedResult(error.message);
    }
    const payload = await response.json().catch(() => ({}));
    if (typeof payload?.revision !== 'string' || payload.revision.length === 0) {
      return failedResult('服务端未返回新的数据 revision');
    }
    return persistedResult(payload.revision);
  } catch (error) {
    return failedResult(errorMessage(error, '数据保存失败'));
  }
};

export const testConnection = async () => {
  try {
    await requestJson(`${STORAGE_API_URL}?key=ping`, { cache: 'no-store' }, '连接失败');
    return { success: true, message: '连接成功' };
  } catch (error) {
    return { success: false, message: errorMessage(error, '连接失败') };
  }
};
