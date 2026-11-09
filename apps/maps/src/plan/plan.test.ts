import { describe, expect, it } from 'vitest'
import { extractSchedData, htmlToText, sessionsForDay } from '../../scripts/scrape-kubecon'
import { locations } from '../data/saltpalace/locations'
import { saltPalace } from '../data/saltpalace/venue'
import { sessions } from '../data/schedule'
import { Router } from '../routing/router'
import { DEFAULT_SETTINGS } from '../routing/settings'
import type { Session } from './session'
import { keynoteBlocks, onePerSlot, timeSlots, withAddedTalks } from './slotSchedule'
import { classify, computeTransition, computeTransitions } from './transitions'
import { fmtClock, toMin } from './time'

const router = new Router(saltPalace, locations)
const talk = (id: string, start: string, end: string, location: string, track = ''): Session => ({
  id,
  title: id,
  speakers: '',
  start: `2026-11-11T${start}`,
  end: `2026-11-11T${end}`,
  location,
  track,
})
const far = 'Hyatt Regency | Level 4 | Regency Ballroom CD'
const hallDE = 'Salt Palace | Level 1 | Hall DE'

describe('classify', () => {
  it('buckets slack', () => {
    expect(classify(15, 6)).toBe('comfortable')
    expect(classify(8, 6)).toBe('tight')
    expect(classify(5, 6)).toBe('late')
    expect(classify(-30, 6)).toBe('overlap')
  })
})

describe('computeTransition', () => {
  it('handles the 3:00–4:00 vs 3:30 overlap with a leave-by time', () => {
    const a = talk('a', '15:00', '16:00', hallDE)
    const b = talk('b', '15:30', '16:00', far)
    const t = computeTransition(router, a, b, DEFAULT_SETTINGS)
    expect(t.status).toBe('overlap')
    expect(t.gapMin).toBe(-30)
    expect(t.leaveByMin).toBe(Math.floor(toMin(b.start) - t.neededMin))
    expect(t.headline).toMatch(new RegExp(`leave at ${fmtClock(t.leaveByMin)}`))
  })

  it('back-to-back far rooms are late, same room is fine', () => {
    const a = talk('a', '11:00', '11:30', hallDE)
    expect(computeTransition(router, a, talk('b', '11:30', '12:00', far), DEFAULT_SETTINGS).status).toBe('late')
    expect(computeTransition(router, a, talk('c', '11:30', '12:00', hallDE), DEFAULT_SETTINGS).status).toBe('same-room')
    expect(computeTransition(router, a, talk('d', '12:30', '13:00', far), DEFAULT_SETTINGS).status).toBe('comfortable')
  })

  it('slower walking or step-free never makes a walk shorter', () => {
    const a = talk('a', '11:00', '11:30', 'Salt Palace | Level 2 | 255 EF')
    const b = talk('b', '11:45', '12:15', hallDE)
    const base = computeTransition(router, a, b, DEFAULT_SETTINGS).walkSec
    expect(computeTransition(router, a, b, { ...DEFAULT_SETTINGS, speed: 0.8 }).walkSec).toBeGreaterThan(base)
    expect(computeTransition(router, a, b, { ...DEFAULT_SETTINGS, stepFree: true }).walkSec).toBeGreaterThan(base)
  })
})

describe('restroomDetour', () => {
  it('finds a restroom and never reports a negative detour', () => {
    const d = router.restroomDetour('Salt Palace | Level 1 | 151', far, DEFAULT_SETTINGS)!
    expect(d.label).toMatch(/restroom/i)
    expect(d.extraSec).toBeGreaterThanOrEqual(0)
  })
})

