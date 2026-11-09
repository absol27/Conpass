import { useEffect, useMemo, useState } from 'react'
import { locations } from './data/saltpalace/locations'
import { saltPalace } from './data/saltpalace/venue'
import { sessions } from './data/schedule'
import { Editor, loadDraft, clearDraft } from './editor/Editor'
import { onePerSlot, timeSlots, withAddedTalks } from './plan/slotSchedule'
import { dayKey, fmtDay } from './plan/time'
import { computeTransitions } from './plan/transitions'
import { Router, type RouteResult } from './routing/router'
import { DEFAULT_SETTINGS, type RouteSettings } from './routing/settings'
import { DayTimeline } from './ui/DayTimeline'
import { Directions } from './ui/Directions'
import { DistanceMatrix } from './ui/DistanceMatrix'
import { MapView } from './ui/MapView'
import { SettingsSheet } from './ui/SettingsSheet'
import { DEFAULT_DISPLAY, usePersistentState, type DisplayPrefs } from './ui/storage'

type Tab = 'day' | 'map' | 'distances'
const DAY = dayKey(sessions[0].start)
const SLOTS = timeSlots(sessions, locations)
const SLOT_SIZE = new Map(SLOTS.flatMap((s) => s.options.map((o) => [o.id, s.options.length] as const)))
// Talks outside the slot grid that you said you want to attend (show-floor theater sessions).
const ADDED_TALKS = [
  '1334849', // 11:15–11:35 The Healthy Cluster, The Unhealthy VM · Cosmic Canyon Zone, Hall 5
  '1362623', // 11:25–11:45 Demo Theater: Agent Sandbox on EKS · Demo Theater, Hall 1
]

