
import { AdminCredentialsUpdate, AdminProfile, PublicData, PrivateData } from '../types';

export interface StorageAdapter {
  getPublicData(): Promise<PublicData>;
  savePublicData(data: PublicData): Promise<{ success: boolean; error?: string }>;
  getPrivateData(): Promise<PrivateData>;
  savePrivateData(data: PrivateData): Promise<{ success: boolean; error?: string }>;
  testConnection(): Promise<{ success: boolean; message: string }>;
  login?(username: string, password: string, remember?: boolean): Promise<{ success: boolean; error?: string }>;
  getAdminProfile?(): Promise<AdminProfile>;
  updateAdminCredentials?(payload: AdminCredentialsUpdate): Promise<{ success: boolean; error?: string; requireRelogin?: boolean }>;
  type: 'webdav' | 'sqlite';
}
