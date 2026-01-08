import { PublicData, PrivateData, WebDavConfig } from '../types';

const getEnvConfig = (): WebDavConfig => {
  const env = (import.meta as any).env || {};
  
  return {
    url: env.VITE_WEBDAV_URL || '',
    username: env.VITE_WEBDAV_USERNAME || '',
    password: env.VITE_WEBDAV_PASSWORD || '',
    path: env.VITE_WEBDAV_PATH || 'my-collection/',
  };
};

const config = getEnvConfig();

// 格式化 Base URL
const getBaseUrl = () => {
  if (!config.url) return '';
  let url = config.url.endsWith('/') ? config.url : `${config.url}/`;
  let path = config.path.replace(/^\/|\/$/g, '');
  return `${url}${path}/`;
};

const FULL_PATH = getBaseUrl();
const AUTH_HEADER = 'Basic ' + btoa(`${config.username}:${config.password}`);

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
  if (!config.url) return;
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
  if (!config.url) return defaultValue;
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