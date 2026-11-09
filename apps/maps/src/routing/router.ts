import type { LocationIndex, RestroomType, Venue } from '../venue/types'
import { shortestRoute, type Route } from './dijkstra'
import { directions, type Direction } from './directions'
import { buildGraph, type Graph } from './graph'
import type { RestroomPref, RouteSettings } from './settings'

export type RouteResult =
  | { kind: 'ok'; route: Route; steps: Direction[]; fromLabel: string; toLabel: string }
  | { kind: 'same'; label: string }
  | { kind: 'offsite' }
  | { kind: 'unreachable'; fromLabel: string; toLabel: string }
  | { kind: 'unknown'; location: string }

export interface Detour {
  nodeId: string
  label: string
  level: string
  /** Extra seconds compared with the direct route. */
  extraSec: number
}

/** Restroom types each preference accepts. Single-gender rooms only match that gender. */
const RESTROOM_OK: Record<RestroomPref, ReadonlyArray<RestroomType>> = {
  any: ['both', 'all-gender'],
  'all-gender': ['all-gender'],
  women: ['both', 'all-gender', 'women'],
  men: ['both', 'all-gender', 'men'],
}

export class Router {
  private graphs = new Map<string, Graph>()
  readonly venue: Venue
  readonly locations: LocationIndex
  constructor(venue: Venue, locations: LocationIndex) {
    this.venue = venue
    this.locations = locations
  }

  graph(settings: RouteSettings): Graph {
    const key = JSON.stringify(settings)
    let g = this.graphs.get(key)
    if (!g) {
      g = buildGraph(this.venue, settings)
      this.graphs.set(key, g)
    }
    return g
  }

  label(location: string): string {
    return this.locations[location]?.label ?? location
  }

  route(from: string, to: string, settings: RouteSettings): RouteResult {
    const a = this.locations[from]
    const b = this.locations[to]
    if (!a) return { kind: 'unknown', location: from }
    if (!b) return { kind: 'unknown', location: to }
    if ('offsite' in a || 'offsite' in b) return { kind: 'offsite' }
    if (from === to) return { kind: 'same', label: a.label }
    const g = this.graph(settings)
    const route = shortestRoute(g, a.nodes, b.nodes)
    if (!route) return { kind: 'unreachable', fromLabel: a.label, toLabel: b.label }
    return { kind: 'ok', route, steps: directions(g, route, a.label, b.label), fromLabel: a.label, toLabel: b.label }
  }

  /** Cheapest restroom stop between two locations, as extra time over the direct route. */
  restroomDetour(from: string, to: string, settings: RouteSettings): Detour | null {
    const a = this.locations[from]
    const b = this.locations[to]
    if (!a || !b || 'offsite' in a || 'offsite' in b) return null
    const g = this.graph(settings)
    const direct = shortestRoute(g, a.nodes, b.nodes)
    if (!direct) return null
    let best: Detour | null = null
    for (const n of this.venue.nodes) {
      if (n.poi !== 'restroom' || !RESTROOM_OK[settings.restroomPref].includes(n.restroom ?? 'both')) continue
      const there = shortestRoute(g, a.nodes, [n.id])
      const back = there && shortestRoute(g, [n.id], b.nodes)
      if (!there || !back) continue
      const extraSec = there.seconds + back.seconds - direct.seconds
      if (!best || extraSec < best.extraSec) best = { nodeId: n.id, label: n.label ?? 'Restrooms', level: n.level, extraSec }
    }
    return best
  }

  /** Routable (on-site) location strings, in index order. */
  onsiteLocations(): string[] {
    return Object.entries(this.locations)
      .filter(([, v]) => !('offsite' in v))
      .map(([k]) => k)
  }
}
