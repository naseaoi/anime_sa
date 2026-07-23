import { isStorageMode, type StorageMode } from '../domain/storage';
import { ApiRequestError, requestJson } from './apiClient';

const STORAGE_API_URL = '/api/storage';

export type StorageRuntimeState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; driver: StorageMode }
  | { status: 'error'; error: ApiRequestError };

let state: StorageRuntimeState = { status: 'idle' };
let pending: Promise<StorageMode> | null = null;

export const getStorageRuntimeState = () => state;

export const getStorageDriver = (): StorageMode => {
  if (state.status !== 'ready') throw new ApiRequestError('存储驱动尚未就绪', 0, 'DRIVER_NOT_READY');
  return state.driver;
};

export const fetchStorageDriver = async (force = false): Promise<StorageMode> => {
  if (!force && state.status === 'ready') return state.driver;
  if (!force && pending) return pending;

  state = { status: 'loading' };
  pending = requestJson<{ driver?: unknown }>(`${STORAGE_API_URL}?key=driver`, { cache: 'no-store' }, '存储驱动读取失败')
    .then((data) => {
      if (!isStorageMode(data.driver)) throw new ApiRequestError('存储驱动数据无效', 0, 'INVALID_DRIVER');
      state = { status: 'ready', driver: data.driver };
      return data.driver;
    })
    .catch((error: unknown) => {
      const normalized = error instanceof ApiRequestError
        ? error
        : new ApiRequestError(error instanceof Error ? error.message : '存储驱动读取失败');
      state = { status: 'error', error: normalized };
      throw normalized;
    })
    .finally(() => {
      pending = null;
    });

  return pending;
};
