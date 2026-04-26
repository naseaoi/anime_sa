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
      // 拆分长期稳定的第三方依赖到独立 chunk，提高浏览器缓存命中：
      // - react-dp：日历库 + date-fns，只在管理员编辑卡片日期时加载
      // - react-vendor：react/react-dom/react-router/scheduler，长期不变
      // - icons：lucide-react，体积偏大但调用面广
      rollupOptions: {
        output: {
          manualChunks: {
            'react-dp': ['react-day-picker', 'date-fns', 'date-fns/locale'],
            'react-vendor': ['react', 'react-dom', 'react-router-dom', 'scheduler'],
            icons: ['lucide-react']
          }
        }
      }
    }
  };
});
