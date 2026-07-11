import { handleRedisStorageApi } from '../server/vercel/redisApi.js';

export default async function handler(request: unknown, response: unknown) {
  await handleRedisStorageApi(request, response, { env: process.env });
}
