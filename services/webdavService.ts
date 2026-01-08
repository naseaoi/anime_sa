import { PublicData, PrivateData, WebDavConfig } from '../types';

// In a real Vercel app, these would be process.env.
// For this React environment, we assume they are injected or mocked.
const getEnvConfig = (): WebDavConfig => {
  return {
    url: process.env.WEBDAV_URL || '',
    username: process.env.WEBDAV_USERNAME || '',
    password: process.env.WEBDAV_PASSWORD || '',
    path: process.env.WEBDAV_PATH || 'my-collection/',
  };
};

const config = getEnvConfig();
const AUTH_HEADER = 'Basic ' + btoa(`${config.username}:${config.password}`);
const BASE_URL = config.url.endsWith('/') ? config.url : `${config.url}/`;
const FULL_PATH = `${BASE_URL}${config.path}`;

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

const ensureDirectory = async () => {
  // Check if directory exists, if not create (MKCOL)
  // This is a simplified check. Real WebDAV might require recursive creation.
  try {
    const res = await fetch(FULL_PATH, {
      method: 'PROPFIND',
      headers: {
        'Authorization': AUTH_HEADER,
        'Depth': '0'
      }
    });
    if (res.status === 404) {
      await fetch(FULL_PATH, {
        method: 'MKCOL',
        headers: { 'Authorization': AUTH_HEADER }
      });
    }
  } catch (e) {
    console.error("WebDAV Connect Error:", e);
  }
};

const fetchJson = async <T>(filename: string, defaultValue: T): Promise<T> => {
  if (!config.url) {
    console.warn("WebDAV URL not configured");
    return defaultValue;
  }
  
  await ensureDirectory();

  try {
    const response = await fetch(`${FULL_PATH}${filename}`, {
      method: 'GET',
      headers: {
        'Authorization': AUTH_HEADER,
        'Cache-Control': 'no-cache'
      }
    });

    if (response.status === 404) {
      // File doesn't exist, create it with default
      await saveJson(filename, defaultValue);
      return defaultValue;
    }

    if (!response.ok) throw new Error(`WebDAV Error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch ${filename}`, error);
    return defaultValue;
  }
};

const saveJson = async <T>(filename: string, data: T): Promise<boolean> => {
  if (!config.url) return false;
  try {
    const response = await fetch(`${FULL_PATH}${filename}`, {
      method: 'PUT',
      headers: {
        'Authorization': AUTH_HEADER,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data, null, 2)
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
