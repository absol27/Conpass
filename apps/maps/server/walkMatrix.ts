import { webRoomId } from '../src/data/roomIds'
import type { Router } from '../src/routing/router'
import type { RouteSettings } from '../src/routing/settings'

/** Walking seconds between every pair of on-site rooms, keyed by apps/web room id. Unreachable pairs are left out. */
export interface WalkMatrix {
  speed: number
  stepFree: boolean
  /** Door-to-seat buffer the caller should add per transition, in minutes. Not included in `seconds`. */
  bufferMin: number
  seconds: Record<string, Record<string, number>>
}

export function walkMatrix(router: Router, settings: RouteSettings): WalkMatrix {
  const rooms = router.onsiteLocations()
  const seconds: WalkMatrix['seconds'] = {}
  for (const from of rooms) {
    const row: Record<string, number> = {}
    for (const to of rooms) {
      if (from === to) {
        row[webRoomId(to)] = 0
        continue
      }
      const r = router.route(from, to, settings)
      if (r.kind === 'ok') row[webRoomId(to)] = Math.round(r.route.seconds)
    }
    seconds[webRoomId(from)] = row
  }
  return { speed: settings.speed, stepFree: settings.stepFree, bufferMin: settings.bufferMin, seconds }
}
