import type { AdminCredentialsUpdate, AdminProfile } from '../types';
import { errorMessage, requestJson, requestWithSession } from './apiClient';

const STORAGE_API_URL = '/api/storage';
export const AUTH_CHANGED_EVENT = 'tat:auth-changed';
const SESSION_CACHE_MS = 15_000;

let sessionPending: Promise<boolean> | null = null;
let sessionCachedAt = 0;
let sessionCachedValue = false;

export const notifyAuthChanged = () => {
  sessionCachedAt = 0;
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

export const checkSession = async (force = false) => {
  const now = Date.now();
  if (!force && sessionCachedAt > 0 && now - sessionCachedAt < SESSION_CACHE_MS) {
    return sessionCachedValue;
  }
  if (sessionPending) return sessionPending;

  sessionPending = requestJson<{ authenticated?: boolean }>(`${STORAGE_API_URL}/session`, {}, 'Session 检查失败')
    .then((data) => !!data.authenticated)
    .catch(() => false)
    .then((authenticated) => {
      sessionCachedValue = authenticated;
      sessionCachedAt = Date.now();
      return authenticated;
    })
    .finally(() => {
      sessionPending = null;
    });

  return sessionPending;
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
