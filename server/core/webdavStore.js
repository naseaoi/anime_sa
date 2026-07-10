import { normalizePublicDataPayload } from '../publicDataValidation.js';
import { normalizeMediaName, normalizeWebDavFilename } from '../sharedSecurity.js';

export const WEBDAV_USER_AGENT = 'Mozilla/5.0 (Node.js) NicheCard/1.0';

export const getWebDavConfig = (env) => {
  const { WEBDAV_URL, WEBDAV_USERNAME, WEBDAV_PASSWORD, WEBDAV_PATH } = env;
  if (!WEBDAV_URL || !WEBDAV_USERNAME || !WEBDAV_PASSWORD) return null;
  return {
    baseUrl: WEBDAV_URL.replace(/\/+$/, ''),
    davPath: (WEBDAV_PATH || 'my-collection').replace(/^\/+|\/+$/g, ''),
    username: WEBDAV_USERNAME,
    password: WEBDAV_PASSWORD
  };
};

export const buildWebDavUrl = (env, filename = '') => {
  const config = getWebDavConfig(env);
  if (!config) return null;
  const normalizedFilename = normalizeWebDavFilename(filename);
  if (normalizedFilename === null) throw new Error('Invalid WebDAV filename');
  const encodedFilename = normalizedFilename
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${config.baseUrl}/${config.davPath}${encodedFilename ? `/${encodedFilename}` : '/'}`;
};

export const getWebDavAuthHeader = (config) => {
  return `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
};

export const fetchWebDavJson = async (env, filename) => {
  const config = getWebDavConfig(env);
  if (!config) throw new Error('Missing WebDAV configuration in environment variables');
  const response = await fetch(buildWebDavUrl(env, filename), {
    method: 'GET',
    headers: { Authorization: getWebDavAuthHeader(config), 'User-Agent': WEBDAV_USER_AGENT }
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`WebDAV request failed (${response.status})`);
  const value = await response.json();
  if (filename === 'public_data.json') {
    const normalized = normalizePublicDataPayload(value);
    if (!normalized) throw new Error('Stored WebDAV public_data is invalid');
    return normalized;
  }
  return value;
};

export const saveWebDavJson = async (env, filename, payload) => {
  const config = getWebDavConfig(env);
  if (!config) throw new Error('Missing WebDAV configuration in environment variables');
  const response = await fetch(buildWebDavUrl(env, filename), {
    method: 'PUT',
    headers: {
      Authorization: getWebDavAuthHeader(config),
      'User-Agent': WEBDAV_USER_AGENT,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`WebDAV write failed (${response.status})`);
};

const decodeXmlEntities = (text) => {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
};

const extractHrefValuesFromXml = (xml) => {
  const values = [];
  const cdataRegex = /<[^>]*:?href[^>]*>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/[^>]*:?href>/gi;
  const plainRegex = /<[^>]*:?href[^>]*>([^<]*)<\/[^>]*:?href>/gi;
  let match;
  while ((match = cdataRegex.exec(xml))) values.push(match[1] || '');
  while ((match = plainRegex.exec(xml))) values.push(match[1] || '');
  return values;
};

export const listWebDavCoverNames = async (env) => {
  const config = getWebDavConfig(env);
  if (!config) throw new Error('Missing WebDAV configuration in environment variables');
  const response = await fetch(buildWebDavUrl(env, 'covers'), {
    method: 'PROPFIND',
    headers: { Authorization: getWebDavAuthHeader(config), 'User-Agent': WEBDAV_USER_AGENT, Depth: '1' }
  });
  if (response.status === 404) return [];
  if (!response.ok && response.status !== 207) throw new Error(`WebDAV list failed (${response.status})`);

  const xml = await response.text();
  const names = new Set();
  for (const rawValue of extractHrefValuesFromXml(xml)) {
    const href = decodeXmlEntities(rawValue).trim();
    try {
      const parsed = new URL(href, config.baseUrl);
      const pathPart = decodeURIComponent(parsed.pathname);
      const marker = '/covers/';
      const markerIndex = pathPart.lastIndexOf(marker);
      if (markerIndex >= 0) {
        const name = pathPart.slice(markerIndex + marker.length).replace(/\/+$/, '');
        const normalized = normalizeMediaName(name);
        if (normalized) names.add(normalized);
      }
    } catch {}
  }
  return [...names];
};

export const deleteWebDavCoverFile = async (env, name) => {
  const config = getWebDavConfig(env);
  if (!config) throw new Error('Missing WebDAV configuration in environment variables');
  const response = await fetch(buildWebDavUrl(env, `covers/${name}`), {
    method: 'DELETE',
    headers: { Authorization: getWebDavAuthHeader(config), 'User-Agent': WEBDAV_USER_AGENT }
  });
  if (response.status === 404) return;
  if (!response.ok) throw new Error(`WebDAV delete failed (${response.status})`);
};
