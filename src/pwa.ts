import { registerSW } from "virtual:pwa-register";

// How often an always-on kiosk re-checks for a freshly deployed build. A panel
// pinned in Guided Access is never relaunched for days, so it would otherwise
// never look for a new service worker: the reload-on-activate path only fires
// once an update is actually found. An hourly conditional GET on the SW keeps
// deploy latency bounded without hammering Home Assistant.
const UPDATE_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Register the PWA service worker (AD-9) and keep an always-on kiosk current.
 *
 * - `immediate: true` registers on load, so the plugin's autoUpdate path
 *   (`activated → window.location.reload()`) is live and the latest build shows
 *   on the current load rather than one launch later.
 * - The periodic `registration.update()` covers the kiosk that is never
 *   relaunched (Guided Access): without it, a new deploy would only be noticed
 *   the next time the PWA is opened. Guarded by an online check and a no-store
 *   fetch of the SW so a transient HA/network outage stays non-fatal — the shell
 *   must keep running on the cached build (AD-6/NFR4).
 */
export function registerPwa(): void {
  registerSW({
    immediate: true,
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;

      // One guarded update check, shared by the hourly poll and the
      // foreground-return trigger. Confirms the SW is actually reachable (200,
      // not an HA error page) before asking the browser to update; a found
      // update auto-activates and reloads (registerType "autoUpdate").
      const checkForUpdate = async () => {
        // Skip while an update is already installing or the device is offline.
        if (registration.installing || !navigator.onLine) return;
        try {
          const resp = await fetch(swUrl, {
            cache: "no-store",
            headers: { "cache-control": "no-cache" },
          });
          if (resp.status === 200) await registration.update();
        } catch {
          // Update check failed (HA unreachable / offline). Non-fatal by design:
          // the shell stays on the cached build (AD-6/NFR4); we retry next time.
        }
      };

      // Always-on kiosk that never backgrounds (Guided Access): poll hourly.
      setInterval(checkForUpdate, UPDATE_INTERVAL_MS);

      // Re-opened PWA: iOS keeps an installed PWA suspended in memory, so a plain
      // reopen resumes stale JS with no navigation and no update check. Re-check
      // as soon as the app returns to the foreground so a pending deploy lands on
      // this open (autoUpdate then reloads) — no force-quit needed.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void checkForUpdate();
      });
    },
  });
}
