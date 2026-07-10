
import { AdminCredentialsUpdate, AdminProfile, PublicData, PrivateData } from '../types';

export interface SavePublicDataOptions {
  expectedUpdatedAt?: number;
}

export interface StorageWriteResult {
  success: boolean;
  error?: string;
  conflict?: boolean;
}

export interface StorageAdapter {
  getPublicData(): Promise<PublicData>;
  savePublicData(data: PublicData, options?: SavePublicDataOptions): Promise<StorageWriteResult>;
  getPrivateData(): Promise<PrivateData>;
  savePrivateData(data: PrivateData): Promise<StorageWriteResult>;
  testConnection(): Promise<{ success: boolean; message: string }>;
  login?(username: string, password: string, remember?: boolean): Promise<{ success: boolean; error?: string }>;
  getAdminProfile?(): Promise<AdminProfile>;
  updateAdminCredentials?(payload: AdminCredentialsUpdate): Promise<{ success: boolean; error?: string; requireRelogin?: boolean }>;
  type: 'webdav' | 'sqlite';
}
