import { SectionCard } from './SectionCard'
import { DeviceTile } from './DeviceTile'
import type { DeviceDomain } from './DeviceTile'

/**
 * Throwaway styleguide (Story 1.2, AC5) — the visual proof surface for the
 * Glass Gradient tokens and primitives. Renders the ground, a SectionCard, and
 * DeviceTile in all four states across domains, plus a tabular-nums sample.
 * Replaced by the real kiosk shell in Story 1.3.
 */

const DOMAINS: { domain: DeviceDomain; label: string; on: string }[] = [
  { domain: 'lights', label: 'Salon', on: 'Allumé' },
  { domain: 'shutters', label: 'Volet cuisine', on: 'Ouvert 72 %' },
  { domain: 'climate', label: 'Clim étage', on: '21 °C' },
  { domain: 'vacuum', label: 'Roborock', on: 'En ménage' },
  { domain: 'security', label: 'Alarme', on: 'Armé' },
]

export function StyleGuide() {
  return (
    <main className="bg-ground min-h-svh w-full p-6 text-text">
      <h1 className="mb-6 text-clock font-semibold tracking-tight tabular-nums">
        Glass Gradient — styleguide
      </h1>

      <div className="grid gap-grid-gap md:grid-cols-2">
        <SectionCard title="Tuiles — états">
          <div className="grid grid-cols-2 gap-tile-gap">
            <DeviceTile domain="lights" label="Salon" value="Éteint" onPress={() => {}} />
            <DeviceTile domain="lights" label="Salon" value="Allumé" state="on" onPress={() => {}} />
            <DeviceTile domain="lights" label="Salon" state="stale" />
            <DeviceTile domain="lights" label="Nathan" value="Allumé" state="on" kid onPress={() => {}} />
          </div>
        </SectionCard>

        <SectionCard title="Accents par domaine (on)">
          <div className="grid grid-cols-2 gap-tile-gap">
            {DOMAINS.map((d) => (
              <DeviceTile
                key={d.domain}
                domain={d.domain}
                label={d.label}
                value={d.on}
                state="on"
                onPress={() => {}}
              />
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Typographie tabular-nums">
          <div className="flex flex-col gap-1">
            <span className="text-numeric-xl font-semibold tracking-tight tabular-nums">
              21.5 °C
            </span>
            <span className="text-numeric-lg font-semibold tabular-nums">
              19.8 °C
            </span>
            <span className="text-meta text-text-muted">CO₂ 620 ppm · 48 %</span>
          </div>
        </SectionCard>
      </div>
    </main>
  )
}
