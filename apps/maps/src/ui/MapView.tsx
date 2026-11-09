import L from 'leaflet'
import { useEffect, useRef } from 'react'
import type { Route } from '../routing/dijkstra'
import type { Venue, VenueNode } from '../venue/types'
import { levelHex } from './LevelBadge'

// Map units are page pixels with y growing downward; Leaflet's CRS.Simple has y up.
const ll = (x: number, y: number) => L.latLng(-y, x)

/** Map glyph + accessible name for amenities and level connectors. */
export function amenityGlyph(n: VenueNode): { glyph: string; name: string; cls: string } | null {
  if (n.kind === 'elevator') return { glyph: '⇅', name: n.verified ? 'Elevator' : 'Elevator (unverified)', cls: n.verified ? 'lift' : 'lift unverified' }
  if (n.kind === 'escalator') return { glyph: '⇗', name: 'Escalator', cls: 'move' }
  if (n.kind === 'stairs') return { glyph: '⌇', name: 'Stairs', cls: 'move' }
  if (n.kind !== 'poi') return null
  switch (n.poi) {
    case 'restroom': {
      const t = n.restroom ?? 'both'
      return { glyph: t === 'all-gender' ? '⚧' : t === 'men' ? '♂' : t === 'women' ? '♀' : 'WC', name: n.label ?? 'Restroom', cls: 'rr' }
    }
    case 'mothers-room':
      return { glyph: '🍼', name: n.label ?? "Mother's room", cls: 'care' }
    case 'first-aid':
      return { glyph: '+', name: n.label ?? 'First aid', cls: 'aid' }
    case 'info':
      return { glyph: 'i', name: n.label ?? 'Info desk', cls: 'info' }
    default:
      return null
  }
}

function shortLevel(venue: Venue, id: string) {
  const l = venue.levels.find((v) => v.id === id)!
  return l.building === venue.levels[0].building ? `L${l.floor}` : `Hyatt ${l.name === 'Lobby' ? 'Lobby' : `L${l.floor}`}`
}

