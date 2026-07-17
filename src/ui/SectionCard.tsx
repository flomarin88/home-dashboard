import type { ReactNode } from "react";

/**
 * SectionCard — frosted translucent section container (Story 1.2, UX-DR2).
 *
 * A card-fill surface with a hairline border, large radius, backdrop blur and a
 * soft shadow — translucency + blur IS the glass, never an opaque fill. Carries
 * an UPPERCASE, letter-spaced section heading. Pure Tailwind; no @hakit/Emotion.
 */
export function SectionCard({
  title,
  children,
  className = "",
}: {
  title: string;
  /** Optional — a zone can render as an empty titled card until its feature lands. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-card-border bg-card-fill p-4 shadow-card backdrop-blur-glass ${className}`}
    >
      <h2 className="mb-3 text-section-heading font-bold uppercase tracking-[0.08em] text-text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}
