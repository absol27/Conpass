// Minimal venue editor (#/editor). It is how a new venue's floor plan becomes a walkable graph:
//   click empty map      -> add a node of the current kind on the current level
//   click a node         -> select it;  shift-click a second node -> connect them
//   Delete / Backspace   -> remove the selected node and its edges
//   Calibrate            -> click two points, enter the real distance in metres
// Edits save as a draft in this browser (the planner uses the draft until discarded) and
// can be exported as JSON.
import L from 'leaflet'
import { useEffect, useRef, useState } from 'react'
import type { EdgeKind, NodeKind, Venue, VenueNode } from '../venue/types'
import { levelHex } from '../ui/LevelBadge'

const DRAFT_KEY = 'hallway.venue-draft'
export function loadDraft(): Venue | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as Venue) : null
  } catch {
    return null
  }
}
export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* ignore */
  }
}
function saveDraft(v: Venue) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(v))
  } catch {
    /* ignore */
  }
}

const ll = (x: number, y: number) => L.latLng(-y, x)
const NODE_KINDS: NodeKind[] = ['junction', 'door', 'escalator', 'elevator', 'stairs', 'entrance', 'poi']
const EDGE_KINDS: EdgeKind[] = ['walk', 'escalator', 'elevator', 'stairs', 'connector']

