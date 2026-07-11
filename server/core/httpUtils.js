import { BODY_LIMIT_BYTES } from './constants.js';

export const jsonResponse = (response, status, payload) => {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Pragma', 'no-cache');
  response.end(JSON.stringify(payload));
};

export const readBody = async (request, limit = BODY_LIMIT_BYTES) => {
  if (request.body !== undefined && request.body !== null) {
    const body = Buffer.isBuffer(request.body)
      ? request.body
      : Buffer.from(typeof request.body === 'string' ? request.body : JSON.stringify(request.body));
    if (body.length > limit) {
      const error = new Error('Payload too large');
      error.code = 'PAYLOAD_TOO_LARGE';
      throw error;
    }
    return body;
  }

  const chunks = [];
  let received = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    received += buffer.length;
    if (received > limit) {
      const error = new Error('Payload too large');
      error.code = 'PAYLOAD_TOO_LARGE';
      throw error;
    }
    chunks.push(buffer);
  }
  return chunks.length > 0 ? Buffer.concat(chunks) : Buffer.alloc(0);
};

export const parseCookies = (cookieHeader = '') => {
  return cookieHeader.split(';').reduce((cookies, item) => {
    const index = item.indexOf('=');
    if (index === -1) return cookies;
    const key = item.slice(0, index).trim();
    const value = decodeURIComponent(item.slice(index + 1).trim());
    if (key) cookies[key] = value;
    return cookies;
  }, {});
};

export const getClientIp = (request) => {
  const remoteAddress = String(request.socket?.remoteAddress || 'unknown').slice(0, 128);
  if (process.env.TRUST_PROXY !== '1') return remoteAddress;

  const realIp = request.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim().slice(0, 128);

  const forwardedFor = request.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',').at(-1).trim().slice(0, 128);
  }
  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return String(forwardedFor.at(-1)).split(',').at(-1).trim().slice(0, 128);
  }
  return remoteAddress;
};
