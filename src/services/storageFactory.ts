import type { StorageAdapter } from './storageAdapter';
import { login, logout, checkSession, getAdminProfile, updateAdminCredentials } from './authClient';
import { getPrivateData, getPublicData, savePrivateData, savePublicData, testConnection } from './publicDataClient';
import { fetchStorageDriver, getStorageDriver } from './storageRuntime';

export const storageAdapter: StorageAdapter = {
  get type() {
    return getStorageDriver();
  },
  login,
  getAdminProfile,
  updateAdminCredentials,
  getPublicData,
  savePublicData,
  getPrivateData,
  savePrivateData,
  testConnection
};

export const getStorage = (): StorageAdapter => storageAdapter;

export const getStorageAsync = async (): Promise<StorageAdapter> => {
  await fetchStorageDriver();
  return storageAdapter;
};

export const checkServerSession = checkSession;
export const logoutServerSession = logout;

export { AUTH_CHANGED_EVENT, notifyAuthChanged, getAdminProfile, updateAdminCredentials } from './authClient';
export { fetchStorageDriver, getStorageRuntimeState } from './storageRuntime';
export {
  fetchStorageTransferInfo,
  getAuditLogs,
  runCoverGarbageCollectionBatch,
  runStorageDataTransfer,
  runStorageMediaTransferBatch,
  writeAuditLog
} from './storageMaintenanceClient';
export type { StorageTransferInfo } from './storageMaintenanceClient';
