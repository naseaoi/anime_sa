export function handleStorageApi(
  request: unknown,
  response: unknown,
  options?: { env?: Record<string, string | undefined>; isProduction?: boolean }
): Promise<void>;

export { errorResponse, getClientIp } from './httpUtils.js';
export { isBlockedRemoteHost } from './remoteSecurity.js';
export { createSession, destroySession, verifySession } from './sessionStore.js';
