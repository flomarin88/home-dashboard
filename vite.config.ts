import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// Deploy base path. Default '/' keeps dev (localhost) and a root/add-on deploy
// simple. For the HA `www/` deploy the CI sets DEPLOY_BASE=/local/home-dashboard/
// (served at http://ha:8123/local/home-dashboard/). Always normalised with a
// leading + trailing slash.
const rawBase = process.env.DEPLOY_BASE || "/";
const base = `/${rawBase.replace(/^\/+|\/+$/g, "")}/`.replace("//", "/");
const isRoot = base === "/";

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
  if (command === "build") {
    const env = loadEnv(mode, process.cwd(), "VITE_");
    if (env.VITE_HA_TOKEN) {
      throw new Error(
        "AD-8: VITE_HA_TOKEN is set for a production build and would be inlined " +
          "into dist/. Unset it and rely on the HA session (same-origin), or " +
          "build in an environment without the token.",
      );
    }
    // AD-13 / T0.5: same guard for the NutriClaude kitchen-account password. The
    // Supabase URL + anon key ARE public build config (bounded by RLS), but the
    // password must never be inlined — it is a one-time setup login; only the
    // persisted session lives at runtime. See docs/nutriclaude.md.
    if (env.VITE_NUTRICLAUDE_CUISINE_PASSWORD) {
      throw new Error(
        "AD-13: VITE_NUTRICLAUDE_CUISINE_PASSWORD is set for a production build " +
          "and would be inlined into dist/. Unset it; the kitchen session is " +
          "established by a one-time setup login and then persists.",
      );
    }
  }

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      // PWA app-shell (AD-9 / NFR1 / NFR3): the service worker precaches the
      // static shell for a near-instant warm start. HA entity data is NEVER
      // cached — it stays live over the WebSocket.
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["icon.svg", "favicon.svg"],
        workbox: {
          // App-shell allowlist (AD-9): precache ONLY what first paint needs.
          // Lazy chunks (e.g. @hakit's ~60 i18n locale bundles) load on demand.
          globPatterns: [
            "index.html",
            "assets/index-*.{js,css}",
            "**/*.{svg,webmanifest,woff,woff2}",
          ],
          navigateFallback: `${base}index.html`,
          // Only needed for a root/add-on deploy where the SW scope is '/' and
          // could intercept HA's own routes. Under a /local/ subpath the SW
          // scope already isolates the app, so no denylist.
          navigateFallbackDenylist: isRoot
            ? [/^\/api/, /^\/auth/, /^\/local/]
            : [],
        },
        devOptions: { enabled: false },
        manifest: {
          name: "Home Dashboard",
          short_name: "Maison",
          description: "Tableau de bord domotique — cuisine",
          lang: "fr",
          dir: "ltr",
          // Launch the installed PWA at the real index.html file, not the bare
          // directory (`base`) — HA's /local/ 403s a directory URL, so a
          // directory start_url fails the home-screen relaunch before the SW is
          // active. HashRouter resolves the empty hash to "/" (Home).
          start_url: `${base}index.html`,
          scope: base,
          display: "fullscreen",
          orientation: "landscape",
          background_color: "#1a1140",
          theme_color: "#1a1140",
          icons: [
            {
              src: "icon.svg",
              sizes: "any",
              type: "image/svg+xml",
              purpose: "any maskable",
            },
          ],
        },
      }),
    ],
  };
});
