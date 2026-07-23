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

export const instrumentResponse = (request, response, requestId, startedAt, driver) => {
  response.setHeader('X-Request-Id', requestId);
  const end = response.end.bind(response);
  response.end = (...args) => {
    logEvent(response.statusCode >= 500 ? 'error' : 'info', 'http_request', {
      requestId,
      method: request.method,
      path: String(request.url || '').split('?')[0],
      status: response.statusCode,
      durationMs: Date.now() - startedAt,
      driver
    });
    return end(...args);
  };
};
