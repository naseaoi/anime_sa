import { PublicData, PrivateData } from '../types';

// The frontend now talks to the Vercel API Proxy, not WebDAV directly.
// This solves CORS issues and hides credentials from the client.
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
  // filename can be empty string (for directory operations)
  const url = `${PROXY_URL}?filename=${encodeURIComponent(filename)}`;
  return fetch(url, options);
};

const ensureDirectory = async () => {
  try {
    // Check if directory exists
    const res = await fetchProxy('', {
      method: 'PROPFIND',
      headers: { 'Depth': '0' }
    });
    
    if (res.status === 404) {
      // Create directory
      await fetchProxy('', { method: 'MKCOL' });
    }
  } catch (e) {
    console.error("WebDAV Directory Check Error:", e);
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
      // Initialize file if not found
      await saveJson(filename, defaultValue);
      return defaultValue;
    }
    
    if (!response.ok) throw new Error(`Proxy/WebDAV Error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch ${filename}`, error);
    return defaultValue;
  }
};

const saveJson = async <T>(filename: string, data: T): Promise<boolean> => {
  try {
    const response = await fetchProxy(filename, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    return response.ok;
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