import type { Plugin, ViteDevServer } from 'vite';
import { handleStorageApi } from './core/apiCore.js';

// 挂载开发态 API 路由：业务逻辑全部委托 core/apiCore.js
const mountApiRoutes = (server: ViteDevServer, env: Record<string, string>) => {
  server.middlewares.use('/api/storage', async (req: any, res: any) => {
    await handleStorageApi(req, res, { env, isProduction: false });
  });

  server.middlewares.use('/api/sqlite', async (req: any, res: any) => {
    await handleStorageApi(req, res, { env, isProduction: false });
  });
};

// 暴露为 Vite 插件，让 vite.config.ts 不必感知 configureServer 细节
export const devApiPlugin = (env: Record<string, string>): Plugin => ({
  name: 'anime-sa-dev-api',
  configureServer(server) {
    mountApiRoutes(server, env);
  }
});
