import type { Level, Venue, VenueEdge, VenueNode } from '../venue/types'
import type { RouteSettings } from './settings'

export interface Arc {
  to: string
  edge: VenueEdge
  /** Honest time estimate for traversing this arc, in seconds. */
  seconds: number
  /** What the router minimises: seconds plus preference penalties. */
  cost: number
  meters: number
}

export interface Graph {
  venue: Venue
  nodes: Map<string, VenueNode>
  levels: Map<string, Level>
  adj: Map<string, Arc[]>
}

const SHOW_FLOOR_PENALTY = 3
const LEVEL_CHANGE_PENALTY_SEC = 120

export function edgeMeters(venue: Venue, a: VenueNode, b: VenueNode): number {
  if (a.level !== b.level) return 0
  return Math.hypot(a.x - b.x, a.y - b.y) * venue.metersPerUnit
}

export function edgeAllowed(edge: VenueEdge, s: RouteSettings): boolean {
  if (s.stepFree && (edge.kind === 'escalator' || edge.kind === 'stairs')) return false
  if (s.avoidEscalators && edge.kind === 'escalator') return false
  return true
}

export function arcTime(edge: VenueEdge, meters: number, floors: number, s: RouteSettings): { seconds: number; cost: number } {
  let seconds: number
  switch (edge.kind) {
    case 'escalator':
      seconds = s.escalatorSecPerLevel * floors
      break
    case 'stairs':
      seconds = s.stairsSecPerLevel * floors
      break
    case 'elevator':
      seconds = s.elevatorWaitSec + s.elevatorSecPerLevel * floors
      break
    default:
      seconds = meters / s.speed
  }
  let cost = seconds
  if (s.avoidShowFloor && edge.zone === 'expo') cost *= SHOW_FLOOR_PENALTY
  if (s.fewestLevelChanges && floors > 0) cost += LEVEL_CHANGE_PENALTY_SEC
  return { seconds, cost }
}

export function buildGraph(venue: Venue, settings: RouteSettings): Graph {
  const nodes = new Map(venue.nodes.map((n) => [n.id, n]))
  const levels = new Map(venue.levels.map((l) => [l.id, l]))
  const adj = new Map<string, Arc[]>(venue.nodes.map((n) => [n.id, []]))
  for (const edge of venue.edges) {
    const a = nodes.get(edge.a)
    const b = nodes.get(edge.b)
    if (!a || !b) throw new Error(`edge ${edge.a}-${edge.b} references a missing node`)
    if (!edgeAllowed(edge, settings)) continue
    const meters = edgeMeters(venue, a, b)
    const floors = Math.abs(levels.get(a.level)!.floor - levels.get(b.level)!.floor)
    const { seconds, cost } = arcTime(edge, meters, floors, settings)
    adj.get(a.id)!.push({ to: b.id, edge, seconds, cost, meters })
    adj.get(b.id)!.push({ to: a.id, edge, seconds, cost, meters })
  }
  return { venue, nodes, levels, adj }
}
