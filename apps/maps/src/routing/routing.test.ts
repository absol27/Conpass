import { describe, expect, it } from 'vitest'
import type { Venue } from '../venue/types'
import { shortestRoute } from './dijkstra'
import { directions } from './directions'
import { buildGraph } from './graph'
import { Router } from './router'
import { DEFAULT_SETTINGS, type RouteSettings } from './settings'

// Two floors. Ground: A --100m-- B --(concourse 100m)-- C. Escalator and elevator from B up to D on floor 2,
// D --50m-- E. metersPerUnit = 1 so units are metres.
const fixture: Venue = {
  id: 'fx',
  name: 'Fixture',
  metersPerUnit: 1,
  mapBounds: [[0, 0], [100, 100]],
  mapImage: '',
  levels: [
    { id: 'L1', building: 'Main', name: 'Level 1', floor: 1 },
    { id: 'L2', building: 'Main', name: 'Level 2', floor: 2 },
  ],
  nodes: [
    { id: 'A', level: 'L1', x: 0, y: 0, kind: 'door', label: 'Room A' },
    { id: 'B', level: 'L1', x: 100, y: 0, kind: 'junction' },
    { id: 'C', level: 'L1', x: 100, y: 100, kind: 'door', label: 'Room C' },
    { id: 'Besc', level: 'L1', x: 100, y: 0, kind: 'escalator' },
    { id: 'Bel', level: 'L1', x: 100, y: 0, kind: 'elevator', verified: false },
    { id: 'Desc', level: 'L2', x: 100, y: 0, kind: 'escalator' },
    { id: 'Del', level: 'L2', x: 100, y: 0, kind: 'elevator', verified: false },
    { id: 'D', level: 'L2', x: 100, y: 0, kind: 'junction' },
    { id: 'E', level: 'L2', x: 150, y: 0, kind: 'door', label: 'Room E' },
  ],
  edges: [
    { a: 'A', b: 'B', kind: 'walk', name: 'Hall' },
    { a: 'B', b: 'C', kind: 'walk', name: 'Show floor', zone: 'expo' },
    { a: 'B', b: 'Besc', kind: 'walk' },
    { a: 'B', b: 'Bel', kind: 'walk' },
    { a: 'Besc', b: 'Desc', kind: 'escalator' },
    { a: 'Bel', b: 'Del', kind: 'elevator' },
    { a: 'Desc', b: 'D', kind: 'walk' },
    { a: 'Del', b: 'D', kind: 'walk' },
    { a: 'D', b: 'E', kind: 'walk', name: 'Mezzanine' },
  ],
}

const ctx = (s: Partial<RouteSettings> = {}): RouteSettings => ({ ...DEFAULT_SETTINGS, ...s })

describe('routing', () => {
  it('walks at the configured speed', () => {
    const r = shortestRoute(buildGraph(fixture, ctx()), ['A'], ['C'])!
    expect(r.meters).toBeCloseTo(200)
    expect(r.seconds).toBeCloseTo(200 / 1.2)
    expect(shortestRoute(buildGraph(fixture, ctx({ speed: 0.8 })), ['A'], ['C'])!.seconds).toBeCloseTo(250)
  })

  it('takes the escalator by default and charges per level', () => {
    const r = shortestRoute(buildGraph(fixture, ctx()), ['A'], ['E'])!
    expect(r.steps.map((s) => s.arc.edge.kind)).toContain('escalator')
    expect(r.seconds).toBeCloseTo(150 / 1.2 + 30)
    expect(r.unverifiedElevator).toBe(false)
  })

  it('step-free routing never uses escalators or stairs', () => {
    const r = shortestRoute(buildGraph(fixture, ctx({ stepFree: true })), ['A'], ['E'])!
    const kinds = r.steps.map((s) => s.arc.edge.kind)
    expect(kinds).not.toContain('escalator')
    expect(kinds).not.toContain('stairs')
    expect(kinds).toContain('elevator')
    expect(r.seconds).toBeCloseTo(150 / 1.2 + 90 + 15)
    expect(r.unverifiedElevator).toBe(true)
  })

  it('returns null when the accessibility filter leaves no path', () => {
    const noElevator: Venue = { ...fixture, edges: fixture.edges.filter((e) => e.kind !== 'elevator') }
    expect(shortestRoute(buildGraph(noElevator, ctx({ stepFree: true })), ['A'], ['E'])).toBeNull()
  })

  it('avoid-show-floor raises routing cost but never the reported time', () => {
    const g = buildGraph(fixture, ctx({ avoidShowFloor: true }))
    const arc = g.adj.get('B')!.find((a) => a.to === 'C')!
    expect(arc.cost).toBeCloseTo(arc.seconds * 3)
    expect(shortestRoute(g, ['A'], ['C'])!.seconds).toBeCloseTo(200 / 1.2)
  })

  it('picks the nearest of several doors', () => {
    const r = shortestRoute(buildGraph(fixture, ctx()), ['A'], ['C', 'B'])!
    expect(r.nodes.at(-1)).toBe('B')
  })

  it('writes readable directions', () => {
    const g = buildGraph(fixture, ctx())
    const r = shortestRoute(g, ['A'], ['E'])!
    const text = directions(g, r, 'Room A', 'Room E').map((d) => d.text)
    expect(text[0]).toBe('Leave Room A')
    expect(text).toContain('Take the escalator up to Level 2')
    expect(text.at(-1)).toBe('Arrive at Room E')
    expect(text.some((t) => /Walk 100 m along Hall/.test(t))).toBe(true)
  })

  it('router resolves location strings, offsite and same-room', () => {
    const router = new Router(fixture, {
      a: { nodes: ['A'], label: 'Room A' },
      e: { nodes: ['E'], label: 'Room E' },
      off: { offsite: true, label: 'Off-site' },
    })
    expect(router.route('a', 'e', DEFAULT_SETTINGS).kind).toBe('ok')
    expect(router.route('a', 'a', DEFAULT_SETTINGS).kind).toBe('same')
    expect(router.route('a', 'off', DEFAULT_SETTINGS).kind).toBe('offsite')
    expect(router.route('a', 'nope', DEFAULT_SETTINGS).kind).toBe('unknown')
  })
})