export function MapView({ venue, route, showPois }: { venue: Venue; route: Route | null; showPois: boolean }) {
  const el = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const routeLayer = useRef<L.LayerGroup | null>(null)
  const poiLayer = useRef<L.LayerGroup | null>(null)
  // Re-fit after the pane resizes (e.g. the directions panel below grows), not just once.
  const fitTo = useRef<L.LatLngBounds | null>(null)

  useEffect(() => {
    const box = ([[y0, x0], [y1, x1]]: [[number, number], [number, number]]) => L.latLngBounds(ll(x0, y1), ll(x1, y0))
    const bounds = box(venue.mapBounds)
    const map = L.map(el.current!, {
      crs: L.CRS.Simple,
      minZoom: -2,
      maxZoom: 2,
      zoomSnap: 0.25,
      maxBounds: bounds.pad(0.3),
      attributionControl: true,
      zoomControl: false,
    })
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    L.imageOverlay(import.meta.env.BASE_URL + venue.mapImage, box(venue.mapImageBounds ?? venue.mapBounds), { alt: `${venue.name} floor plan` }).addTo(map)
    for (const o of venue.overlays ?? []) {
      L.imageOverlay(import.meta.env.BASE_URL + o.image, box(o.bounds), { alt: o.label }).addTo(map)
      L.marker(ll(o.bounds[0][1], o.bounds[0][0] - 4), {
        icon: L.divIcon({ className: '', html: `<span class="sheet-label">${o.label}</span>`, iconSize: undefined, iconAnchor: [0, 14] }),
        keyboard: false,
        interactive: false,
      }).addTo(map)
    }
    map.attributionControl.setPrefix(false).addAttribution('Plans © Salt Palace / Visit Salt Lake, © Hyatt')
    fitTo.current = box(venue.mapImageBounds ?? venue.mapBounds)
    map.fitBounds(fitTo.current)
    routeLayer.current = L.layerGroup().addTo(map)
    poiLayer.current = L.layerGroup().addTo(map)
    mapRef.current = map
    const ro = new ResizeObserver(() => {
      map.invalidateSize({ pan: false })
      if (fitTo.current) map.fitBounds(fitTo.current, { maxZoom: 1, animate: false })
    })
    ro.observe(el.current!)
    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, [venue])

  useEffect(() => {
    const layer = poiLayer.current
    if (!layer) return
    layer.clearLayers()
    if (!showPois) return
    for (const n of venue.nodes) {
      const a = amenityGlyph(n)
      if (!a) continue
      L.marker(ll(n.x, n.y), {
        icon: L.divIcon({ className: '', html: `<span class="poi-icon ${a.cls}" aria-hidden="true">${a.glyph}</span>`, iconSize: [18, 18] }),
        title: `${a.name} (${shortLevel(venue, n.level)})`,
        keyboard: false,
      }).addTo(layer)
    }
  }, [venue, showPois])

  useEffect(() => {
    const map = mapRef.current
    const layer = routeLayer.current
    if (!map || !layer) return
    layer.clearLayers()
    if (!route) return
    const byId = new Map(venue.nodes.map((n) => [n.id, n]))
    const pts: L.LatLng[] = []
    let run: VenueNode[] = [byId.get(route.nodes[0])!]
    let runApprox = false
    const flushRun = () => {
      if (run.length > 1) {
        const color = levelHex(run[0].level)
        const line = run.map((n) => ll(n.x, n.y))
        L.polyline(line, { color: '#fff', weight: 9, opacity: 0.9 }).addTo(layer)
        L.polyline(line, { color, weight: 5, dashArray: runApprox ? '8 7' : undefined }).addTo(layer)
        pts.push(...line)
      }
    }
    for (const step of route.steps) {
      const a = byId.get(step.from)!
      const b = byId.get(step.arc.to)!
      if (step.arc.edge.kind === 'walk' && a.level === b.level) {
        run.push(b)
        runApprox ||= !!step.arc.edge.approx
        continue
      }
      flushRun()
      // Level change: the plan draws other levels offset, so show a dotted hop between the two
      // drawn positions of the same physical escalator/elevator and label where you end up.
      if (a.x !== b.x || a.y !== b.y) L.polyline([ll(a.x, a.y), ll(b.x, b.y)], { color: '#555', weight: 2, dashArray: '2 6' }).addTo(layer)
      const kind = step.arc.edge.kind
      const verb = kind === 'connector' ? '→' : kind === 'elevator' ? '⇅' : levelFloor(venue, b.level) > levelFloor(venue, a.level) ? '↑' : '↓'
      L.marker(ll(b.x, b.y), {
        icon: L.divIcon({
          className: '',
          html: `<span class="lvl-pin" style="color:${levelHex(b.level)}">${verb} ${shortLevel(venue, b.level)}</span>`,
          iconSize: undefined,
          iconAnchor: [-6, 10],
        }),
        keyboard: false,
      }).addTo(layer)
      run = [b]
      runApprox = false
    }
    flushRun()
    const start = byId.get(route.nodes[0])!
    const end = byId.get(route.nodes[route.nodes.length - 1])!
    L.circleMarker(ll(start.x, start.y), { radius: 8, color: '#fff', weight: 3, fillColor: '#1c1d1f', fillOpacity: 1 })
      .bindTooltip('Start', { permanent: true, direction: 'left' })
      .addTo(layer)
    L.circleMarker(ll(end.x, end.y), { radius: 9, color: '#fff', weight: 3, fillColor: '#e0392b', fillOpacity: 1 })
      .bindTooltip('Destination', { permanent: true, direction: 'right' })
      .addTo(layer)
    pts.push(ll(start.x, start.y), ll(end.x, end.y))
    fitTo.current = L.latLngBounds(pts).pad(0.2)
    // No animation: Leaflet drops a new view requested while a zoom animation is still running.
    map.fitBounds(fitTo.current, { maxZoom: 1, animate: false })
  }, [venue, route])

  return <div ref={el} className="map" role="img" aria-label={`${venue.name} floor plan with the selected route`} />
}

function levelFloor(venue: Venue, id: string) {
  return venue.levels.find((l) => l.id === id)!.floor
}
