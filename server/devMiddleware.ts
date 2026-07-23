import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleStorageApi } from './core/apiCore.js';
import { resolveStorageDriver } from './core/storageDriver.js';
import { handleRedisStorageApi } from './storage/redisApi.js';
import { handleStorageTransferApi } from './storage/transferApi.js';

type ApiRequest = IncomingMessage & { body?: unknown };
type ApiResponse = ServerResponse;

// 挂载开发态 API 路由：业务逻辑全部委托驱动 handler
const mountApiRoutes = (server: ViteDevServer, env: Record<string, string>) => {
  const driver = resolveStorageDriver(env);

  server.middlewares.use('/api/storage/transfer', async (req: ApiRequest, res: ApiResponse) => {
    await handleStorageTransferApi(req, res, { env, driver });
  });

  const handleApi = async (req: ApiRequest, res: ApiResponse) => {
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
