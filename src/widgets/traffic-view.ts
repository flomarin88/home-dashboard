import { formatSince } from "../hakit/stale";

/**
 * Travel-time display derivation (Story 11.1, AD-18). PURE — no HA access, no
 * clock: the caller passes the timestamp of the request that settled, so the
 * module is testable without fake timers (lesson 9.2, restated by 10.1).
 *
 * The four states are the story, not a rendering detail:
 *  - `idle`        never refreshed in this session → NO duration at all
 *  - `pending`     a tap is in flight, waiting on the ≥10 s guard
 *  - `fresh`       a refresh settled → duration + the time it was asked for
 *  - `unavailable` the call was rejected, the entity is stale, or its state
 *                  cannot be read as a number
 *
 * `idle` is a deliberate, BOUNDED exception to UX-DR10/NFR4 ("always the last
 * known value"). It is not a blank — it is a rendered call to action — and it
 * only applies to a DURATION, whose staleness is invisible: "34 min" from
 * yesterday looks exactly like "34 min" from a minute ago. Everywhere else in
 * the kiosk the last known value is still the right answer.
 */

export type TrafficKind = "idle" | "pending" | "fresh" | "unavailable";

export interface TrafficInput {
  /** Raw entity state — Waze reports the duration in minutes, as a float. */
  readonly minutes: string | number | null | undefined;
  /** AD-6 obsolescence for the entity (socket lost / unavailable / unknown). */
  readonly isStale: boolean;
  /** A refresh is in flight (tap sent, guard not yet elapsed). */
  readonly pending: boolean;
  /** The last refresh call was REJECTED (HA unreachable, entity refused…). */
  readonly failed: boolean;
  /** Epoch ms of the last refresh that settled, or null if none this session. */
  readonly requestedAt: number | null;
}

export interface TrafficView {
  readonly kind: TrafficKind;
  /** Hero line. Never empty, never a number outside `fresh`. */
  readonly hero: string;
  /** Sub line. Never empty — an empty line collapses the block under `truncate`. */
  readonly sub: string;
  /** Full accessible name for the button. */
  readonly aria: string;
}

/** Placeholder hero — a dash, never a stale duration (AD-18b). */
const DASH = "—";
const SUBJECT = "Temps de trajet";
const INVITE = "toucher pour actualiser";
const RETRY = "toucher pour réessayer";

/** Parse a raw HA state into a finite number of minutes, else null. */
export function toMinutes(
  v: string | number | null | undefined,
): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function unavailable(sub: string, spoken: string): TrafficView {
  return {
    kind: "unavailable",
    hero: DASH,
    sub,
    aria: `${SUBJECT} : ${spoken} — ${RETRY}`,
  };
}

export function trafficView(input: TrafficInput): TrafficView {
  // A tap in flight wins over everything it could otherwise display: the guard
  // delay is ≥10 s, so a chip that kept showing the old answer would read as
  // "your tap did nothing".
  if (input.pending) {
    return {
      kind: "pending",
      hero: DASH,
      sub: "Relevé en cours…",
      aria: `${SUBJECT} : relevé en cours`,
    };
  }

  if (input.failed) {
    return unavailable("Échec du relevé", "échec du relevé");
  }

  if (input.isStale) {
    return unavailable("Indisponible", "indisponible");
  }

  // Never refreshed in this session — the value HA is pushing may well be
  // readable, and we still refuse to render it as a duration (AD-18b).
  if (input.requestedAt === null) {
    return {
      kind: "idle",
      hero: DASH,
      sub: "Toucher pour actualiser",
      aria: `${SUBJECT} : non relevé — ${INVITE}`,
    };
  }

  const minutes = toMinutes(input.minutes);
  if (minutes === null) {
    // HA answered and the entity is live, but its state is not a number. Kept
    // distinct from "indisponible": a format drift must not disguise itself as
    // an outage (lesson `unreadable`, Story 10.1).
    return unavailable("Valeur illisible", "valeur illisible");
  }

  const rounded = Math.round(minutes);
  const at = formatSince(input.requestedAt);
  return {
    kind: "fresh",
    hero: `${rounded} min`,
    sub: `relevé à ${at}`,
    aria: `${SUBJECT} : ${rounded} minutes, relevé à ${at} — ${INVITE}`,
  };
}
