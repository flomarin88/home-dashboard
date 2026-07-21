/**
 * NutriClaude connection configuration (AD-12, AD-13).
 *
 * The Courses feature consumes a SECOND source of truth — NutriClaude/Supabase —
 * behind an isolated seam, never merged with `src/hakit/` (AD-2, 2nd exception).
 * This mirrors `src/hakit/config.ts`: a pure {@link resolveNutriConfig} over env
 * inputs, so both the configured and the build-sans-secret paths are unit-testable.
 *
 * Only the PUBLIC config is read here: `VITE_SUPABASE_URL` + the `anon` key. These
 * are safe to inline in the bundle — the RLS (`grocery_all`, household-scoped)
 * bounds what the anon key can do. The `service_role` key is NEVER referenced
 * anywhere in the client. The kitchen account's password is NOT build-time config
 * (a `VITE_…` var would be bundled): it is a one-time setup login; only the
 * persisted session lives at runtime (AD-13). See `docs/nutriclaude.md`.
 */

export interface NutriConfig {
  /** Supabase project URL. Empty ⇒ not connectable. */
  supabaseUrl: string;
  /** Supabase `anon` public key. Empty ⇒ not connectable. */
  supabaseAnonKey: string;
  /** True when a connection can be attempted (URL + anon key both present). */
  isConfigured: boolean;
}

/**
 * Resolve the NutriClaude config from environment inputs. Pure — no import.meta
 * access — so it is directly testable. `isConfigured` needs BOTH the URL and the
 * anon key; either missing keeps the unconfigured path reachable (the tile renders
 * a graceful degraded state, never blank).
 */
export function resolveNutriConfig(env: {
  url: string | undefined;
  anonKey: string | undefined;
}): NutriConfig {
  const supabaseUrl = env.url ?? "";
  const supabaseAnonKey = env.anonKey ?? "";
  const isConfigured = supabaseUrl.length > 0 && supabaseAnonKey.length > 0;
  return { supabaseUrl, supabaseAnonKey, isConfigured };
}

const resolved = resolveNutriConfig({
  url: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
});

/** Supabase project URL (public config). */
export const supabaseUrl: string = resolved.supabaseUrl;

/** Supabase `anon` public key. Bounded by RLS; never the `service_role` key. */
export const supabaseAnonKey: string = resolved.supabaseAnonKey;

/**
 * True when the config needed to attempt a NutriClaude connection is present.
 * When false (e.g. a build with no secret), the Courses tile renders a degraded
 * state instead of crashing — never blank (NFR4, equivalent of AD-6 off-HA).
 */
export const nutriIsConfigured: boolean = resolved.isConfigured;
