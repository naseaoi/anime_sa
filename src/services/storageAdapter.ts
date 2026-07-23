
import { AdminCredentialsUpdate, AdminProfile, PublicData, PrivateData } from '../types';
import { StorageMode } from '../domain/storage';
import { PersistenceResult } from '../domain/persistence';

export interface SavePublicDataOptions {
  expectedUpdatedAt?: number;
}

export interface StorageAdapter {
  getPublicData(): Promise<PublicData>;
  savePublicData(data: PublicData, options?: SavePublicDataOptions): Promise<PersistenceResult>;
  getPrivateData(): Promise<PrivateData>;
  savePrivateData(data: PrivateData): Promise<PersistenceResult>;
  testConnection(): Promise<{ success: boolean; message: string }>;
  login?(username: string, password: string, remember?: boolean): Promise<{ success: boolean; error?: string }>;
  getAdminProfile?(): Promise<AdminProfile>;
  updateAdminCredentials?(payload: AdminCredentialsUpdate): Promise<{ success: boolean; error?: string; requireRelogin?: boolean }>;
  type: StorageMode;
}
