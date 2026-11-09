// Contract with the maps service (apps/maps): copied from its venue, routing and settings types.
// GET /map/api/venue returns a Venue; GET /map/api/route returns { result: RouteResult, restroom: Detour | null }.
// Keep in sync with apps/maps/src/venue/types.ts and apps/maps/src/routing/*.ts.


// Venue model. Coordinates are in "map units": the floor-plan page at 100 dpi.
// Each level's nodes live where that level is *drawn* on the plan; the Salt Palace PDF
// draws levels 2 and 3 as offset insets, so horizontal distances are only meaningful
// within a level. Vertical edges join the same physical connector on two levels and
// are costed by level change, never by drawn distance.

export type NodeKind = 'door' | 'junction' | 'escalator' | 'elevator' | 'stairs' | 'entrance' | 'poi'
export type EdgeKind = 'walk' | 'escalator' | 'stairs' | 'elevator' | 'connector'
export type Zone = 'expo'
export type PoiType = 'restroom' | 'mothers-room' | 'first-aid' | 'info'
export type RestroomType = 'both' | 'all-gender' | 'men' | 'women'

export interface Level {
  id: string
  building: string
  name: string // "Level 2"
  floor: number // used for "up"/"down" wording and vertical cost
}

export interface VenueNode {
  id: string
  level: string
  x: number
  y: number
  kind: NodeKind
  label?: string
  poi?: PoiType
  /** For restrooms; 'both' = separate men's and women's rooms side by side. Defaults to 'both'. */
  restroom?: RestroomType
  /** For elevators: has the location been confirmed on site / from an official source? */
  verified?: boolean
}

export interface VenueEdge {
  a: string
  b: string
  kind: EdgeKind
  zone?: Zone
  /** Geometry is a guess (e.g. Hyatt schematic); the UI shows "≈" on routes using it. */
  approx?: boolean
  /** Corridor name used in directions, e.g. "Lower Concourse". */
  name?: string
}

export interface Venue {
  id: string
  name: string
  metersPerUnit: number
  /** Whole map extent in map units: [[yMin, xMin], [yMax, xMax]]. */
  mapBounds: [[number, number], [number, number]]
  mapImage: string
  /** Where the main plan image sits in map units (defaults to mapBounds). */
  mapImageBounds?: [[number, number], [number, number]]
  /** Extra plan images drawn into map space, e.g. Hyatt floors placed as insets. */
  overlays?: { image: string; label: string; bounds: [[number, number], [number, number]] }[]
  levels: Level[]
  nodes: VenueNode[]
  edges: VenueEdge[]
}

/** Sessionize location string -> one or more door nodes (router picks the nearest). */
export type LocationIndex = Record<string, { nodes: string[]; label: string } | { offsite: true; label: string }>

export interface Arc {
  to: string
  edge: VenueEdge
  /** Honest time estimate for traversing this arc, in seconds. */
  seconds: number
  /** What the router minimises: seconds plus preference penalties. */
  cost: number
  meters: number
}

export interface PathStep {
  from: string
  arc: Arc
}

export interface Route {
  nodes: string[]
  steps: PathStep[]
  seconds: number
  meters: number
  /** Uses at least one edge whose geometry is a guess. */
  approx: boolean
  /** Uses at least one elevator whose location hasn't been verified. */
  unverifiedElevator: boolean
}

export type StepIcon = 'start' | 'walk' | 'left' | 'right' | 'escalator' | 'stairs' | 'elevator' | 'connector' | 'arrive'
export type Vertical = 'up' | 'down'

export interface Direction {
  icon: StepIcon
  text: string
  seconds: number
  meters: number
  level: string
  /** For escalator/stairs steps. */
  vertical?: Vertical
}

export type RouteResult =
  | { kind: 'ok'; route: Route; steps: Direction[]; fromLabel: string; toLabel: string }
  | { kind: 'same'; label: string }
  | { kind: 'offsite' }
  | { kind: 'unreachable'; fromLabel: string; toLabel: string }
  | { kind: 'unknown'; location: string }

export interface Detour {
  nodeId: string
  label: string
  level: string
  /** Extra seconds compared with the direct route. */
  extraSec: number
}

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
