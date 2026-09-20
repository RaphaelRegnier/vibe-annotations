import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  workers: 1, // Keep single worker for extension & port stability
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/e2e-report.json' }],
  ],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node tests/fixtures/server.js',
    url: 'http://127.0.0.1:3005/health',
    reuseExistingServer: !process.env.CI,
    timeout: 10000,
  },
});
