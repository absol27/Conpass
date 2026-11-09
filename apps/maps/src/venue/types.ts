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
