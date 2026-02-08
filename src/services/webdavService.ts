import { PublicData, PrivateData } from '../types';

const PROXY_URL = '/api/webdav';

export const DEFAULT_PUBLIC_DATA: PublicData = {
  version: 0,
  settings: {
    title: "我的收藏",
    iconUrl: "https://lucide.dev/favicon.ico",
    footerText: "All rights reserved",
    footerLeft: "© 2026",
    footerRight: "All rights reserved"
  },
  tags: [
    { id: '1', name: '番剧', icon: 'tv' },
    { id: '2', name: '游戏', icon: 'gamepad' }
  ],
  cards: []
};

export const DEFAULT_PRIVATE_DATA: PrivateData = {
  username: '',
  password: ''
};

// Helper to clean up error messages which may contain HTML/XML
const cleanErrorText = (text: string): string => {
  if (!text) return '';

  if (text.includes('Vercel Security Checkpoint')) {
    return "请求被安全系统拦截。这通常发生在移动网络环境下，正在尝试通过方法隧道绕过。";
  }

  let cleaned = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  cleaned = cleaned.replace(/<[^>]*>/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned.substring(0, 150) + (cleaned.length > 150 ? '...' : '');
};

const fetchProxy = async (filename: string, options: RequestInit = {}) => {
  const url = `${PROXY_URL}?filename=${encodeURIComponent(filename)}`;
  const realMethod = options.method || 'GET';
  
  // Method Tunneling: Use POST to bypass strict WAF rules for DAV methods
  const davMethods = ['PROPFIND', 'MKCOL', 'PUT', 'DELETE'];
  const useTunnel = davMethods.includes(realMethod.toUpperCase());
  
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
    'Cache-Control': 'no-store',
    'x-dav-method': realMethod // Pass the real intended method
  };

  const newOptions: RequestInit = {
    ...options,
    method: useTunnel ? 'POST' : realMethod,
    credentials: 'include',
    headers
  };

  return fetch(url, newOptions);
};

let isDirectoryEnsured = false;

export const testConnection = async (): Promise<{ success: boolean; message: string }> => {
  try {
    isDirectoryEnsured = false;
    await ensureDirectory();
    if (isDirectoryEnsured) {
      return { success: true, message: "连接成功！文件夹已就绪。" };
    } else {
      return { success: false, message: "连接验证未通过。" };
    }
  } catch (e: any) {
    const msg = e.message || String(e);
    return { success: false, message: `连接错误: ${cleanErrorText(msg)}` };
  }
};

const ensureDirectory = async () => {
  if (isDirectoryEnsured) return;

  try {
    const checkRes = await fetchProxy('', {
      method: 'PROPFIND',
      headers: { 'Depth': '0' }
    });
    
    if (checkRes.ok || checkRes.status === 207) {
      isDirectoryEnsured = true;
      return;
    }

    if (checkRes.status === 404) {
      const createRes = await fetchProxy('', { method: 'MKCOL' });
      if (createRes.ok || createRes.status === 201) {
        isDirectoryEnsured = true;
      } else {
        const errText = await createRes.text();
        throw new Error(`无法创建文件夹 (Status ${createRes.status}): ${errText}`);
      }
    } else {
      const errText = await checkRes.text();
      throw new Error(`文件夹检查失败 (Status ${checkRes.status}): ${errText}`);
    }
  } catch (e) {
    console.error("WebDAV EnsureDirectory Error:", e);
    throw e;
  }
};

const fetchJson = async <T>(filename: string, defaultValue: T): Promise<T> => {
  try {
    await ensureDirectory();
  } catch (e) {
    return defaultValue; 
  }
  
  try {
    const response = await fetchProxy(filename, { method: 'GET' });
    if (response.status === 404) {
      await saveJson(filename, defaultValue);
      return defaultValue;
    }
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Proxy Error ${response.status}: ${errText}`);
    }
    const data = await response.json();
    // Fix: Inject Last-Modified if updatedAt is missing, or calculate from cards
    if (data && typeof data === 'object') {
        if (!data.updatedAt) {
            const lastMod = response.headers.get('last-modified');
            if (lastMod) {
                data.updatedAt = new Date(lastMod).getTime();
            }
        }
        
        if (!data.updatedAt && Array.isArray((data as any).cards)) {
            const cards = (data as any).cards;
            if (cards.length > 0) {
                 const maxTime = cards.reduce((max: number, c: any) => Math.max(max, c.updatedAt || 0), 0);
                 if (maxTime > 0) data.updatedAt = maxTime;
            }
        }
    }
    return data;
  } catch (error) {
    return defaultValue;
  }
};

const saveJson = async <T>(filename: string, data: T): Promise<{ success: boolean; error?: string }> => {
  try {
    await ensureDirectory();
    const response = await fetchProxy(filename, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `${response.status} ${cleanErrorText(errText)}` };
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: cleanErrorText(error.message || String(error)) };
  }
};

export const webdav = {
  getPublicData: () => fetchJson<PublicData>('public_data.json', DEFAULT_PUBLIC_DATA),
  savePublicData: (data: PublicData) => saveJson('public_data.json', data),
  getPrivateData: () => fetchJson<PrivateData>('private_data.json', DEFAULT_PRIVATE_DATA),
  savePrivateData: (data: PrivateData) => saveJson('private_data.json', data),
  testConnection
};
