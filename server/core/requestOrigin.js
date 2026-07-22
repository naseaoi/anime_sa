import { errorResponse } from './httpUtils.js';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const STATE_CHANGING_DAV_METHODS = new Set(['PUT', 'DELETE', 'MKCOL', 'PROPPATCH', 'MOVE', 'COPY', 'LOCK', 'UNLOCK', 'PROPFIND']);

const isStateChangingRequest = (request) => {
  const method = String(request.method || '').toUpperCase();
  if (STATE_CHANGING_METHODS.has(method)) return true;
  const tunneled = request.headers['x-dav-method'];
  if (!tunneled) return false;
  const realMethod = String(Array.isArray(tunneled) ? tunneled[0] : tunneled).toUpperCase();
  return STATE_CHANGING_DAV_METHODS.has(realMethod);
};

const isSameOriginRequest = (request) => {
  const host = String(request.headers.host || '');
  if (!host) return false;
  const allowed = new Set([`http://${host}`, `https://${host}`]);
  const origin = String(request.headers.origin || '');
  if (origin) return allowed.has(origin);

  const referer = String(request.headers.referer || '');
  if (!referer) return false;
  try {
    const parsed = new URL(referer);
    return allowed.has(`${parsed.protocol}//${parsed.host}`);
  } catch {
    return false;
  }
};

export const enforceSameOrigin = (request, response) => {
  if (!isStateChangingRequest(request) || isSameOriginRequest(request)) return true;
  errorResponse(response, 403, 'Cross-origin request not allowed');
  return false;
};
