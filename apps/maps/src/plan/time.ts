// Session times are venue wall-clock strings ("2026-11-10T15:30", America/Denver).
// We keep them as minutes since the epoch *in venue time* so nothing depends on the
// viewer's own timezone.

export function toMin(wall: string): number {
  const [d, t] = wall.split('T')
  const [y, mo, da] = d.split('-').map(Number)
  const [h, mi] = t.split(':').map(Number)
  return Date.UTC(y, mo - 1, da, h, mi) / 60000
}

export function fmtClock(min: number): string {
  const d = new Date(Math.round(min) * 60000)
  let h = d.getUTCHours()
  const m = d.getUTCMinutes()
  const ampm = h >= 12 ? 'pm' : 'am'
  h = h % 12 || 12
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`
}

export function dayKey(wall: string): string {
  return wall.slice(0, 10)
}

export function fmtDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function fmtDuration(sec: number): string {
  const m = Math.round(sec / 60)
  if (m < 1) return '<1 min'
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${m % 60} min`
}