function useHashRoute() {
  const [hash, setHash] = useState(() => location.hash)
  useEffect(() => {
    const on = () => setHash(location.hash)
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return hash
}

export default function App() {
  const hash = useHashRoute()
  if (hash === '#/editor') return <Editor base={saltPalace} />
  return <Planner />
}

function Planner() {
  const [draft, setDraft] = useState(() => loadDraft())
  const venue = draft ?? saltPalace
  const router = useMemo(() => new Router(venue, locations), [venue])

  const [settings, setSettings] = usePersistentState<RouteSettings>('hallway.settings.v2', DEFAULT_SETTINGS)
  const [display, setDisplay] = usePersistentState<DisplayPrefs>('hallway.display', DEFAULT_DISPLAY)
  const [seed, setSeed] = useState(7)
  const [selected, setSelected] = useState<number | null>(null)
  // A free route picked from the map selects or the distance table.
  const [free, setFree] = useState<{ from: string; to: string } | null>(null)
  const [tab, setTab] = useState<Tab>('day')
  const [rightView, setRightView] = useState<'map' | 'distances'>('map')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showPois, setShowPois] = useState(true)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('large-text', display.largeText)
    root.classList.toggle('high-contrast', display.highContrast)
    if (display.highContrast) root.dataset.theme = 'light'
    else delete root.dataset.theme
  }, [display])

  const plan = useMemo(() => withAddedTalks(onePerSlot(SLOTS, seed), sessions, ADDED_TALKS), [seed])
  const transitions = useMemo(() => computeTransitions(router, plan, settings), [router, plan, settings])

  // Open on the most interesting hop so the map isn't empty.
  useEffect(() => {
    const rank = { overlap: 0, late: 1, tight: 2, comfortable: 3 } as Record<string, number>
    let best: number | null = null
    transitions.forEach((t, i) => {
      if (t.result.kind !== 'ok') return
      if (best === null || (rank[t.status] ?? 9) < (rank[transitions[best].status] ?? 9)) best = i
    })
    setSelected(best)
    setFree(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan])

  const hop = selected !== null && !free ? transitions[selected] : null
  const result: RouteResult | null = useMemo(
    () => (free ? router.route(free.from, free.to, settings) : (hop?.result ?? null)),
    [free, hop, router, settings],
  )
  const route = result?.kind === 'ok' ? result.route : null
  const restroom = useMemo(
    () => (result?.kind === 'ok' && (free || hop) ? router.restroomDetour(free?.from ?? hop!.from.location, free?.to ?? hop!.to.location, settings) : null),
    [result, free, hop, router, settings],
  )
  const fromLoc = free?.from ?? hop?.from.location ?? ''
  const toLoc = free?.to ?? hop?.to.location ?? ''
  const onsite = router.onsiteLocations()

  const pickHop = (i: number) => {
    setFree(null)
    setSelected(i)
    setTab('map')
    setRightView('map')
  }
  const pickPair = (from: string, to: string) => {
    setFree({ from, to })
    setTab('map')
    setRightView('map')
  }

  const mapPane = (
    <>
      <div className="map-wrap">
        <MapView venue={venue} route={route} showPois={showPois} />
        <div className="map-overlay">
          <label className="sr-only" htmlFor="from">
            From
          </label>
          <select id="from" value={fromLoc} onChange={(e) => pickPair(e.target.value, toLoc || onsite[1])}>
            <option value="" disabled>
              From…
            </option>
            {onsite.map((l) => (
              <option key={l} value={l}>
                {router.label(l)}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="to">
            To
          </label>
          <select id="to" value={toLoc} onChange={(e) => pickPair(fromLoc || onsite[0], e.target.value)}>
            <option value="" disabled>
              To…
            </option>
            {onsite.map((l) => (
              <option key={l} value={l}>
                {router.label(l)}
              </option>
            ))}
          </select>
        </div>
        <div className="legend" aria-hidden="true">
          <span>
            <i style={{ background: '#0f8a74' }} />
            Level 1
          </span>
          <span>
            <i style={{ background: '#3157d5' }} />
            Level 2
          </span>
          <span>
            <i style={{ background: '#8a3fd1' }} />
            Level 3
          </span>
          <span>
            <i style={{ background: '#d26a00' }} />
            Hyatt
          </span>
          <span>┄ level change / estimated</span>
          {showPois && <span>⇅ elevator · ⇗ escalator · ⌇ stairs · ⚧ all-gender · ♂ ♀ WC restrooms</span>}
        </div>
      </div>
      <div className="directions" aria-live="polite">
        <Directions venue={venue} result={result} transition={hop} settings={settings} restroom={restroom} />
      </div>
    </>
  )

  return (
    <div className="app" data-tab={tab}>
      <header className="topbar">
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" />
          <span>
            Hallway <small>· KubeCon NA 2026 @ Salt Palace</small>
          </span>
        </div>
        <button className="btn" onClick={() => setSettingsOpen(true)}>
          <span aria-hidden="true">🚶</span> {settings.speed} m/s{settings.stepFree ? ' · step-free' : ''}
        </button>
      </header>

      <div className="toolbar" role="toolbar" aria-label="Day and sample schedule">
        <span className="chip" aria-pressed="true">
          {fmtDay(DAY)}
        </span>
        <span className="spacer" />
        <button className="btn" onClick={() => setSeed((s) => s + 1)} title="Re-pick a random talk in every time slot">
          <span aria-hidden="true">🔀</span> Shuffle talks
        </button>
        <label className="chip" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={showPois} onChange={(e) => setShowPois(e.target.checked)} /> Amenities
        </label>
        <button className="btn ghost" onClick={() => setRightView(rightView === 'map' ? 'distances' : 'map')} aria-pressed={rightView === 'distances'}>
          {rightView === 'map' ? 'Room distances' : 'Back to map'}
        </button>
      </div>

      <nav className="tabs" role="tablist" aria-label="View">
        {(['day', 'map', 'distances'] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => {
              setTab(t)
              if (t !== 'day') setRightView(t)
            }}
          >
            {t === 'day' ? 'My day' : t === 'map' ? 'Map' : 'Distances'}
          </button>
        ))}
      </nav>

      <main className="main">
        <section className="pane left" aria-label="Your schedule">
          {draft && (
            <p className="notice info">
              Using a venue draft from the editor.{' '}
              <button
                className="btn"
                onClick={() => {
                  clearDraft()
                  setDraft(null)
                }}
              >
                Discard draft
              </button>
            </p>
          )}
          <p className="notice info" style={{ marginTop: 0 }}>
            Your plan: one talk in each of {fmtDay(DAY)}’s {SLOTS.length} time slots, picked at random from the official KubeCon schedule,
            plus the {ADDED_TALKS.length} talks you added. Shuffle re-picks the slot talks and keeps yours.
          </p>
          <DayTimeline plan={plan} slotSize={SLOT_SIZE} added={ADDED_TALKS} transitions={transitions} router={router} selected={free ? null : selected} onSelect={pickHop} />
        </section>
        <section className="pane right" aria-label={rightView === 'map' ? 'Map and directions' : 'Room distances'}>
          {rightView === 'map' ? mapPane : <DistanceMatrix router={router} settings={settings} onPick={pickPair} />}
        </section>
      </main>

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={setSettings}
        display={display}
        onDisplay={setDisplay}
      />
    </div>
  )
}
