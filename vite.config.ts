import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Static build (AD-9): `vite build` emits a self-contained bundle to dist/,
// meant to be served same-origin from Home Assistant (add-on / ingress / www).
// No application server. Tailwind is primary (styling convention); the Emotion
// CSS-in-JS used internally by @hakit/components stays isolated to it.
// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // AD-8 / T0.5 guard: Vite statically inlines `import.meta.env.VITE_*` into the
  // bundle, so a production build with the HA token set would leak it into the
  // readable static build. The token is a dev-server convenience only; the
  // shippable build must rely on the HA session (same-origin). Fail loudly
  // rather than silently baking a secret into dist/.
  if (command === 'build') {
    const env = loadEnv(mode, process.cwd(), 'VITE_HA_TOKEN')
    if (env.VITE_HA_TOKEN) {
      throw new Error(
        'AD-8: VITE_HA_TOKEN is set for a production build and would be inlined ' +
          'into dist/. Unset it and rely on the HA session (same-origin), or ' +
          'build in an environment without the token.',
      )
    }
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      // PWA app-shell (AD-9 / NFR1 / NFR3): the service worker precaches the
      // static shell for a near-instant warm start. HA entity data is NEVER
      // cached — it stays live over the WebSocket; and HA HTTP routes are kept
      // off the SPA navigate-fallback so a same-origin HA deploy still serves
      // /api, /auth, /local directly.
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'favicon.svg'],
        workbox: {
          // App-shell allowlist (AD-9): precache ONLY what first paint needs —
          // index.html, the entry chunk + CSS, the SW registration, icons and
          // the manifest. Lazy-loaded chunks (e.g. @hakit's ~60 i18n locale
          // bundles, ~18MB) are intentionally NOT precached; they load on
          // demand at runtime. An explicit allowlist avoids both the 18MB
          // precache and the fragility of excluding unknown chunks by name.
          globPatterns: [
            'index.html',
            'registerSW.js',
            'assets/index-*.{js,css}',
            '**/*.{svg,webmanifest,woff,woff2}',
          ],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api/, /^\/auth/, /^\/local/],
        },
        devOptions: { enabled: false },
        manifest: {
          name: 'Home Dashboard',
          short_name: 'Maison',
          description: 'Tableau de bord domotique — cuisine',
          lang: 'fr',
          dir: 'ltr',
          start_url: '/',
          scope: '/',
          display: 'fullscreen',
          orientation: 'landscape',
          background_color: '#1a1140',
          theme_color: '#1a1140',
          icons: [
            {
              src: 'icon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any maskable',
            },
          ],
        },
      }),
    ],
  }
})
