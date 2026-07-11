import { SESSION_COOKIE } from '../core/constants.js';
import { jsonResponse, parseCookies } from '../core/httpUtils.js';
import { verifyRedisSession } from './redisStore.js';

export const getSessionToken = (request) => {
  const cookies = parseCookies(request.headers.cookie || '');
  return cookies[SESSION_COOKIE] || '';
};

export const requireRedisAuth = async (request, response, redis, env) => {
  if (await verifyRedisSession(redis, env, getSessionToken(request))) return true;
  jsonResponse(response, 401, { error: 'Unauthorized: Login required' });
  return false;
};
