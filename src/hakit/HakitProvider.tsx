import type { ReactNode } from "react";
import { HassConnect } from "@hakit/core";
import { hassUrl, hassToken } from "./config";

/**
 * The single Home Assistant connection seam (AD-2).
 *
 * Every component reaches HA exclusively through the `@hakit` provider mounted
 * here — there are no ad-hoc REST/WebSocket calls to HA anywhere else in the
 * app. `HassConnect` opens the WebSocket, subscribes to entity state, and
 * exposes it via the `@hakit` hooks (useHass / useEntity / ...). Confirmed
 * entity state is read live from that subscription; it is never copied into a
 * persistent cache (AD-3).
 *
 * Providing `hassToken` (dev) bypasses the interactive HA login screen. When
 * the token is absent — the prod same-origin session variant (AD-8) — `@hakit`
 * runs HA's own login once: it redirects to `/auth/authorize`, then caches the
 * token in `localStorage` keyed by `hassUrl` so later loads never re-auth (NFR3).
 */
export function HakitProvider({
  children,
  loading,
}: {
  children: ReactNode;
  /** Rendered while HA is connecting/unauthenticated — pass the shell so the
   *  kiosk is never blank behind the connection gate (AD-6 / NFR4). */
  loading?: ReactNode;
}) {
  return (
    <HassConnect hassUrl={hassUrl} hassToken={hassToken} loading={loading}>
      {children}
    </HassConnect>
  );
}
