// Hyatt Regency Salt Lake City, Levels 2–5, traced from the hotel's own floor-plan PDF
// (vendor/hyatt-regency-slc-floorplans-2023.pdf). Connector, lobby and amenity locations are
// cross-checked against the KubeCon NA 2024 venue sign (vendor/kubecon-na24-venue-map.pdf).
//
// Each floor is drawn as an inset below the Salt Palace plan, at the venue's scale, so walking
// distances on a floor are real. Floors join through the same elevator/escalator/stairs on each.
//
// Scale: Regency Ballroom (published 23,015 sq ft) is 133 x 238 px on PDF page 2 at 100 dpi,
// i.e. 0.260 m/px. Page 1 (Levels 2–3) draws the same building at 0.771x that size (outer width
// 327 px vs 252 px), i.e. 0.200 m/px. Both give a ~95 m long building.
//
// Level 1 (lobby) has no published plan; it sits in the hotel's footprint on the Salt Palace
// plan and its internals are approximate.
import type { VenueEdge, VenueNode } from '../../venue/types'

const METERS_PER_UNIT = 0.55

export interface HyattSheet {
  level: string
  label: string
  page: number
  /** Crop of the PDF page in 100-dpi px: [x0, y0, x1, y1]. */
  crop: [number, number, number, number]
  metersPerPx: number
  /** Where the crop's top-left corner lands in venue map units. */
  at: [number, number]
}

export const HYATT_SHEETS: HyattSheet[] = [
  { level: 'HY2', label: 'Hyatt L2', page: 1, crop: [40, 432, 385, 932], metersPerPx: 0.2004, at: [40, 1150] },
  { level: 'HY3', label: 'Hyatt L3', page: 1, crop: [455, 432, 800, 932], metersPerPx: 0.2004, at: [190, 1150] },
  { level: 'HY4', label: 'Hyatt L4', page: 2, crop: [30, 342, 298, 718], metersPerPx: 0.26, at: [340, 1150] },
  { level: 'HY5', label: 'Hyatt L5', page: 2, crop: [305, 467, 558, 840], metersPerPx: 0.26, at: [490, 1150] },
]

const sheet = (level: string) => HYATT_SHEETS.find((s) => s.level === level)!

/** PDF page px on a given Hyatt floor -> venue map units. */
export function hyattPoint(level: string, px: number, py: number): { x: number; y: number } {
  const s = sheet(level)
  const k = s.metersPerPx / METERS_PER_UNIT
  return { x: Math.round((s.at[0] + (px - s.crop[0]) * k) * 10) / 10, y: Math.round((s.at[1] + (py - s.crop[1]) * k) * 10) / 10 }
}

export function hyattOverlays() {
  return HYATT_SHEETS.map((s) => {
    const tl = hyattPoint(s.level, s.crop[0], s.crop[1])
    const br = hyattPoint(s.level, s.crop[2], s.crop[3])
    return { image: `maps/hyatt-${s.level.toLowerCase()}.png`, label: s.label, bounds: [[tl.y, tl.x], [br.y, br.x]] as [[number, number], [number, number]] }
  })
}

type Add = (n: VenueNode) => void
type Link = (e: VenueEdge) => void

