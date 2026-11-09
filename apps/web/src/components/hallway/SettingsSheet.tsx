import { useEffect, useRef } from 'react'
import { DEFAULT_SETTINGS, mps, SPEED_MAX, SPEED_MIN, SPEED_PRESETS, type RestroomPref, type RouteSettings } from './types'

type NumKey = 'escalatorSecPerLevel' | 'stairsSecPerLevel' | 'elevatorWaitSec' | 'elevatorSecPerLevel' | 'bufferMin'
const ASSUMPTIONS: { key: NumKey; label: string; why: string; unit: string; step: number }[] = [
  { key: 'escalatorSecPerLevel', label: 'Escalator, per level', why: 'Ride plus a short queue at break time', unit: 's', step: 5 },
  { key: 'stairsSecPerLevel', label: 'Stairs, per level', why: 'A full convention floor is ~30 steps; slower than riding', unit: 's', step: 5 },
  { key: 'elevatorWaitSec', label: 'Elevator wait', why: 'Convention elevators are shared with carts and crowds', unit: 's', step: 10 },
  { key: 'elevatorSecPerLevel', label: 'Elevator ride, per level', why: 'Doors plus travel', unit: 's', step: 5 },
  { key: 'bufferMin', label: 'Door to seat', why: 'Getting in, finding a seat', unit: 'min', step: 1 },
]

const TOGGLES: { key: 'stepFree' | 'avoidEscalators' | 'avoidShowFloor' | 'fewestLevelChanges'; label: string; help: string }[] = [
  { key: 'stepFree', label: 'Step-free route', help: 'Elevators only, never stairs or escalators. For wheelchairs, scooters and walkers.' },
  { key: 'avoidEscalators', label: 'Avoid escalators', help: 'For anyone uneasy on escalators; uses stairs or elevators instead. With a stroller or rolling bag, choose Step-free.' },
  { key: 'avoidShowFloor', label: 'Avoid the show floor (low-sensory)', help: 'Routes around the exhibit halls (busy, loud) through the concourses, even if a bit longer.' },
  { key: 'fewestLevelChanges', label: 'Fewest level changes', help: 'Stays on one floor where it can, at the cost of extra walking.' },
]

export function SettingsSheet({
  open,
  onClose,
  settings,
  onChange,
}: {
  open: boolean
  onClose: () => void
  settings: RouteSettings
  onChange: (s: RouteSettings) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current!
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  const set = <K extends keyof RouteSettings>(k: K, v: RouteSettings[K]) => onChange({ ...settings, [k]: v })
  const sp = settings.speed

  return (
    <dialog ref={ref} className="sheet" onClose={onClose} aria-labelledby="settings-title">
      <header>
        <h2 id="settings-title">Walking &amp; accessibility</h2>
        <button className="btn ghost" onClick={onClose} aria-label="Close settings">
          ✕
        </button>
      </header>

      <section>
        <h3>Walking speed</h3>
        <div className="seg" role="group" aria-label="Speed presets">
          {SPEED_PRESETS.map((p) => (
            <button key={p.id} className="chip" aria-pressed={Math.abs(sp - p.speed) < 0.001} onClick={() => set('speed', p.speed)}>
              {p.label} · {p.speed} m/s
            </button>
          ))}
        </div>
        <label htmlFor="speed" className="sr-only">
          Walking speed in metres per second
        </label>
        <input
          id="speed"
          type="range"
          min={SPEED_MIN}
          max={SPEED_MAX}
          step={0.05}
          value={sp}
          onChange={(e) => set('speed', Number(e.target.value))}
          aria-valuetext={`${sp.toFixed(2)} metres per second, ${mps.toMph(sp).toFixed(1)} miles per hour`}
        />
        <p className="speed-readout">
          {sp.toFixed(2)} m/s · {mps.toMph(sp).toFixed(1)} mph · {mps.toKmh(sp).toFixed(1)} km/h · {Math.round(mps.secPer100m(sp))} s per 100 m
        </p>
        <p>
          <strong>Our default is 1.2 m/s (about 2.7 mph).</strong> Most adults walk 1.3–1.4 m/s when nothing is in the way. We assume a
          little slower because convention hallways are full of people and badge-scanning. US crosswalk timing uses 1.07 m/s (3.5 ft/s)
          so slower walkers can cross. If you use a cane, walker or chair, or just like to stroll, pick a slower preset.
        </p>
      </section>

      <section>
        <h3>Accessibility</h3>
        {TOGGLES.map((t) => (
          <label key={t.key} className="toggle">
            <input type="checkbox" checked={settings[t.key]} onChange={(e) => set(t.key, e.target.checked)} />
            <span>{t.label}</span>
            <small>{t.help}</small>
          </label>
        ))}
        <h3 style={{ marginTop: 12 }}>Restroom on the way</h3>
        <div className="seg" role="group" aria-label="Restrooms to suggest">
          {(
            [
              ['any', 'Any'],
              ['all-gender', 'All-gender only'],
              ['women', 'Include women’s'],
              ['men', 'Include men’s'],
            ] as [RestroomPref, string][]
          ).map(([v, label]) => (
            <button key={v} className="chip" aria-pressed={settings.restroomPref === v} onClick={() => set('restroomPref', v)}>
              {label}
            </button>
          ))}
        </div>
        <p>
          Restrooms (all-gender ⚧, men’s ♂, women’s ♀), mother’s rooms, first aid, info desks, elevators, escalators and stairs are
          shown on the map. Every route also comes as text directions that screen readers can
          read, and route status is always given as an icon plus words, never colour alone.
        </p>
      </section>

      <section>
        <h3>How we estimate</h3>
        <p>
          Walk time = distance along corridors ÷ your speed, plus the fixed times below for each level change. Distances come from the
          official Salt Palace floor plan, scaled using Exhibit Hall A’s published 48,600 sq ft. Hyatt Regency interiors are estimated
          and marked ≈. You can change any of these.
        </p>
        <div className="assumptions">
          {ASSUMPTIONS.map((a) => (
            <FragmentRow key={a.key} a={a} value={settings[a.key]} onChange={(v) => set(a.key, v)} />
          ))}
        </div>
        <p style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => onChange(DEFAULT_SETTINGS)}>
            Reset everything to defaults
          </button>
        </p>
      </section>
    </dialog>
  )
}

function FragmentRow({ a, value, onChange }: { a: (typeof ASSUMPTIONS)[number]; value: number; onChange: (v: number) => void }) {
  const id = `as-${a.key}`
  return (
    <>
      <label htmlFor={id}>
        {a.label} <small>{a.why}</small>
      </label>
      <span>
        <input id={id} type="number" min={0} step={a.step} value={value} onChange={(e) => onChange(Math.max(0, Number(e.target.value)))} />{' '}
        {a.unit}
      </span>
    </>
  )
}
