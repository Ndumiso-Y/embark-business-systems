import { defineConfig, devices } from '@playwright/test';

const BASE = '/embark-industry-demos/';
const PORT = 5174;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.LIVE_URL ?? `http://localhost:${PORT}${BASE}`,
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
    // Optional: point at a pre-installed Chromium (e.g. PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium).
    launchOptions: process.env.PW_EXECUTABLE_PATH ? { executablePath: process.env.PW_EXECUTABLE_PATH } : {},
  },
  webServer: process.env.LIVE_URL
    ? undefined
    : { command: `npm run dev -- --port ${PORT} --strictPort`, url: `http://localhost:${PORT}${BASE}`, reuseExistingServer: true, timeout: 60_000 },
});
