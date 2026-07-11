import { handleRedisStorageApi } from '../server/storage/redisApi.js';

export default async function handler(request: unknown, response: unknown) {
  await handleRedisStorageApi(request, response, { env: process.env, isProduction: true, runtime: 'vercel' });
}
