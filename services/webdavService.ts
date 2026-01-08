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

const fetchProxy = async (filename: string, options: RequestInit = {}) => {
  const url = `${PROXY_URL}?filename=${encodeURIComponent(filename)}`;
  return fetch(url, options);
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
    return { success: false, message: `连接错误: ${e.message || e}` };
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
    // If we can't ensure directory, we probably can't fetch. 
    // But for first load, we might want to return default data so the app doesn't crash.
    return defaultValue; 
  }
  
  try {
    const response = await fetchProxy(filename, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' }
    });
    
    if (response.status === 404) {
      console.log(`${filename} not found, initializing with default data...`);
      // Try to save immediately to initialize
      const saved = await saveJson(filename, defaultValue);
      if (!saved) {
          console.error(`Failed to initialize ${filename} after 404.`);
      }
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

const saveJson = async <T>(filename: string, data: T): Promise<boolean> => {
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
      alert(`保存失败: ${response.status}\n${errText.substring(0, 100)}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`Failed to save ${filename}`, error);
    return false;
  }
};

export const webdav = {
  getPublicData: () => fetchJson<PublicData>('public_data.json', DEFAULT_PUBLIC_DATA),
  savePublicData: (data: PublicData) => saveJson('public_data.json', data),
  getPrivateData: () => fetchJson<PrivateData>('private_data.json', DEFAULT_PRIVATE_DATA),
  savePrivateData: (data: PrivateData) => saveJson('private_data.json', data),
  testConnection
};