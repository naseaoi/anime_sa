import { SESSION_COOKIE } from './constants.js';

const buildCookieParts = (keyValue, isProduction) => {
  const parts = [keyValue, 'Path=/', 'HttpOnly', 'SameSite=Strict'];
  if (isProduction) parts.push('Secure');
  return parts;
};

export const buildCookie = (token, maxAgeSec, isProduction = false) => {
  const parts = buildCookieParts(`${SESSION_COOKIE}=${encodeURIComponent(token)}`, isProduction);
  parts.push(`Max-Age=${maxAgeSec}`);
  return parts.join('; ');
};

export const clearCookie = (isProduction = false) => {
  const parts = buildCookieParts(`${SESSION_COOKIE}=`, isProduction);
  parts.push('Max-Age=0');
  return parts.join('; ');
};
