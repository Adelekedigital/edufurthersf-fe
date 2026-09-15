import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // tests/e2e is Playwright's (npm run test:e2e). Without this, `vitest run`
    // collects those specs and fails on Playwright's test() at import time.
    exclude: ['node_modules/**', 'dist/**', '.next/**', 'tests/e2e/**'],
    passWithNoTests: true,
  },
})
