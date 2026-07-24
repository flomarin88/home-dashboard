/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** HA base URL from gitignored `.env.local` (dev). Absent in prod — the
   *  same-origin build falls back to `location.origin` (AD-8). */
  readonly VITE_HA_URL?: string;
  /** HA long-lived access token, injected from `.env.local`. Never bundled. */
  readonly VITE_HA_TOKEN?: string;
  /** Optional entity_id to show live in the connection view (else auto-picked). */
  readonly VITE_HA_WITNESS_ENTITY?: string;
  /** NutriClaude/Supabase project URL — public config (AD-12). */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase `anon` public key — bounded by RLS; never the service_role key. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Kitchen-account email — dev-only setup login (AD-13). */
  readonly VITE_NUTRICLAUDE_CUISINE_EMAIL?: string;
  /** Kitchen-account password — dev-only; never set for a prod build (AD-13). */
  readonly VITE_NUTRICLAUDE_CUISINE_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Short git SHA of the build, injected at build time by vite.config.ts. Shown
 *  discreetly on the home page to track deploys. "dev" outside CI/git. */
declare const __APP_COMMIT__: string;
