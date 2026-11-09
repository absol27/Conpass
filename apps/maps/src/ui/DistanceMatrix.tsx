import { useMemo } from 'react'
import { fmtDuration } from '../plan/time'
import type { Router } from '../routing/router'
import type { RouteSettings } from '../routing/settings'

// The breakout rooms most KubeCon talks are in, roughly west -> east -> Hyatt.
const ROOMS = [
  'Salt Palace | Level 1 | Hall DE',
  'Salt Palace | Level 1 | Grand Ballroom GI',
  'Salt Palace | Level 1 | Grand Ballroom H',
  'Salt Palace | Level 1 | Grand Ballroom BDF',
  'Salt Palace | Level 1 | Grand Ballroom ACE',
  'Salt Palace | Level 1 | 151',
  'Salt Palace | Level 1 | Solutions Showcase | Hall 1 | Alpine Overlook Zone | Demo Theater',
  'Salt Palace | Level 1 | Solutions Showcase | Hall 5 | Cosmic Canyon Zone | Project Pavilion',
  'Salt Palace | Level 2 | 250 A-C',
  'Salt Palace | Level 2 | 251 D-F',
  'Salt Palace | Level 2 | 254',
  'Salt Palace | Level 2 | 255 BC',
  'Salt Palace | Level 2 | 255 EF',
  'Hyatt Regency | Level 2 | Salt Lake Ballroom C',
  'Hyatt Regency | Level 4 | Regency Ballroom B-D',
]

// Binned single-hue sequential ramp (light -> dark = near -> far).
const BINS = [
  { max: 2, bg: '#cde2fb', fg: '#0d366b' },
  { max: 4, bg: '#9ec5f4', fg: '#0d366b' },
  { max: 6, bg: '#6da7ec', fg: '#0d366b' },
  { max: 8, bg: '#3987e5', fg: '#ffffff' },
  { max: 10, bg: '#256abf', fg: '#ffffff' },
  { max: Infinity, bg: '#104281', fg: '#ffffff' },
]
const bin = (min: number) => BINS.find((b) => min < b.max)!

export function DistanceMatrix({ router, settings, onPick }: { router: Router; settings: RouteSettings; onPick: (from: string, to: string) => void }) {
  const grid = useMemo(
    () =>
      ROOMS.map((a) =>
        ROOMS.map((b) => {
          if (a === b) return null
          const r = router.route(a, b, settings)
          return r.kind === 'ok' ? { sec: r.route.seconds, approx: r.route.approx } : undefined
        }),
      ),
    [router, settings],
  )
  const short = (loc: string) => router.label(loc).replace(' · Hyatt', ' (Hyatt)').replace(/ Ballroom (?=[A-Z-]+ \(Hyatt\))/, ' ')

  return (
    <div className="matrix-wrap">
      <h2 style={{ fontSize: '1.05em', margin: '0 0 4px' }}>How far apart are the rooms?</h2>
      <p style={{ margin: '0 0 6px', color: 'var(--muted)', fontSize: '0.9em' }}>
        Minutes on foot with your current speed and accessibility settings (door to door, without the seat buffer). Click a
        cell to see the route.
      </p>
      <div className="scale" aria-hidden="true">
        <span>near</span>
        <span className="bar">
          {BINS.map((b, i) => (
            <i key={i} style={{ background: b.bg }} />
          ))}
        </span>
        <span>far · &lt;2, 2–4, 4–6, 6–8, 8–10, 10+ min</span>
      </div>
      <table className="matrix">
        <caption className="sr-only">Walking minutes between rooms; rows are origins, columns destinations.</caption>
        <thead>
          <tr>
            <th />
            {ROOMS.map((r) => (
              <th key={r} scope="col">
                {short(r)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROOMS.map((a, i) => (
            <tr key={a}>
              <th scope="row">{short(a)}</th>
              {grid[i].map((cell, j) => {
                if (cell === null) return <td key={j} className="self">·</td>
                if (!cell) return <td key={j} title="No route with current settings">–</td>
                const m = cell.sec / 60
                const c = bin(m)
                return (
                  <td
                    key={j}
                    style={{ background: c.bg, color: c.fg }}
                    title={`${short(a)} → ${short(ROOMS[j])}: ${fmtDuration(cell.sec)}${cell.approx ? ' (approx.)' : ''}`}
                    onClick={() => onPick(a, ROOMS[j])}
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPick(a, ROOMS[j])}
                  >
                    {Math.round(m)}
                    {cell.approx ? '≈' : ''}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
