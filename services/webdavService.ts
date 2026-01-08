import { PublicData, PrivateData } from '../types';

const PROXY_URL = '/api/webdav';

export const DEFAULT_PUBLIC_DATA: PublicData = {
  settings: {
    title: "我的收藏",
    iconUrl: "https://lucide.dev/favicon.ico"
  },
  tags: [
    { id: '1', name: '番剧' },
    { id: '2', name: '游戏' }
  ],
  cards: []
};

export const DEFAULT_PRIVATE_DATA: PrivateData = {
  username: 'admin',
  password: 'password'
};

// Helper to clean up error messages which may contain HTML/XML
const cleanErrorText = (text: string): string => {
  if (!text) return '';

  // If the error seems to be a Vercel security page, return a specific message.
  if (text.includes('Vercel Security Checkpoint')) {
    return "请求被安全系统拦截。这可能是由于网络环境或浏览器限制。请更换网络或稍后再试。";
  }

  // First, remove style and script blocks entirely to get rid of CSS rules
  let cleaned = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  // Then, remove all remaining HTML/XML tags
  cleaned = cleaned.replace(/<[^>]*>/g, ' ');
  // Finally, normalize whitespace and trim
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned.substring(0, 150) + (cleaned.length > 150 ? '...' : '');
};

const fetchProxy = async (filename: string, options: RequestInit = {}) => {
  const url = `${PROXY_URL}?filename=${encodeURIComponent(filename)}`;
  // Force no-store to prevent mobile browser caching of PROPFIND/GET
  const newOptions = {
    ...options,
    headers: {
      ...options.headers,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache'
    }
  };
  return fetch(url, newOptions);
};

let isDirectoryEnsured = false;

// Exposed for testing connection in UI
export const testConnection = async (): Promise<{ success: boolean; message: string }> => {
  try {
    isDirectoryEnsured = false; // Reset state to force check
    await ensureDirectory();
    if (isDirectoryEnsured) {
      return { success: true, message: "连接成功！文件夹已就绪。" };
    } else {
      return { success: false, message: "连接验证未通过，无法确认文件夹状态。" };
    }
  } catch (e: any) {
    // Return cleaned error message
    const msg = e.message || String(e);
    return { success: false, message: `连接错误: ${cleanErrorText(msg)}` };
  }
};

const ensureDirectory = async () => {
  if (isDirectoryEnsured) return;

  try {
    console.log("Checking WebDAV directory...");
    // 1. Check if directory exists
    const checkRes = await fetchProxy('', {
      method: 'PROPFIND',
      headers: { 'Depth': '0' }
    });
    
    if (checkRes.ok || checkRes.status === 207) {
      console.log("WebDAV directory exists.");
      isDirectoryEnsured = true;
      return;
    }

    if (checkRes.status === 404) {
      console.log("Directory not found (404), attempting MKCOL...");
      // 2. Create directory
      const createRes = await fetchProxy('', { method: 'MKCOL' });
      
      if (createRes.ok || createRes.status === 201) {
        console.log("Directory created successfully.");
        isDirectoryEnsured = true;
      } else {
        const errText = await createRes.text();
        console.error(`Failed to create directory. Status: ${createRes.status}`, errText);
        throw new Error(`无法创建文件夹 (Status ${createRes.status}): ${errText}`);
      }
    } else {
      const errText = await checkRes.text();
      console.error(`Directory check failed. Status: ${checkRes.status}`, errText);
      throw new Error(`文件夹检查失败 (Status ${checkRes.status}): ${errText}`);
    }
  } catch (e) {
    console.error("WebDAV EnsureDirectory Error:", e);
    throw e; // Propagate error to stop subsequent requests
  }
};

const fetchJson = async <T>(filename: string, defaultValue: T): Promise<T> => {
  try {
    await ensureDirectory();
  } catch (e) {
    console.warn("Skipping fetch due to directory error, returning default data.");
    return defaultValue; 
  }
  
  try {
    const response = await fetchProxy(filename, {
      method: 'GET'
    });
    
    if (response.status === 404) {
      console.log(`${filename} not found, initializing with default data...`);
      // Try to save immediately to initialize
      await saveJson(filename, defaultValue);
      return defaultValue;
    }
    
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Proxy/WebDAV Error ${response.status}: ${errText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch ${filename}:`, error);
    return defaultValue;
  }
};

// Returns { success, error } instead of boolean to let UI handle alerts
const saveJson = async <T>(filename: string, data: T): Promise<{ success: boolean; error?: string }> => {
  try {
    await ensureDirectory();
    
    const response = await fetchProxy(filename, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const errText = await response.text();
      console.error(`Save failed ${response.status}:`, errText);
      return { success: false, error: `${response.status} ${cleanErrorText(errText)}` };
    }
    
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to save ${filename}`, error);
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