export function Editor({ base }: { base: Venue }) {
  const [venue, setVenue] = useState<Venue>(() => loadDraft() ?? base)
  const [level, setLevel] = useState(venue.levels[0].id)
  const [kind, setKind] = useState<NodeKind>('junction')
  const [edgeKind, setEdgeKind] = useState<EdgeKind>('walk')
  const [corridor, setCorridor] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [calib, setCalib] = useState<L.LatLng[] | null>(null)
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const state = useRef({ venue, level, kind, edgeKind, corridor, selected, calib })
  state.current = { venue, level, kind, edgeKind, corridor, selected, calib }

  const update = (v: Venue) => {
    setVenue(v)
    saveDraft(v)
  }

  useEffect(() => {
    const box = ([[y0, x0], [y1, x1]]: [[number, number], [number, number]]) => L.latLngBounds(ll(x0, y1), ll(x1, y0))
    const m = L.map(el.current!, { crs: L.CRS.Simple, minZoom: -2, maxZoom: 3, zoomSnap: 0.25 })
    L.imageOverlay(import.meta.env.BASE_URL + base.mapImage, box(base.mapImageBounds ?? base.mapBounds)).addTo(m)
    for (const o of base.overlays ?? []) L.imageOverlay(import.meta.env.BASE_URL + o.image, box(o.bounds)).addTo(m)
    m.fitBounds(box(base.mapBounds))
    layer.current = L.layerGroup().addTo(m)
    m.on('click', (e: L.LeafletMouseEvent) => {
      const s = state.current
      const x = Math.round(e.latlng.lng)
      const y = Math.round(-e.latlng.lat)
      if (s.calib) {
        const pts = [...s.calib, e.latlng]
        if (pts.length < 2) return setCalib(pts)
        const units = Math.hypot(pts[0].lng - pts[1].lng, pts[0].lat - pts[1].lat)
        const meters = Number(prompt(`That's ${units.toFixed(1)} map units. How many metres apart are those points?`))
        setCalib(null)
        if (meters > 0) update({ ...s.venue, metersPerUnit: meters / units })
        return
      }
      const id = `${s.kind[0]}${Date.now().toString(36)}`
      const node: VenueNode = { id, level: s.level, x, y, kind: s.kind, ...(s.kind === 'elevator' ? { verified: false } : {}) }
      if (s.kind === 'door' || s.kind === 'entrance' || s.kind === 'poi') {
        const label = prompt('Label (e.g. "Room 255 A")') ?? undefined
        if (label) node.label = label
      }
      const edges = s.selected
        ? [...s.venue.edges, { a: s.selected, b: id, kind: 'walk' as const, ...(s.corridor ? { name: s.corridor } : {}) }]
        : s.venue.edges
      update({ ...s.venue, nodes: [...s.venue.nodes, node], edges })
      setSelected(id)
    })
    map.current = m
    const onKey = (e: KeyboardEvent) => {
      const s = state.current
      if ((e.key === 'Delete' || e.key === 'Backspace') && s.selected && !(e.target instanceof HTMLInputElement)) {
        update({
          ...s.venue,
          nodes: s.venue.nodes.filter((n) => n.id !== s.selected),
          edges: s.venue.edges.filter((ed) => ed.a !== s.selected && ed.b !== s.selected),
        })
        setSelected(null)
      }
      if (e.key === 'Escape') setSelected(null)
    }
    addEventListener('keydown', onKey)
    return () => {
      removeEventListener('keydown', onKey)
      m.remove()
    }
  }, [base])

  useEffect(() => {
    const lg = layer.current
    if (!lg) return
    lg.clearLayers()
    const byId = new Map(venue.nodes.map((n) => [n.id, n]))
    for (const ed of venue.edges) {
      const a = byId.get(ed.a)
      const b = byId.get(ed.b)
      if (!a || !b) continue
      const onLevel = a.level === level || b.level === level
      L.polyline([ll(a.x, a.y), ll(b.x, b.y)], {
        color: a.level === b.level ? levelHex(a.level) : '#555',
        weight: onLevel ? 3 : 1,
        opacity: onLevel ? 0.9 : 0.25,
        dashArray: ed.kind !== 'walk' || ed.approx ? '4 5' : undefined,
      })
        .bindTooltip(`${ed.kind}${ed.name ? ` · ${ed.name}` : ''}${ed.zone ? ` · ${ed.zone}` : ''}`)
        .addTo(lg)
    }
    for (const n of venue.nodes) {
      const onLevel = n.level === level
      L.circleMarker(ll(n.x, n.y), {
        radius: n.id === selected ? 7 : n.kind === 'junction' ? 3 : 5,
        color: n.id === selected ? '#e0392b' : levelHex(n.level),
        weight: 2,
        fillColor: n.kind === 'elevator' ? '#ffd166' : '#fff',
        fillOpacity: 1,
        opacity: onLevel ? 1 : 0.3,
      })
        .bindTooltip(`${n.label ?? n.id} · ${n.kind} · ${n.level}`)
        .on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e)
          const s = state.current
          if (e.originalEvent.shiftKey && s.selected && s.selected !== n.id) {
            update({ ...s.venue, edges: [...s.venue.edges, { a: s.selected, b: n.id, kind: s.edgeKind, ...(s.corridor ? { name: s.corridor } : {}) }] })
          }
          setSelected(n.id)
        })
        .addTo(lg)
    }
  }, [venue, level, selected])

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(venue, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${venue.id}-venue.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const sel = venue.nodes.find((n) => n.id === selected)

  return (
    <div className="app" style={{ gridTemplateRows: 'auto 1fr' }}>
      <div className="toolbar" style={{ flexWrap: 'wrap' }}>
        <strong>Venue editor</strong>
        <label>
          Level{' '}
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            {venue.levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.building} · {l.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          New node{' '}
          <select value={kind} onChange={(e) => setKind(e.target.value as NodeKind)}>
            {NODE_KINDS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label>
          Shift-click edge{' '}
          <select value={edgeKind} onChange={(e) => setEdgeKind(e.target.value as EdgeKind)}>
            {EDGE_KINDS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label>
          Corridor name <input value={corridor} onChange={(e) => setCorridor(e.target.value)} placeholder="e.g. Upper Concourse" size={16} />
        </label>
        <button className="btn" onClick={() => setCalib([])} aria-pressed={!!calib}>
          {calib ? `Calibrating: click point ${calib.length + 1} of 2` : `Calibrate (${venue.metersPerUnit.toFixed(3)} m/unit)`}
        </button>
        <span className="spacer" />
        <span style={{ color: 'var(--muted)', fontSize: '0.85em' }}>
          {venue.nodes.length} nodes · {venue.edges.length} edges{sel ? ` · selected ${sel.label ?? sel.id} (${sel.x}, ${sel.y})` : ''}
        </span>
        <button className="btn" onClick={exportJson}>
          Export JSON
        </button>
        <button
          className="btn"
          onClick={() => {
            if (confirm('Throw away the draft and reload the built-in venue?')) {
              clearDraft()
              setVenue(base)
            }
          }}
        >
          Reset
        </button>
        <a className="btn" href="#/">
          Back to planner
        </a>
      </div>
      <div style={{ position: 'relative' }}>
        <div ref={el} className="map" />
      </div>
    </div>
  )
}
