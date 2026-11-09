import type { Arc, Graph } from './graph'

export interface PathStep {
  from: string
  arc: Arc
}

export interface Route {
  nodes: string[]
  steps: PathStep[]
  seconds: number
  meters: number
  /** Uses at least one edge whose geometry is a guess. */
  approx: boolean
  /** Uses at least one elevator whose location hasn't been verified. */
  unverifiedElevator: boolean
}

class MinHeap {
  private items: [number, string][] = []
  get size() {
    return this.items.length
  }
  push(item: [number, string]) {
    const a = this.items
    a.push(item)
    let i = a.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (a[p][0] <= a[i][0]) break
      ;[a[p], a[i]] = [a[i], a[p]]
      i = p
    }
  }
  pop(): [number, string] {
    const a = this.items
    const top = a[0]
    const last = a.pop()!
    if (a.length > 0) {
      a[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < a.length && a[l][0] < a[m][0]) m = l
        if (r < a.length && a[r][0] < a[m][0]) m = r
        if (m === i) break
        ;[a[m], a[i]] = [a[i], a[m]]
        i = m
      }
    }
    return top
  }
}

/**
 * Cheapest route from any of `sources` to any of `targets` (multi-door rooms).
 * Returns null when no target is reachable under the graph's accessibility filter.
 */
export function shortestRoute(g: Graph, sources: string[], targets: string[]): Route | null {
  const targetSet = new Set(targets)
  const dist = new Map<string, number>()
  const prev = new Map<string, PathStep>()
  const heap = new MinHeap()
  for (const s of sources) {
    dist.set(s, 0)
    heap.push([0, s])
  }
  let reached: string | null = null
  while (heap.size > 0) {
    const [d, u] = heap.pop()
    if (d > (dist.get(u) ?? Infinity)) continue
    if (targetSet.has(u)) {
      reached = u
      break
    }
    for (const arc of g.adj.get(u) ?? []) {
      const nd = d + arc.cost
      if (nd < (dist.get(arc.to) ?? Infinity)) {
        dist.set(arc.to, nd)
        prev.set(arc.to, { from: u, arc })
        heap.push([nd, arc.to])
      }
    }
  }
  if (reached === null) return null

  const steps: PathStep[] = []
  for (let cur = reached; prev.has(cur); cur = prev.get(cur)!.from) steps.push(prev.get(cur)!)
  steps.reverse()
  const nodes = [steps.length ? steps[0].from : reached, ...steps.map((s) => s.arc.to)]
  return {
    nodes,
    steps,
    seconds: steps.reduce((t, s) => t + s.arc.seconds, 0),
    meters: steps.reduce((t, s) => t + s.arc.meters, 0),
    approx: steps.some((s) => s.arc.edge.approx),
    unverifiedElevator: steps.some(
      (s) => s.arc.edge.kind === 'elevator' && [s.from, s.arc.to].some((id) => g.nodes.get(id)?.verified === false),
    ),
  }
}
