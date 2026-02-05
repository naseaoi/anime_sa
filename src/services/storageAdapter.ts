
import { PublicData, PrivateData } from '../types';
import { DEFAULT_PUBLIC_DATA, DEFAULT_PRIVATE_DATA } from './webdavService'; // Reuse defaults

export interface StorageAdapter {
  getPublicData(): Promise<PublicData>;
  savePublicData(data: PublicData): Promise<{ success: boolean; error?: string }>;
  getPrivateData(): Promise<PrivateData>;
  savePrivateData(data: PrivateData): Promise<{ success: boolean; error?: string }>;
  testConnection(): Promise<{ success: boolean; message: string }>;
  login?(username: string, password: string): Promise<{ success: boolean; error?: string }>;
  type: 'webdav' | 'sqlite';
}

// Re-export specific implementations if needed, but mainly use the factory/context
