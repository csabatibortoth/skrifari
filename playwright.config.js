// Copyright 2026 Csaba Tóth
// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from '@playwright/test';

const port = 13100;
const redisUrl = process.env.SKRIFARI_TEST_REDIS_URL ?? 'redis://127.0.0.1:6379';
export const e2eDatabase = `skrifari_e2e_${process.pid}`;
const mongoUri = process.env.SKRIFARI_TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27017';
process.env.E2E_DATABASE = e2eDatabase;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30000,
  workers: 1,
  reporter: [['list']],
  globalSetup: './tests/e2e/global-setup.js',
  globalTeardown: './tests/e2e/global-teardown.js',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    // CI installs Chromium with `npx playwright install chromium`; locally set PLAYWRIGHT_CHROMIUM=/snap/bin/chromium (and TMPDIR for the snap)
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined },
  },
  webServer: {
    command: 'node apps/api/src/server.js',
    url: `http://127.0.0.1:${port}/health`,
    reuseExistingServer: false,
    env: {
      NODE_ENV: 'development',
      SKRIFARI_PORT: String(port),
      SKRIFARI_MONGODB_URI: `${mongoUri}/${e2eDatabase}`,
      SKRIFARI_REDIS_URL: redisUrl,
      SKRIFARI_LOG_LEVEL: 'error',
    },
  },
});
