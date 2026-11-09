import type { Detour, RouteResult, RouteSettings, StepIcon, Venue } from './types'
import { LevelBadge } from './LevelBadge'

function fmtDuration(sec: number): string {
  const m = Math.round(sec / 60)
  if (m < 1) return '<1 min'
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${m % 60} min`
}

const ICON: Record<StepIcon, string> = {
  start: '●',
  walk: '↑',
  left: '↰',
  right: '↱',
  escalator: '⇗',
  stairs: '▤',
  elevator: '⇅',
  connector: '⇢',
  arrive: '⚑',
}

export function Directions({
  venue,
  result,
  settings,
  restroom,
}: {
  venue: Venue
  result: RouteResult | null
  settings: RouteSettings
  restroom: Detour | null
}) {
  if (!result) return <p className="empty">Finding your route…</p>
  if (result.kind === 'same') return <p className="empty">Same room. Stay where you are.</p>
  if (result.kind === 'offsite') return <p className="empty">Off-site sessions aren’t on the venue map.</p>
  if (result.kind === 'unknown') return <p className="empty">We don’t know where “{result.location}” is yet.</p>
  if (result.kind === 'unreachable')
    return (
      <p className="notice">
        No route from {result.fromLabel} to {result.toLabel} with your current accessibility settings.
      </p>
    )

  const { route, steps, fromLabel, toLabel } = result
  return (
    <>
      <h2>
        {fromLabel} → {toLabel}
      </h2>
      <p className="summary">
        {fmtDuration(route.seconds)} walk · {Math.round(route.meters / 10) * 10} m{route.approx ? ' (approx.)' : ''} at{' '}
        {settings.speed.toFixed(2).replace(/0$/, '')} m/s
      </p>
      {route.approx && <p className="notice">≈ Part of this route uses estimated geometry (Hyatt Regency interior or an untraced corridor).</p>}
      {settings.stepFree && route.unverifiedElevator && (
        <p className="notice">Step-free route: elevator locations come from the floor-plan legend and haven’t been verified on site yet.</p>
      )}
      {restroom && (
        <p className="notice info">
          <span aria-hidden="true">🚻</span> Restroom on the way: {restroom.label} (<LevelBadge venue={venue} levelId={restroom.level} />) adds{' '}
          {restroom.extraSec < 30 ? 'almost nothing' : `about ${fmtDuration(restroom.extraSec)}`}.
        </p>
      )}
      <ol aria-label="Turn-by-turn directions">
        {steps.map((d, i) => (
          <li key={i}>
            <span className="ico" aria-hidden="true">
              {d.icon === 'escalator' && d.vertical === 'down' ? '⇘' : ICON[d.icon]}
            </span>
            <span>
              {d.text}
              {(d.icon === 'escalator' || d.icon === 'elevator' || d.icon === 'stairs' || d.icon === 'connector' || i === 0) && (
                <>
                  {' '}
                  <LevelBadge venue={venue} levelId={d.level} />
                </>
              )}
            </span>
            <span className="t">{d.seconds > 0 ? fmtDuration(d.seconds) : ''}</span>
          </li>
        ))}
      </ol>
    </>
  )
}