describe('time slots (scraped Wednesday)', () => {
  const slots = timeSlots(sessions, locations)

  it('finds the keynote block and the breakout grid', () => {
    expect(slots[0].options[0].title).toBe('Keynotes')
    expect(slots[0].options[0].location).toBe(hallDE)
    const breakouts = slots.slice(1).map((s) => `${s.start.slice(11)}-${s.end.slice(11)}`)
    expect(breakouts).toEqual(['11:00-11:30', '11:50-12:20', '14:20-14:50', '15:10-15:40', '16:10-16:40', '17:00-17:30'])
    for (const s of slots.slice(1)) expect(s.options.length).toBeGreaterThanOrEqual(10)
  })

  it('plans exactly one talk per slot, never overlapping', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const plan = onePerSlot(slots, seed)
      expect(plan.length).toBe(slots.length)
      plan.forEach((s, i) => expect(slots[i].options).toContain(s))
      expect(computeTransitions(router, plan, DEFAULT_SETTINGS).some((t) => t.status === 'overlap')).toBe(false)
    }
    expect(onePerSlot(slots, 1)).toEqual(onePerSlot(slots, 1))
    expect(onePerSlot(slots, 1)).not.toEqual(onePerSlot(slots, 2))
  })

  it('added show-floor talks create real conflicts around the 11:00 slot', () => {
    const plan = withAddedTalks(onePerSlot(slots, 7), sessions, ['1334849', '1362623'])
    expect(plan.length).toBe(slots.length + 2)
    const times = plan.map((s) => s.start.slice(11))
    expect(times.slice(1, 5)).toEqual(['11:00', '11:15', '11:25', '11:50'])
    const ts = computeTransitions(router, plan, DEFAULT_SETTINGS)
    expect(ts[1].status).toBe('overlap') // 11:00 talk -> 11:15
    expect(ts[2].status).toBe('overlap') // 11:15 -> 11:25
    expect(['tight', 'late']).toContain(ts[3].status) // 11:45 -> 11:50
  })

  it('merges consecutive keynotes in one room', () => {
    const blocks = keynoteBlocks([
      talk('k1', '09:00', '09:05', hallDE, 'Keynote Sessions'),
      talk('k2', '09:07', '09:12', hallDE, 'Keynote Sessions'),
      talk('k3', '13:00', '13:05', hallDE, 'Keynote Sessions'),
    ])
    expect(blocks.map((b) => [b.start.slice(11), b.end.slice(11)])).toEqual([
      ['09:00', '09:12'],
      ['13:00', '13:05'],
    ])
  })
})

describe('scraper', () => {
  const page = `<html><script type="application/json" class="sched-data">${JSON.stringify({
    all: {
      sessions: [
        { id: '9', title: ' Talk ', description: '<p>A &amp; B&#039;s <b>demo</b></p><p>Two</p>', startsAt: '2026-11-11T15:30:00', endsAt: '2026-11-11T16:00:00', roomId: 1, speakers: ['s1'], categoryItems: [10, 20] },
        { id: '8', title: 'Other day', description: null, startsAt: '2026-11-12T09:00:00', endsAt: '2026-11-12T09:30:00', roomId: null, speakers: [], categoryItems: [] },
      ],
      speakers: [{ id: 's1', fullName: 'Ada Lovelace' }],
      rooms: [{ id: 1, name: 'Hyatt Regency | Level 4 | Regency Ballroom CD ' }],
      categories: [
        { title: 'All Sessions', items: [{ id: 10, name: 'Observability' }] },
        { title: 'Audience Level', items: [{ id: 20, name: 'Beginner' }] },
      ],
    },
  })}</script></html>`

  it('extracts one day from the embedded sched-data JSON', () => {
    const out = sessionsForDay(extractSchedData(page), '2026-11-11')
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      id: '9',
      title: 'Talk',
      speakers: 'Ada Lovelace',
      start: '2026-11-11T15:30',
      end: '2026-11-11T16:00',
      location: far,
      track: 'Observability',
      level: 'Beginner',
      description: "A & B's demo\nTwo",
    })
    expect(out[0].url).toMatch(/\?id=9$/)
  })

  it('fails loudly when the page format changes', () => {
    expect(() => extractSchedData('<html></html>')).toThrow(/sched-data/)
  })

  it('decodes entities', () => {
    expect(htmlToText('&lt;x&gt; &#x2014; &nbsp;y')).toBe('<x> — y')
  })
})
