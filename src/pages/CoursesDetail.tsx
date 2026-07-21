import { useNavigate } from "react-router-dom";

/**
 * CoursesDetail — STUB (Story 8.1). The tile taps through here so the kiosk never
 * lands on a blank/404 screen. The real page — Articles grouped by aisle, the
 * "Vider le panier" action, pointing — is Story 8.2 (FR-2) and 8.3/8.4.
 */
export function CoursesDetail() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-grid-gap">
      <button
        type="button"
        onClick={() => navigate("/")}
        className="inline-flex min-h-[44px] w-fit items-center gap-1 text-label font-semibold text-text-muted"
      >
        ‹ Accueil · Liste de courses
      </button>
      <p className="text-meta text-text-muted">
        La liste détaillée par rayon arrive bientôt (Story 8.2).
      </p>
    </div>
  );
}
