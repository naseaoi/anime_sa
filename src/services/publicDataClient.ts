import type { PrivateData, PublicData } from '../types';
import { applyDerivedPublicDataVersion, DEFAULT_PRIVATE_DATA, DEFAULT_PUBLIC_DATA } from '../domain/publicData';
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

export const savePublicData = async (data: PublicData, options: SavePublicDataOptions = {}) => {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (options.expectedUpdatedAt !== undefined) headers['X-Expected-Updated-At'] = String(options.expectedUpdatedAt);
    const response = await requestWithSession(`${STORAGE_API_URL}?key=public_data`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const error = await readApiRequestError(response, `数据保存失败 (${response.status})`);
      return response.status === 409 ? conflictResult(error.message) : failedResult(error.message);
    }
    return persistedResult();
  } catch (error) {
    return failedResult(errorMessage(error, '数据保存失败'));
  }
};

export const getPrivateData = async (): Promise<PrivateData> => {
  return await requestJson<PrivateData | null>(`${STORAGE_API_URL}?key=private_data`, {}, '私有数据读取失败') || DEFAULT_PRIVATE_DATA;
};

export const savePrivateData = async (data: PrivateData) => {
  try {
    await requestJson(`${STORAGE_API_URL}?key=private_data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }, '私有数据保存失败');
    return persistedResult();
  } catch (error) {
    return failedResult(errorMessage(error, '私有数据保存失败'));
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
