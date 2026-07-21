import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey, nutriIsConfigured } from "./config";

/**
 * The single NutriClaude connection seam (AD-2 2nd exception, AD-12/AD-13).
 *
 * Every Courses component reaches Supabase exclusively through this client —
 * there are no ad-hoc Supabase calls elsewhere, and this module never imports
 * from `src/hakit/`. The client persists its session (refresh token) in
 * localStorage and auto-refreshes, so the kiosk authenticates once (NFR3-style).
 *
 * `anon` key only — bounded by the household RLS. The `service_role` key is never
 * used. The kitchen account password is NOT bundled: in dev it comes from a
 * gitignored `.env.local` (and `vite.config.ts` blocks it from any prod build);
 * in prod the session is established by a one-time setup login (follow-on story)
 * and then persists. See `docs/nutriclaude.md`.
 */

let client: SupabaseClient | null = null;

/** The Supabase client, or null when NutriClaude is not configured (build sans secret). */
export function getNutriClient(): SupabaseClient | null {
  if (!nutriIsConfigured) return null;
  if (client == null) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}

/**
 * Ensure a session exists. If a session is already persisted (returning kiosk),
 * this is a no-op. In dev, when kitchen credentials are provided via env, sign in
 * once with email+password (the app implements no other auth channel). Returns
 * true when a session is active afterwards.
 *
 * Prod setup (an interactive one-time login screen) is a follow-on story; until
 * then a prod build with no persisted session simply stays in the degraded
 * "Hors ligne" state — never blank.
 */
export async function ensureNutriSession(): Promise<boolean> {
  const c = getNutriClient();
  if (c == null) return false;

  const { data } = await c.auth.getSession();
  if (data.session != null) return true;

  const email = import.meta.env.VITE_NUTRICLAUDE_CUISINE_EMAIL;
  const password = import.meta.env.VITE_NUTRICLAUDE_CUISINE_PASSWORD;
  if (email && password) {
    const { error } = await c.auth.signInWithPassword({ email, password });
    return error == null;
  }
  return false;
}
