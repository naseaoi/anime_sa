import type { AdminCredentialsUpdate, AdminProfile } from '../types';
import { errorMessage, requestJson, requestWithSession } from './apiClient';

const STORAGE_API_URL = '/api/storage';
export const AUTH_CHANGED_EVENT = 'tat:auth-changed';

export const notifyAuthChanged = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
};

export const login = async (username: string, password: string, remember = false) => {
  try {
    const data = await requestJson<{ success?: boolean; error?: string }>(`${STORAGE_API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, remember })
    }, '登录失败');
    if (!data.success) return { success: false as const, error: data.error || '登录失败' };
    notifyAuthChanged();
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: errorMessage(error, '登录失败') };
  }
};

export const logout = async () => {
  try {
    await requestWithSession(`${STORAGE_API_URL}/logout`, { method: 'POST' });
  } catch {}
  notifyAuthChanged();
};

export const checkSession = async () => {
  try {
    const data = await requestJson<{ authenticated?: boolean }>(`${STORAGE_API_URL}/session`, {}, 'Session 检查失败');
    return !!data.authenticated;
  } catch {
    return false;
  }
};

export const getAdminProfile = () => requestJson<AdminProfile>(`${STORAGE_API_URL}/admin-profile`, {}, '读取管理员信息失败');

export const updateAdminCredentials = async (payload: AdminCredentialsUpdate) => {
  try {
    const data = await requestJson<{ success?: boolean; error?: string; requireRelogin?: boolean }>(`${STORAGE_API_URL}/admin-credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, '保存管理员信息失败');
    if (!data.success) return { success: false as const, error: data.error || '保存失败' };
    return { success: true as const, requireRelogin: !!data.requireRelogin };
  } catch (error) {
    return { success: false as const, error: errorMessage(error, '保存失败') };
  }
};
