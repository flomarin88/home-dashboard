/**
 * `src/hakit/` — the sole Home Assistant connectivity seam (AD-2).
 *
 * Import HA access from here (or from `@hakit/core` hooks used *within* the
 * tree mounted by `HakitProvider`). Do not open REST/WebSocket connections to
 * HA anywhere else. The single sanctioned exception is the future camera media
 * helper (`src/media/`, FR8).
 */
export { HakitProvider } from "./HakitProvider";
export { hassUrl, hassToken, isConfigured } from "./config";