/** Adds the Hyatt floors to the venue graph. Coordinates below are PDF page px per floor. */
export function addHyatt(addNode: Add, addEdge: Link) {
  const n = (id: string, level: string, px: number, py: number, kind: VenueNode['kind'] = 'junction', extra: Partial<VenueNode> = {}) =>
    addNode({ id, level, ...hyattPoint(level, px, py), kind, ...extra })
  const door = (id: string, level: string, px: number, py: number, label: string) => n(id, level, px, py, 'door', { label })
  const rr = (id: string, level: string, px: number, py: number, restroom: VenueNode['restroom'], label: string) =>
    n(id, level, px, py, 'poi', { poi: 'restroom', restroom, label })
  const walk = (ids: string[], name?: string) => {
    for (let i = 1; i < ids.length; i++) addEdge({ a: ids[i - 1], b: ids[i], kind: 'walk', ...(name ? { name } : {}) })
  }

  // ---- Level 2: Salt Lake Ballroom
  const L2 = 'HY2'
  n('h2_esc1', L2, 297, 615, 'escalator', { label: 'Escalator' }) // up from the lobby
  n('h2_esc2', L2, 356, 690, 'escalator', { label: 'Escalator' }) // up to Level 3
  n('h2_fw', L2, 265, 625, 'junction', { label: 'Salt Lake Foyer West' })
  n('h2_fwn', L2, 265, 560)
  n('h2_fe', L2, 340, 645, 'junction', { label: 'Salt Lake Foyer East' })
  n('h2_lob', L2, 320, 778, 'junction', { label: 'Elevator lobby' })
  n('h2_el', L2, 348, 778, 'elevator', { label: 'Elevator', verified: true })
  n('h2_st', L2, 352, 835, 'stairs', { label: 'Stairs' })
  n('h2_n', L2, 300, 500)
  n('h2_el2', L2, 296, 540, 'elevator', { label: 'Elevator', verified: true })
  n('h2_st2', L2, 305, 518, 'stairs', { label: 'Stairs' })
  n('h2_nc', L2, 205, 497)
  door('d_slbDE', L2, 246, 556, 'Salt Lake Ballroom D-E')
  door('d_slbC', L2, 246, 645, 'Salt Lake Ballroom C')
  rr('rr_h2_m', L2, 212, 462, 'men', "Men's restroom (Hyatt L2, north)")
  rr('rr_h2_w', L2, 258, 462, 'women', "Women's restroom (Hyatt L2, north)")
  rr('rr_h2_ag', L2, 190, 492, 'all-gender', 'All-gender / family restroom (Hyatt L2)')
  rr('rr_h2_m2', L2, 292, 814, 'men', "Men's restroom (Hyatt L2, elevator lobby)")
  rr('rr_h2_w2', L2, 292, 839, 'women', "Women's restroom (Hyatt L2, elevator lobby)")
  walk(['h2_esc1', 'h2_fw', 'd_slbC'], 'Salt Lake Foyer West')
  walk(['h2_fw', 'h2_fwn', 'd_slbDE'], 'Salt Lake Foyer West')
  walk(['h2_fwn', 'h2_n'], 'the north corridor')
  walk(['h2_n', 'h2_el2']); walk(['h2_n', 'h2_st2'])
  walk(['h2_n', 'h2_nc'], 'the north corridor')
  walk(['h2_nc', 'rr_h2_m']); walk(['h2_nc', 'rr_h2_w']); walk(['h2_nc', 'rr_h2_ag'])
  walk(['h2_fw', 'h2_fe'], 'Salt Lake Foyer')
  walk(['h2_fe', 'h2_esc2'])
  walk(['h2_fe', 'h2_lob'], 'Salt Lake Foyer East')
  walk(['h2_lob', 'h2_el']); walk(['h2_lob', 'h2_st'])
  walk(['h2_lob', 'rr_h2_m2']); walk(['h2_lob', 'rr_h2_w2'])

  // ---- Level 3: Park City
  const L3 = 'HY3'
  n('h3_esc_dn', L3, 768, 695, 'escalator', { label: 'Escalator' })
  n('h3_esc_up', L3, 768, 652, 'escalator', { label: 'Escalator' })
  n('h3_f', L3, 745, 672)
  n('h3_fn', L3, 745, 600)
  n('h3_n', L3, 722, 560)
  n('h3_el2', L3, 700, 548, 'elevator', { label: 'Elevator', verified: true })
  n('h3_st2', L3, 706, 520, 'stairs', { label: 'Stairs' })
  n('h3_lob', L3, 735, 780, 'junction', { label: 'Elevator lobby' })
  n('h3_el', L3, 762, 778, 'elevator', { label: 'Elevator', verified: true })
  n('h3_st', L3, 766, 835, 'stairs', { label: 'Stairs' })
  door('d_park', L3, 730, 880, 'Park City')
  rr('rr_h3_m', L3, 708, 817, 'men', "Men's restroom (Hyatt L3)")
  rr('rr_h3_w', L3, 708, 843, 'women', "Women's restroom (Hyatt L3)")
  walk(['h3_esc_dn', 'h3_f']); walk(['h3_esc_up', 'h3_f'])
  walk(['h3_f', 'h3_fn', 'h3_n'], 'the east corridor')
  walk(['h3_n', 'h3_el2']); walk(['h3_n', 'h3_st2'])
  walk(['h3_f', 'h3_lob'], 'the east corridor')
  walk(['h3_lob', 'h3_el']); walk(['h3_lob', 'h3_st'])
  walk(['h3_lob', 'rr_h3_m']); walk(['h3_lob', 'rr_h3_w'])
  walk(['h3_lob', 'd_park'], 'the elevator lobby')

  // ---- Level 4: Regency Ballroom
  const L4 = 'HY4'
  n('h4_esc', L4, 270, 525, 'escalator', { label: 'Escalator' })
  n('h4_f', L4, 245, 525)
  n('h4_fn', L4, 242, 478, 'junction', { label: 'Regency Foyer North' })
  n('h4_fs', L4, 242, 560, 'junction', { label: 'Regency Foyer South' })
  n('h4_lob', L4, 240, 605, 'junction', { label: 'Elevator lobby' })
  n('h4_el', L4, 266, 605, 'elevator', { label: 'Elevator', verified: true })
  n('h4_st', L4, 268, 648, 'stairs', { label: 'Stairs' })
  n('h4_n', L4, 232, 452)
  n('h4_el2', L4, 228, 425, 'elevator', { label: 'Elevator', verified: true })
  n('h4_st2', L4, 238, 408, 'stairs', { label: 'Stairs' })
  n('h4_nc', L4, 190, 390)
  door('d_regCD', L4, 216, 450, 'Regency Ballroom C-D')
  door('d_regB', L4, 216, 525, 'Regency Ballroom B')
  door('d_regA', L4, 216, 600, 'Regency Ballroom A')
  rr('rr_h4_m', L4, 147, 368, 'men', "Men's restroom (Hyatt L4)")
  rr('rr_h4_w', L4, 191, 368, 'women', "Women's restroom (Hyatt L4)")
  rr('rr_h4_ag', L4, 175, 392, 'all-gender', 'All-gender / family restroom (Hyatt L4)')
  walk(['h4_esc', 'h4_f']); walk(['h4_f', 'd_regB'], 'Regency Foyer')
  walk(['h4_f', 'h4_fn', 'd_regCD'], 'Regency Foyer North')
  walk(['h4_fn', 'h4_n'])
  walk(['h4_n', 'h4_el2']); walk(['h4_n', 'h4_st2'])
  walk(['h4_n', 'h4_nc'], 'the north corridor')
  walk(['h4_nc', 'rr_h4_m']); walk(['h4_nc', 'rr_h4_w']); walk(['h4_nc', 'rr_h4_ag'])
  walk(['h4_f', 'h4_fs', 'h4_lob'], 'Regency Foyer South')
  walk(['h4_lob', 'd_regA'])
  walk(['h4_lob', 'h4_el']); walk(['h4_lob', 'h4_st'])

  // ---- Level 5: Capitol Reef (no escalator on this floor)
  const L5 = 'HY5'
  n('h5_lob', L5, 525, 732, 'junction', { label: 'Elevator lobby' })
  n('h5_el', L5, 530, 718, 'elevator', { label: 'Elevator', verified: true })
  n('h5_st', L5, 528, 770, 'stairs', { label: 'Stairs' })
  n('h5_c', L5, 532, 640)
  n('h5_n', L5, 505, 562)
  n('h5_el2', L5, 488, 545, 'elevator', { label: 'Elevator', verified: true })
  n('h5_st2', L5, 492, 528, 'stairs', { label: 'Stairs' })
  door('d_capreef', L5, 520, 602, 'Capitol Reef')
  rr('rr_h5_m', L5, 490, 760, 'men', "Men's restroom (Hyatt L5)")
  rr('rr_h5_w', L5, 490, 780, 'women', "Women's restroom (Hyatt L5)")
  walk(['h5_lob', 'h5_c', 'd_capreef'], 'the Level 5 corridor')
  walk(['h5_c', 'h5_n'], 'the Level 5 corridor')
  walk(['h5_n', 'h5_el2']); walk(['h5_n', 'h5_st2'])
  walk(['h5_lob', 'h5_el']); walk(['h5_lob', 'h5_st'])
  walk(['h5_lob', 'rr_h5_m']); walk(['h5_lob', 'rr_h5_w'])
}
