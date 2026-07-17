/**
 * Home Assistant connection configuration (AD-2, AD-8).
 *
 * Two connection modes, selected by build target:
 *
 * - **Dev** (`npm run dev`): a long-lived token + HA URL are injected from a
 *   gitignored `.env.local` (`VITE_HA_URL` / `VITE_HA_TOKEN`). The token skips
 *   HA's login screen — convenient against a cross-origin dev server. Values are
 *   NEVER hardcoded and NEVER committed; the AD-8 guard in `vite.config.ts`
 *   blocks a token from ever reaching a production build (T0.5).
 *
 * - **Prod** (AD-8, served same-origin from HA at `/local/…`): the build is
 *   token-less. `hassUrl` points at the current origin and `@hakit` runs HA's
 *   own login **once** — it redirects to `/auth/authorize`, then caches the
 *   token in `localStorage` keyed by `hassUrl`, so subsequent loads never
 *   re-auth (NFR3). No secret is bundled.
 *
 * The dev/prod split is resolved by the pure {@link resolveHassConfig} below so
 * both branches are unit-testable; the exported consts apply it to Vite's env.
 */

export interface HassConfig {
  /** HA base URL the connection targets. Empty ⇒ not connectable. */
  hassUrl: string;
  /** Long-lived token (dev only). Absent under the same-origin session variant. */
  hassToken: string | undefined;
  /** True when a connection can be attempted (see per-mode rules below). */
  isConfigured: boolean;
}

/**
 * Resolve the HA connection config from environment inputs.
 *
 * - `hassUrl`: an explicit `VITE_HA_URL` always wins (dev); otherwise, **in a
 *   production build only**, fall back to the current `origin` (same-origin
 *   session variant). Guarding the origin fallback on `isProd` keeps `hassUrl`
 *   empty under test/dev-without-URL, so the unconfigured path stays reachable.
 * - `isConfigured`: needs a URL, plus — in **dev** — a token (a cross-origin
 *   interactive login is a CORS dead-end there). In **prod**, same-origin
 *   session auth needs only the URL, so a token-less build is configured.
 */
export function resolveHassConfig(env: {
  viteUrl: string | undefined;
  viteToken: string | undefined;
  isProd: boolean;
  origin: string;
}): HassConfig {
  const { viteUrl, viteToken, isProd, origin } = env;
  const hassUrl = viteUrl ?? (isProd ? origin : "");
  const isConfigured =
    hassUrl.length > 0 && (isProd || (viteToken?.length ?? 0) > 0);
  return { hassUrl, hassToken: viteToken, isConfigured };
}

const resolved = resolveHassConfig({
  viteUrl: import.meta.env.VITE_HA_URL,
  viteToken: import.meta.env.VITE_HA_TOKEN,
  isProd: import.meta.env.PROD,
  origin: typeof window !== "undefined" ? window.location.origin : "",
});

/** HA base URL, e.g. `http://homeassistant.local:8123` (dev) or the same origin (prod). */
export const hassUrl: string = resolved.hassUrl;

/** HA long-lived access token. Present in dev only; absent under AD-8 session auth. */
export const hassToken: string | undefined = resolved.hassToken;

/**
 * True when the config needed to attempt a connection is present. In prod the
 * same-origin session variant (AD-8) needs only a URL; in dev a token is still
 * required (interactive cross-origin login is a dead end). When false, the shell
 * renders without a provider so the kiosk is never blank (AD-6/NFR4).
 */
export const isConfigured: boolean = resolved.isConfigured;
