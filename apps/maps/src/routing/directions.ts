import type { Route } from './dijkstra'
import type { Graph } from './graph'

export type StepIcon = 'start' | 'walk' | 'left' | 'right' | 'escalator' | 'stairs' | 'elevator' | 'connector' | 'arrive'
export type Vertical = 'up' | 'down'

export interface Direction {
  icon: StepIcon
  text: string
  seconds: number
  meters: number
  level: string
  /** For escalator/stairs steps. */
  vertical?: Vertical
}

const TURN_DEG = 35
const roundMeters = (m: number) => (m < 20 ? Math.max(5, Math.round(m / 5) * 5) : Math.round(m / 10) * 10)

function levelName(g: Graph, levelId: string) {
  const l = g.levels.get(levelId)!
  // Name the building only when it isn't the venue's main one.
  return l.building === g.venue.levels[0].building ? l.name : `${l.name} (${l.building})`
}

/** Turns a node path into human (and screen-reader) friendly steps. */
export function directions(g: Graph, route: Route, fromLabel: string, toLabel: string): Direction[] {
  const out: Direction[] = []
  const first = g.nodes.get(route.nodes[0])!
  out.push({ icon: 'start', text: `Leave ${fromLabel}`, seconds: 0, meters: 0, level: first.level })

  type Walk = { name?: string; meters: number; seconds: number; level: string; heading: [number, number]; turn?: 'left' | 'right' }
  let walk: Walk | null = null
  const flush = () => {
    if (!walk) return
    const where = walk.name ? ` along ${walk.name}` : ''
    const verb = walk.turn ? `Turn ${walk.turn} and walk` : 'Walk'
    out.push({ icon: walk.turn ?? 'walk', text: `${verb} ${roundMeters(walk.meters)} m${where}`, seconds: walk.seconds, meters: walk.meters, level: walk.level })
    walk = null
  }

  for (const step of route.steps) {
    const a = g.nodes.get(step.from)!
    const b = g.nodes.get(step.arc.to)!
    const { edge } = step.arc
    if (edge.kind === 'walk') {
      const heading: [number, number] = [b.x - a.x, b.y - a.y]
      const cur = walk as Walk | null // flush() reassigns `walk`, which defeats narrowing
      if (cur && (edge.name === undefined || cur.name === undefined || edge.name === cur.name)) {
        cur.name ??= edge.name
        cur.meters += step.arc.meters
        cur.seconds += step.arc.seconds
        // Short unnamed stubs (corridor -> door) shouldn't swallow the turn into the next corridor.
        if (edge.name !== undefined) cur.heading = heading
        continue
      }
      let turn: 'left' | 'right' | undefined
      if (cur) {
        const [x1, y1] = cur.heading
        const angle = (Math.atan2(x1 * heading[1] - y1 * heading[0], x1 * heading[0] + y1 * heading[1]) * 180) / Math.PI
        // map y grows downward, so a positive cross product is a right turn
        if (Math.abs(angle) > TURN_DEG) turn = angle > 0 ? 'right' : 'left'
      }
      flush()
      walk = { name: edge.name, meters: step.arc.meters, seconds: step.arc.seconds, level: a.level, heading, turn }
      continue
    }

    flush()
    const prev = out[out.length - 1]
    if (edge.kind === 'connector') {
      out.push({ icon: 'connector', text: `Cross into the ${g.levels.get(b.level)!.building} via ${edge.name ?? 'the connector'}`, seconds: step.arc.seconds, meters: step.arc.meters, level: b.level })
      continue
    }
    const up = g.levels.get(b.level)!.floor > g.levels.get(a.level)!.floor
    const kind = edge.kind
    // Chained escalators/stairs (one ride per floor) read as a single instruction.
    if (prev && prev.icon === kind && kind !== 'elevator') {
      prev.text = `Take the ${kind} ${up ? 'up' : 'down'} to ${levelName(g, b.level)}`
      prev.seconds += step.arc.seconds
      prev.level = b.level
      continue
    }
    const text =
      kind === 'elevator'
        ? `Take the elevator to ${levelName(g, b.level)}`
        : `Take the ${kind} ${up ? 'up' : 'down'} to ${levelName(g, b.level)}`
    out.push({ icon: kind, text, seconds: step.arc.seconds, meters: 0, level: b.level, vertical: up ? 'up' : 'down' })
  }
  flush()
  const last = g.nodes.get(route.nodes[route.nodes.length - 1])!
  out.push({ icon: 'arrive', text: `Arrive at ${toLabel}`, seconds: 0, meters: 0, level: last.level })
  return out
}
