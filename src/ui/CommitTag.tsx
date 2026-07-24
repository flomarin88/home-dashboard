/**
 * Build stamp — the short git SHA of the deployed build (`__APP_COMMIT__`,
 * injected at build time by vite.config.ts). Shown discreetly in the home page's
 * bottom-left corner so a glance confirms which build the kiosk is running — the
 * visible counterpart to the PWA auto-update path (src/pwa.ts).
 *
 * `fixed` + `pointer-events-none` so it never affects the no-scroll grid layout
 * nor intercepts a tap; `aria-hidden` since it's an ops affordance, not content.
 */
export function CommitTag() {
  return (
    <span
      className="pointer-events-none fixed bottom-1 left-2 select-none text-[10px] text-text-muted opacity-40"
      aria-hidden="true"
    >
      {__APP_COMMIT__}
    </span>
  );
}
