import { registerSW } from "virtual:pwa-register";

// How often to re-check for a freshly deployed build (belt-and-suspenders with
// the check on every return-to-foreground).
const UPDATE_INTERVAL_MS = 60 * 60 * 1000;
// Never hard-reload more than once per minute — a stale HTTP cache could
// otherwise loop if a reload doesn't actually pick up the new build.
const HEAL_GUARD_MS = 60 * 1000;

/**
 * Keep the always-on kiosk on the latest deployed build.
 *
 * The plugin's `autoUpdate` path (registerSW → SW `skipWaiting`/`clientsClaim`
 * → reload) handles capable browsers. But the 2016 iPad's **standalone** PWA
 * does NOT reliably run the SW update lifecycle: it stayed pinned to its
 * install-time build across force-quit/relaunch. So we don't trust the SW to
 * update itself — we detect staleness out-of-band and heal it directly:
 *
 *  1. Fetch `version.json` (emitted at build, NOT precached) cache-busted +
 *     `no-store`, so it bypasses both the SW precache and the HTTP cache and
 *     reports the *deployed* build's commit.
 *  2. If it differs from ours (`__APP_COMMIT__`), **unregister the wedged SW**
 *     and `location.reload()` — a fresh network load, independent of the SW's
 *     broken update path. A sessionStorage guard prevents reload loops.
 */
async function checkForFreshBuild(): Promise<void> {
  if (!navigator.onLine) return;
  try {
    const res = await fetch(
      `${import.meta.env.BASE_URL}version.json?_=${Date.now()}`,
      { cache: "no-store", headers: { "cache-control": "no-cache" } },
    );
    if (!res.ok) return;
    const { commit } = (await res.json()) as { commit?: string };
    if (!commit || commit === __APP_COMMIT__) return;

    const last = Number(sessionStorage.getItem("build-heal-at") || 0);
    if (Date.now() - last < HEAL_GUARD_MS) return; // anti-loop
    sessionStorage.setItem("build-heal-at", String(Date.now()));

    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.unregister();
    location.reload();
  } catch {
    // Offline / HA unreachable — stay on the cached build (AD-6/NFR4); retry
    // on the next foreground/interval tick.
  }
}

/**
 * Register the PWA service worker (AD-9) and keep the kiosk current.
 *
 * `immediate: true` keeps the plugin's autoUpdate path live for capable
 * browsers; `checkForFreshBuild` is the robust fallback for the old iPad,
 * running on load, on every return-to-foreground, and hourly.
 */
export function registerPwa(): void {
  registerSW({ immediate: true });

  void checkForFreshBuild();
  setInterval(() => void checkForFreshBuild(), UPDATE_INTERVAL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkForFreshBuild();
  });
}
