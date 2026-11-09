import type { Router, RouteResult } from '../routing/router'
import type { RouteSettings } from '../routing/settings'
import type { Session } from './session'
import { fmtClock, toMin } from './time'

export type TransitionStatus = 'comfortable' | 'tight' | 'late' | 'overlap' | 'same-room' | 'offsite' | 'unreachable'

export interface Transition {
  from: Session
  to: Session
  result: RouteResult
  /** Walk time in seconds (0 when not routable). */
  walkSec: number
  /** Walk + door-to-seat buffer, in minutes. */
  neededMin: number
  /** Minutes between `from` ending and `to` starting; negative when they overlap. */
  gapMin: number
  /** Venue-time minutes at which to walk out of `from`. */
  leaveByMin: number
  /** How many minutes before `from` ends you have to leave (0 if you can stay to the end). */
  leaveEarlyMin: number
  status: TransitionStatus
  headline: string
}

export const COMFORT_SLACK_MIN = 5

export function classify(gapMin: number, neededMin: number): TransitionStatus {
  if (gapMin < 0) return 'overlap'
  const slack = gapMin - neededMin
  if (slack >= COMFORT_SLACK_MIN) return 'comfortable'
  if (slack >= 0) return 'tight'
  return 'late'
}

export function computeTransition(router: Router, from: Session, to: Session, settings: RouteSettings): Transition {
  const fromEnd = toMin(from.end)
  const toStart = toMin(to.start)
  const gapMin = toStart - fromEnd
  const result = router.route(from.location, to.location, settings)
  const base = { from, to, result, gapMin }

  if (result.kind === 'offsite' || result.kind === 'unknown') {
    return { ...base, walkSec: 0, neededMin: 0, leaveByMin: fromEnd, leaveEarlyMin: 0, status: 'offsite', headline: 'Off-site — check the event page for directions' }
  }
  if (result.kind === 'unreachable') {
    return { ...base, walkSec: 0, neededMin: 0, leaveByMin: fromEnd, leaveEarlyMin: 0, status: 'unreachable', headline: 'No route with your accessibility settings' }
  }
  const walkSec = result.kind === 'ok' ? result.route.seconds : 0
  const neededMin = walkSec / 60 + settings.bufferMin
  const leaveByMin = Math.floor(toStart - neededMin)
  const leaveEarlyMin = Math.max(0, fromEnd - leaveByMin)

  if (result.kind === 'same') {
    const status = gapMin < 0 ? 'overlap' : 'same-room'
    return { ...base, walkSec: 0, neededMin: 0, leaveByMin: fromEnd, leaveEarlyMin: 0, status, headline: gapMin < 0 ? 'Same room — the talks overlap' : 'Same room — stay in your seat' }
  }

  const status = classify(gapMin, neededMin)
  const leave = fmtClock(leaveByMin)
  const intoFrom = Math.max(0, leaveByMin - toMin(from.start))
  let headline: string
  switch (status) {
    case 'comfortable':
      headline = `Plenty of time — ${Math.round(gapMin - neededMin)} min to spare`
      break
    case 'tight':
      headline = `Tight — head out right at ${leave}`
      break
    case 'late':
      headline = `Leave at ${leave} (${leaveEarlyMin} min early) or arrive ~${Math.ceil(neededMin - gapMin)} min late`
      break
    case 'overlap':
      headline =
        leaveByMin <= toMin(from.start)
          ? `These overlap — you'd have to leave before it starts`
          : `Overlap — leave at ${leave} (${intoFrom} min in) to make the start`
      break
    default:
      headline = ''
  }
  return { ...base, walkSec, neededMin, leaveByMin, leaveEarlyMin, status, headline }
}

export function computeTransitions(router: Router, talks: Session[], settings: RouteSettings): Transition[] {
  const sorted = [...talks].sort((a, b) => toMin(a.start) - toMin(b.start))
  const out: Transition[] = []
  for (let i = 1; i < sorted.length; i++) out.push(computeTransition(router, sorted[i - 1], sorted[i], settings))
  return out
}
