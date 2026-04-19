import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { devApiPlugin } from './server/devMiddleware';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    resolve: {
      alias: {
        '@': '/src'
      }
    },
    plugins: [
      react(),
      devApiPlugin(env)
    ]
  };
});
