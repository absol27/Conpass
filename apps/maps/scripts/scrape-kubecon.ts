// Scrapes one day of the official KubeCon NA 2026 schedule page and writes src/data/schedule.json.
//
// The page (events.linuxfoundation.org/.../program/schedule/) is server-rendered by the LF
// "sessionize-schedule" WordPress block, which embeds the full Sessionize export as
// <script type="application/json" class="sched-data">. We read that instead of the HTML cards.
//
//   npx tsx scripts/scrape-kubecon.ts                 # Wednesday (default), live page
//   npx tsx scripts/scrape-kubecon.ts 2026-11-12      # another day
//   npx tsx scripts/scrape-kubecon.ts 2026-11-11 page.html   # from a saved copy
import { readFileSync, writeFileSync } from 'node:fs'
import type { Session } from '../src/plan/session'

export const SCHEDULE_URL = 'https://events.linuxfoundation.org/kubecon-cloudnativecon-north-america/program/schedule/'
const OUT = new URL('../src/data/schedule.json', import.meta.url)

interface SchedData {
  all: {
    sessions: {
      id: string
      title: string
      description: string | null
      startsAt: string
      endsAt: string
      roomId: number | null
      speakers: string[]
      categoryItems: number[]
    }[]
    speakers: { id: string; fullName: string }[]
    rooms: { id: number; name: string }[]
    categories: { title: string; items: { id: number; name: string }[] }[]
  }
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
export function htmlToText(html: string): string {
  return html
    .replace(/<\/(p|li|h\d)>|<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(\w+);/g, (m, e) => ENTITIES[e] ?? m)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim()
}

export function extractSchedData(html: string): SchedData {
  const m = html.match(/<script type="application\/json" class="sched-data">([\s\S]*?)<\/script>/)
  if (!m) throw new Error('sched-data block not found; has the KubeCon schedule page changed?')
  return JSON.parse(m[1])
}

export function sessionsForDay(data: SchedData, day: string): Session[] {
  const { all } = data
  const rooms = new Map(all.rooms.map((r) => [r.id, r.name.trim()]))
  const speakers = new Map(all.speakers.map((s) => [s.id, s.fullName]))
  const items = new Map<number, { category: string; name: string }>()
  for (const c of all.categories) for (const i of c.items) items.set(i.id, { category: c.title, name: i.name })
  const cat = (ids: number[], category: string) => ids.map((id) => items.get(id)).find((i) => i?.category === category)?.name ?? ''

  return all.sessions
    .filter((s) => s.startsAt.startsWith(day))
    .map((s) => ({
      id: s.id,
      title: s.title.trim(),
      speakers: s.speakers.map((id) => speakers.get(id) ?? '').filter(Boolean).join(', '),
      start: s.startsAt.slice(0, 16),
      end: s.endsAt.slice(0, 16),
      location: (s.roomId !== null && rooms.get(s.roomId)) || 'Off-Site Location',
      track: cat(s.categoryItems, 'All Sessions'),
      level: cat(s.categoryItems, 'Audience Level'),
      description: htmlToText(s.description ?? ''),
      url: `${SCHEDULE_URL}?id=${s.id}`,
    }))
    .sort((a, b) => a.start.localeCompare(b.start) || a.location.localeCompare(b.location))
}

async function main() {
  const day = process.argv[2] ?? '2026-11-11'
  const src = process.argv[3]
  const html = src ? readFileSync(src, 'utf8') : await (await fetch(SCHEDULE_URL, { headers: { 'user-agent': 'Mozilla/5.0 (hallway schedule scraper)' } })).text()
  const sessions = sessionsForDay(extractSchedData(html), day)
  if (sessions.length === 0) throw new Error(`no sessions on ${day}`)
  writeFileSync(OUT, JSON.stringify(sessions, null, 0).replace(/},{/g, '},\n{') + '\n')
  console.log(`wrote ${sessions.length} sessions for ${day} across ${new Set(sessions.map((s) => s.location)).size} locations`)
}

if (import.meta.url === `file://${process.argv[1]}`) main()
