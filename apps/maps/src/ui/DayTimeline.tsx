import { Fragment } from 'react'
import type { Session } from '../plan/session'
import { fmtClock, fmtDuration, toMin } from '../plan/time'
import type { Transition, TransitionStatus } from '../plan/transitions'
import type { Router } from '../routing/router'
import { LevelBadge } from './LevelBadge'

export const STATUS: Record<TransitionStatus, { icon: string; label: string }> = {
  comfortable: { icon: '✓', label: 'Comfortable' },
  tight: { icon: '!', label: 'Tight' },
  late: { icon: '✕', label: "Won't make it" },
  overlap: { icon: '⇄', label: 'Overlap' },
  'same-room': { icon: '✓', label: 'Same room' },
  offsite: { icon: '↗', label: 'Off-site' },
  unreachable: { icon: '⛔', label: 'No route' },
}

function TalkCard({ session, router, alternatives, added }: { session: Session; router: Router; alternatives: number; added: boolean }) {
  const loc = router.locations[session.location]
  const door = loc && 'nodes' in loc ? router.venue.nodes.find((n) => n.id === loc.nodes[0]) : undefined
  return (
    <article className="talk">
      <div className="time">
        {fmtClock(toMin(session.start))} – {fmtClock(toMin(session.end))}
      </div>
      <h3>{session.title}</h3>
      <div className="room">
        {door && <LevelBadge venue={router.venue} levelId={door.level} />}
        <span>{router.label(session.location)}</span>
      </div>
      {session.speakers && <div className="time">{session.speakers}</div>}
      <div className="talk-foot">
        {session.track && <span className="badge">{session.track}</span>}
        {session.level && <span className="badge">{session.level}</span>}
        {added && <span className="badge added">★ Added by you</span>}
        {alternatives > 1 && <span className="badge">1 of {alternatives} in this slot</span>}
        {session.url && (
          <a href={session.url} target="_blank" rel="noreferrer">
            Details<span className="sr-only"> for {session.title} on the KubeCon site</span> ↗
          </a>
        )}
      </div>
    </article>
  )
}

function Hop({ t, selected, onSelect }: { t: Transition; selected: boolean; onSelect: () => void }) {
  const s = STATUS[t.status]
  const routable = t.result.kind === 'ok'
  return (
    <div className={`hop${selected ? ' selected' : ''}`} data-status={t.status}>
      <span className={`status ${t.status}`}>
        <span aria-hidden="true">{s.icon}</span> {s.label}
      </span>
      <p className="headline">{t.headline}</p>
      {routable && t.result.kind === 'ok' && (
        <div className="meta">
          {fmtDuration(t.walkSec)} walk · {Math.round(t.result.route.meters / 10) * 10} m
          {t.result.route.approx && ' ≈'} · leave by <strong>{fmtClock(t.leaveByMin)}</strong>
        </div>
      )}
      {routable && (
        <div className="actions">
          <button className="btn" onClick={onSelect} aria-pressed={selected}>
            {selected ? 'Showing route' : 'Show route'}
          </button>
        </div>
      )}
    </div>
  )
}

export function DayTimeline({
  plan,
  slotSize,
  added,
  transitions,
  router,
  selected,
  onSelect,
}: {
  plan: Session[]
  /** Session id -> how many talks were on offer in its time slot. */
  slotSize: Map<string, number>
  /** Ids of talks the attendee added themselves. */
  added: string[]
  transitions: Transition[]
  router: Router
  selected: number | null
  onSelect: (i: number) => void
}) {
  if (plan.length === 0) return <p className="empty">No talks on this day.</p>
  const counts = transitions.reduce<Record<string, number>>((m, t) => ((m[t.status] = (m[t.status] ?? 0) + 1), m), {})
  const problems = (counts.late ?? 0) + (counts.overlap ?? 0) + (counts.tight ?? 0)
  return (
    <>
      <div className="day-head">
        <h2>Your day</h2>
        <p>
          {plan.length} talks · {problems === 0 ? 'every hop is comfortable' : `${problems} hop${problems > 1 ? 's' : ''} need attention`}
        </p>
      </div>
      {plan.map((s, i) => (
        <Fragment key={s.id}>
          <TalkCard session={s} router={router} alternatives={slotSize.get(s.id) ?? 1} added={added.includes(s.id)} />
          {i < transitions.length && <Hop t={transitions[i]} selected={selected === i} onSelect={() => onSelect(i)} />}
        </Fragment>
      ))}
    </>
  )
}
