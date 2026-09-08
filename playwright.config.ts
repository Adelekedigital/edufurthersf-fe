import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // Every worker shares a single dev-server process (see webServer below). Uncapped local
  // parallelism spawns enough concurrent browser contexts to overwhelm that one Turbopack
  // server's on-demand route compilation, producing intermittent navigation timeouts and
  // truncated reporter output that have nothing to do with the app itself.
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { outputFolder: 'artifacts/playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: { command: 'npm run dev -- --hostname 127.0.0.1 --port 3000', url: 'http://127.0.0.1:3000', reuseExistingServer: !process.env.CI, timeout: 120_000 },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } },
  ],
})
