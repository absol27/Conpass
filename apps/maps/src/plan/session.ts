export interface Session {
  id: string
  title: string
  speakers: string
  start: string // venue wall time, "2026-11-11T15:00" (America/Denver)
  end: string
  location: string
  /** Track or session type from the official schedule, e.g. "Observability", "Keynote Sessions". */
  track?: string
  level?: string
  description?: string
  /** Session page on the official KubeCon site. */
  url?: string
}
