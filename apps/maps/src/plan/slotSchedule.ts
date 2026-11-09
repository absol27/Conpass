// Builds "my day": one talk in every time slot of the scraped day.
//
// A time slot is a start/end pair that many rooms share (the breakout grid: 11:00–11:30,
// 11:50–12:20, ...). Back-to-back keynotes in one room are merged into a single block.
// Show-floor theaters, tutorials, breaks and other one-off items aren't slots.
import type { LocationIndex } from '../venue/types'
import type { Session } from './session'
import { toMin } from './time'

export interface Slot {
  start: string
  end: string
  options: Session[]
}

const MIN_PARALLEL_ROOMS = 5
const KEYNOTE = /keynote/i
// Wednesday's closing remarks start 12 min after the last keynote talk.
const MAX_KEYNOTE_GAP_MIN = 15

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const onsite = (s: Session, locations: LocationIndex) => {
  const loc = locations[s.location]
  return !!loc && !('offsite' in loc)
}

/** Merges consecutive keynote talks in the same room into one block. */
export function keynoteBlocks(sessions: Session[]): Session[] {
  const keynotes = sessions.filter((s) => KEYNOTE.test(s.track ?? '')).sort((a, b) => toMin(a.start) - toMin(b.start))
  const blocks: Session[][] = []
  for (const k of keynotes) {
    const cur = blocks[blocks.length - 1]
    const last = cur?.[cur.length - 1]
    if (last && last.location === k.location && toMin(k.start) - toMin(last.end) <= MAX_KEYNOTE_GAP_MIN) cur.push(k)
    else blocks.push([k])
  }
  return blocks.map((b) => ({
    id: `keynotes-${b[0].id}`,
    title: b.length > 1 ? 'Keynotes' : b[0].title,
    speakers: b.length > 1 ? `${b.length} keynote talks` : b[0].speakers,
    start: b[0].start,
    end: b.reduce((m, s) => (s.end > m ? s.end : m), b[0].end),
    location: b[0].location,
    track: 'Keynote Sessions',
    description: b.map((s) => `${s.start.slice(11)} ${s.title}`).join('\n'),
    url: b[0].url,
  }))
}

export function timeSlots(sessions: Session[], locations: LocationIndex): Slot[] {
  const groups = new Map<string, Session[]>()
  for (const s of sessions) {
    if (!onsite(s, locations) || KEYNOTE.test(s.track ?? '')) continue
    const len = toMin(s.end) - toMin(s.start)
    if (len < 15 || len > 90) continue
    const key = `${s.start}|${s.end}`
    groups.set(key, [...(groups.get(key) ?? []), s])
  }
  const slots: Slot[] = [...groups.values()]
    .filter((g) => new Set(g.map((s) => s.location)).size >= MIN_PARALLEL_ROOMS)
    .map((g) => ({ start: g[0].start, end: g[0].end, options: g }))
  for (const k of keynoteBlocks(sessions.filter((s) => onsite(s, locations)))) slots.push({ start: k.start, end: k.end, options: [k] })
  return slots.sort((a, b) => toMin(a.start) - toMin(b.start))
}

/** One talk per slot, chosen at random (deterministic for a given seed). */
export function onePerSlot(slots: Slot[], seed: number): Session[] {
  const rand = mulberry32(seed)
  return slots.map((slot) => slot.options[Math.floor(rand() * slot.options.length)])
}

/** Adds talks the attendee has chosen themselves; they stay through shuffles and may overlap. */
export function withAddedTalks(plan: Session[], all: Session[], ids: string[]): Session[] {
  const added = ids.map((id) => all.find((s) => s.id === id)).filter((s): s is Session => !!s && !plan.includes(s))
  return [...plan, ...added].sort((a, b) => toMin(a.start) - toMin(b.start) || toMin(a.end) - toMin(b.end))
}
