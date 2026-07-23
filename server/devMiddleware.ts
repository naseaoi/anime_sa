import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleStorageApi } from './core/apiCore.js';
import { resolveStorageDriver } from './core/storageDriver.js';
import { handleRedisStorageApi } from './storage/redisApi.js';
import { handleStorageTransferApi } from './storage/transferApi.js';
import { errorResponse, getClientIp } from './core/httpUtils.js';
import { createInMemoryRateLimiter } from './core/rateLimit.js';

type ApiRequest = IncomingMessage & { body?: unknown };
type ApiResponse = ServerResponse;

// 挂载开发态 API 路由：业务逻辑全部委托驱动 handler
const mountApiRoutes = (server: ViteDevServer, env: Record<string, string>) => {
  const driver = resolveStorageDriver(env);
  const rateLimiter = createInMemoryRateLimiter();
  const allowRequest = (req: ApiRequest, res: ApiResponse, scope: string, max: number, windowMs: number) => {
    const result = rateLimiter.check(scope, getClientIp(req), max, windowMs);
    if (result.allowed) return true;
    res.setHeader('Retry-After', String(result.retryAfterSec));
    errorResponse(res, 429, 'Too many requests', { retryAfterSec: result.retryAfterSec });
    return false;
  };

  server.middlewares.use('/api/storage/transfer', async (req: ApiRequest, res: ApiResponse) => {
    if (!allowRequest(req, res, 'api:storage', 600, 60 * 1000)) return;
    await handleStorageTransferApi(req, res, { env, driver });
  });

  const handleApi = async (req: ApiRequest, res: ApiResponse) => {
    if (driver === 'sqlite') {
      const login = String(req.url || '').endsWith('/login');
      if (!allowRequest(req, res, login ? 'api:login' : 'api:storage', login ? 20 : 600, login ? 10 * 60 * 1000 : 60 * 1000)) return;
    }
    if (driver === 'redis') {
      await handleRedisStorageApi(req, res, { env, isProduction: false, runtime: 'node' });
      return;
    }
    await handleStorageApi(req, res, { env, isProduction: false });
  };

  server.middlewares.use('/api/storage', handleApi);
  server.middlewares.use('/api/sqlite', handleApi);
};

// 暴露为 Vite 插件，让 vite.config.ts 不必感知 configureServer 细节
export const devApiPlugin = (env: Record<string, string>): Plugin => ({
  name: 'anime-sa-dev-api',
  configureServer(server) {
    mountApiRoutes(server, env);
  }
});
