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

// State to track if we've already ensured the directory exists in this session
let isDirectoryEnsured = false;

const ensureDirectory = async () => {
  if (isDirectoryEnsured) return;

  try {
    // 1. Check if directory exists
    const checkRes = await fetchProxy('', {
      method: 'PROPFIND',
      headers: { 'Depth': '0' }
    });
    
    if (checkRes.ok || checkRes.status === 207) {
      isDirectoryEnsured = true;
      return;
    }

    if (checkRes.status === 404) {
      console.log("Directory not found, attempting to create...");
      // 2. Create directory
      const createRes = await fetchProxy('', { method: 'MKCOL' });
      
      if (createRes.ok || createRes.status === 201) {
        console.log("Directory created successfully.");
        isDirectoryEnsured = true;
      } else {
        const errText = await createRes.text();
        console.error(`Failed to create directory. Status: ${createRes.status}`, errText);
      }
    } else {
      console.error(`Directory check failed. Status: ${checkRes.status}`);
    }
  } catch (e) {
    console.error("WebDAV Directory Check/Create Network Error:", e);
  }
};

const fetchJson = async <T>(filename: string, defaultValue: T): Promise<T> => {
  await ensureDirectory();
  
  try {
    const response = await fetchProxy(filename, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' }
    });
    
    if (response.status === 404) {
      console.log(`${filename} not found, initializing with default data.`);
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

const saveJson = async <T>(filename: string, data: T): Promise<boolean> => {
  // Ensure directory exists before saving (just in case)
  await ensureDirectory();

  try {
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
};