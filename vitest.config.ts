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
  },
})
