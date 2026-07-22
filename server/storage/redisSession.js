import { SESSION_COOKIE } from '../core/constants.js';
import { errorResponse, parseCookies } from '../core/httpUtils.js';
import { verifyRedisSession } from './redisStore.js';

export const getSessionToken = (request) => {
  const cookies = parseCookies(request.headers.cookie || '');
  return cookies[SESSION_COOKIE] || '';
};

export const requireRedisAuth = async (request, response, redis, env) => {
  if (await verifyRedisSession(redis, env, getSessionToken(request))) return true;
  errorResponse(response, 401, 'Unauthorized: Login required');
  return false;
};
