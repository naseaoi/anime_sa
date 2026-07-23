import { defineConfig, devices } from '@playwright/test';

process.env.ADMIN_USERNAME = 'e2e_admin';
process.env.ADMIN_PASSWORD = 'e2e_password';
process.env.SQLITE_DATA_DIR = '.e2e-data';
process.env.STORAGE_DRIVER = 'sqlite';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  globalSetup: './e2e/globalSetup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome']
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
