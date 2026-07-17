/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** HA base URL from gitignored `.env.local` (dev). Absent in prod — the
   *  same-origin build falls back to `location.origin` (AD-8). */
  readonly VITE_HA_URL?: string;
  /** HA long-lived access token, injected from `.env.local`. Never bundled. */
  readonly VITE_HA_TOKEN?: string;
  /** Optional entity_id to show live in the connection view (else auto-picked). */
  readonly VITE_HA_WITNESS_ENTITY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
