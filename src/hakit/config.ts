/**
 * Home Assistant connection configuration (AD-2, AD-8).
 *
 * The long-lived access token and HA URL are injected at runtime from a
 * gitignored `.env.local` (Vite exposes `VITE_`-prefixed vars on
 * `import.meta.env`). They are NEVER hardcoded and NEVER committed.
 *
 * Deployment variant (AD-8, preferred, not implemented in this story):
 * when the app is served same-origin from Home Assistant (add-on / ingress),
 * the HA session can authenticate the client instead of a bundled token.
 * In that setup `hassUrl` can point at the same origin and the token becomes
 * optional. Until then, local dev uses the env-injected token below.
 */

/** HA base URL, e.g. `http://homeassistant.local:8123`. */
export const hassUrl: string = import.meta.env.VITE_HA_URL ?? ''

/** HA long-lived access token. Optional under the HA-session variant. */
export const hassToken: string | undefined = import.meta.env.VITE_HA_TOKEN

/**
 * True when the config needed to attempt a token-authenticated connection is
 * present. Both URL and token are required today because the HA-session /
 * ingress variant (AD-8) is not yet implemented — without a token, HassConnect
 * would fall back to HA's interactive login screen, a dead end on a
 * keyboard-less kiosk. When the session variant lands, this check will relax.
 */
export const isConfigured: boolean =
  hassUrl.length > 0 && (hassToken?.length ?? 0) > 0
