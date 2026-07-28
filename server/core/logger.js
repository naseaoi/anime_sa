import crypto from 'crypto';

export const createRequestId = (request) => {
  const incoming = String(request.headers?.['x-request-id'] || '').trim();
  return /^[a-zA-Z0-9._:-]{1,96}$/.test(incoming) ? incoming : crypto.randomUUID();
};

export const logEvent = (level, event, fields = {}) => {
  const payload = { ts: new Date().toISOString(), level, event, ...fields };
  const output = JSON.stringify(payload);
  if (level === 'error') console.error(output);
  else console.log(output);
};

export const shouldLogHttpRequest = (request, status, durationMs) => {
  if (status >= 400 || durationMs >= 1000) return true;
  const pathname = String(request.url || '').split('?')[0];
  const isApi = pathname.startsWith('/api/');
  const isMedia = pathname === '/api/storage/media' || pathname === '/api/sqlite/media';
  return isApi && !isMedia;
};

export const instrumentResponse = (request, response, requestId, startedAt, driver) => {
  response.setHeader('X-Request-Id', requestId);
  const end = response.end.bind(response);
  response.end = (...args) => {
    const durationMs = Date.now() - startedAt;
    if (shouldLogHttpRequest(request, response.statusCode, durationMs)) {
      logEvent(response.statusCode >= 500 ? 'error' : 'info', 'http_request', {
        requestId,
        method: request.method,
        path: String(request.url || '').split('?')[0],
        status: response.statusCode,
        durationMs,
        driver
      });
    }
    return end(...args);
  };
};
