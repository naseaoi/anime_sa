import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { devApiPlugin } from './server/devMiddleware';
import { clientBundleGuard } from './scripts/client-bundle-guard.js';

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
      devApiPlugin(env),
      clientBundleGuard()
    ],
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'react-vendor',
                test: /node_modules[\\/](react|react-dom|scheduler|wouter)[\\/]/
              },
              {
                name: 'icons',
                test: /node_modules[\\/]lucide-react[\\/]/
              }
            ]
          }
        }
      }
    }
  };
});
