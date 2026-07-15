/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Vitest config kept separate from vite.config.ts so the test runner never
// touches the production build config (incl. the AD-8 token guard). jsdom for
// React component tests; CSS is skipped (tests assert DOM/behaviour, not
// computed Tailwind styles).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    // Force an unconfigured HA in unit tests so they never depend on a local
    // .env.local (vitest loads it). Components that need HA are tested with
    // their own mocks; isConfigured stays false here, deterministically.
    env: { VITE_HA_URL: '', VITE_HA_TOKEN: '' },
    // @hakit/core does `import { clamp } from 'lodash'` (CJS named import);
    // inline it so Vite transforms it instead of failing on the CJS interop.
    server: { deps: { inline: ['@hakit/core', '@hakit/components'] } },
  },
})
