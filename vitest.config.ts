/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Vitest config kept separate from vite.config.ts so the test runner never
// touches the production build config (incl. the AD-8 token guard). jsdom for
// React component tests; CSS is skipped (tests assert DOM/behaviour, not
// computed Tailwind styles).
export default defineConfig({
  plugins: [react()],
  // Kept in sync with vite.config.ts so `__APP_COMMIT__` (injected there) is also
  // defined under the test runner — components that render it don't ReferenceError.
  define: { __APP_COMMIT__: JSON.stringify("test") },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    // Force an unconfigured HA in unit tests so they never depend on a local
    // .env.local (vitest loads it). Components that need HA are tested with
    // their own mocks; isConfigured stays false here, deterministically.
    // ⚠️ TZ ÉPINGLÉ. Le kiosque vit dans une maison française et tout est
    // formaté en fr-FR ; une suite qui dépend du fuseau de la machine qui la
    // lance est verte chez le dev et rouge en CI. C'est exactement ce qui est
    // arrivé le 2026-07-29 : une fixture reprise de la vraie réponse HA porte
    // un instant absolu (`…T23:45:00+02:00`), rendu 23:45 à Paris et 21:45 sur
    // un runner en UTC — huit déploiements en échec et la prod bloquée onze
    // commits en arrière, sans que le pre-commit local puisse le voir.
    env: { VITE_HA_URL: "", VITE_HA_TOKEN: "", TZ: "Europe/Paris" },
    // @hakit/core does `import { clamp } from 'lodash'` (CJS named import);
    // inline it so Vite transforms it instead of failing on the CJS interop.
    server: { deps: { inline: ["@hakit/core", "@hakit/components"] } },
  },
});
