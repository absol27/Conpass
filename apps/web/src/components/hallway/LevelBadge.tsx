import type { Venue } from './types'

/** Small coloured pill naming a level, e.g. "SP · L2" or "Hyatt · L4". */
export function LevelBadge({ venue, levelId }: { venue: Venue; levelId: string }) {
  const level = venue.levels.find((l) => l.id === levelId)
  if (!level) return null
  const isHyatt = level.building !== venue.levels[0].building
  const text = `${isHyatt ? 'Hyatt' : 'Salt Palace'} · ${level.name === 'Lobby' ? 'Lobby' : `L${level.floor}`}`
  return <span className={`lvl ${isHyatt ? 'HY' : levelId}`}>{text}</span>
}

/** Leaflet needs literal colours, not CSS variables. */
export const levelHex = (levelId: string) =>
  levelId.startsWith('HY') ? '#d26a00' : levelId === 'SP2' ? '#3157d5' : levelId === 'SP3' ? '#8a3fd1' : '#0f8a74'
