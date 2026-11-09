// Every number the time estimates depend on. All of these are shown, with their
// rationale, in Settings -> "How we estimate", and every one is user-editable.

export interface RouteSettings {
  /** Walking speed in metres per second. */
  speed: number
  escalatorSecPerLevel: number
  stairsSecPerLevel: number
  elevatorWaitSec: number
  elevatorSecPerLevel: number
  /** Time from the room door to a seat, added to every transition. */
  bufferMin: number
  stepFree: boolean
  avoidEscalators: boolean
  avoidShowFloor: boolean
  fewestLevelChanges: boolean
  /** Which restrooms "restroom on the way" may suggest. */
  restroomPref: RestroomPref
}

export type RestroomPref = 'any' | 'all-gender' | 'women' | 'men'

export const SPEED_PRESETS = [
  { id: 'brisk', label: 'Brisk', speed: 1.4 },
  { id: 'default', label: 'Default', speed: 1.2 },
  { id: 'relaxed', label: 'Relaxed', speed: 1.0 },
  { id: 'aid', label: 'Mobility aid', speed: 0.8 },
] as const

export const DEFAULT_SETTINGS: RouteSettings = {
  speed: 1.2,
  escalatorSecPerLevel: 30,
  stairsSecPerLevel: 40,
  elevatorWaitSec: 90,
  elevatorSecPerLevel: 15,
  bufferMin: 2,
  stepFree: false,
  avoidEscalators: false,
  avoidShowFloor: false,
  fewestLevelChanges: false,
  restroomPref: 'any',
}

export const SPEED_MIN = 0.5
export const SPEED_MAX = 1.8

export const mps = {
  toMph: (v: number) => v * 2.23694,
  toKmh: (v: number) => v * 3.6,
  secPer100m: (v: number) => 100 / v,
}
