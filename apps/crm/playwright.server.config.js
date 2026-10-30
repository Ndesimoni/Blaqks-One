import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/server-browser',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  outputDir: 'test-results-server',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:5175',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    // UAE users browse in Dubai time; CI runners default to UTC.
    timezoneId: 'Asia/Dubai',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5175',
    url: 'http://localhost:5175',
    reuseExistingServer: false,
    timeout: 30000,
  },
});
