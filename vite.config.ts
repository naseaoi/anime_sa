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
    ],
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'react-dp',
                test: /node_modules[\\/](react-day-picker|date-fns)[\\/]/
              },
              {
                name: 'react-vendor',
                test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/
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
