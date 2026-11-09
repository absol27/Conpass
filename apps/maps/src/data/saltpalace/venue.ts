// Salt Palace Convention Center + attached Hyatt Regency, hand-traced from the 2021
// Salt Palace floor-plan PDF (vendor/spcc-brochure-2021.pdf, page 2) in 100-dpi page units.
//
// Scale: Exhibit Hall A (48,600 sq ft) is drawn ~88 x 155 units and Hall E (64,800 sq ft)
// ~128 x 155 units; both give ~0.55 m per unit.
//
// Level 2 is drawn offset from level 1 (+300 x for the Upper Concourse, +240 x for the
// 255 block / Upper Mezzanine); level 3 (355) is drawn at +25 x / -243 y from 255. Escalator
// markers line up across those offsets, which is how vertical pairs below were matched.
//
// Elevators, escalators, stairs, restroom types, info desks and the Hyatt connector are checked
// against the KubeCon NA 2024 venue sign (vendor/kubecon-na24-venue-map.pdf), which uses a
// separate symbol for each. Elevators it shows are verified:true; the rest stay verified:false.
//
// The Hyatt Regency floors live in ./hyatt.ts.
import type { EdgeKind, Level, NodeKind, PoiType, RestroomType, Venue, VenueEdge, VenueNode, Zone } from '../../venue/types'
import { addHyatt, hyattOverlays } from './hyatt'

const levels: Level[] = [
  { id: 'SP1', building: 'Salt Palace', name: 'Level 1', floor: 1 },
  { id: 'SP2', building: 'Salt Palace', name: 'Level 2', floor: 2 },
  { id: 'SP3', building: 'Salt Palace', name: 'Level 3', floor: 3 },
  { id: 'HY1', building: 'Hyatt Regency', name: 'Lobby', floor: 1 },
  { id: 'HY2', building: 'Hyatt Regency', name: 'Level 2', floor: 2 },
  { id: 'HY3', building: 'Hyatt Regency', name: 'Level 3', floor: 3 },
  { id: 'HY4', building: 'Hyatt Regency', name: 'Level 4', floor: 4 },
  { id: 'HY5', building: 'Hyatt Regency', name: 'Level 5', floor: 5 },
]

const nodes: VenueNode[] = []
const edges: VenueEdge[] = []

function n(id: string, level: string, x: number, y: number, kind: NodeKind = 'junction', label?: string, extra: Partial<VenueNode> = {}) {
  nodes.push({ id, level, x, y, kind, label, ...extra })
}
const door = (id: string, level: string, x: number, y: number, label: string) => n(id, level, x, y, 'door', label)
const poi = (id: string, level: string, x: number, y: number, poi: PoiType, label: string, restroom?: RestroomType) =>
  n(id, level, x, y, 'poi', label, { poi, ...(restroom ? { restroom } : {}) })
const elevator = (id: string, level: string, x: number, y: number, verified = false) => n(id, level, x, y, 'elevator', 'Elevator', { verified })
const stairs = (id: string, level: string, x: number, y: number) => n(id, level, x, y, 'stairs', 'Stairs')
const escalator = (id: string, level: string, x: number, y: number) => n(id, level, x, y, 'escalator', 'Escalator')

function e(a: string, b: string, opts: { kind?: EdgeKind; zone?: Zone; approx?: boolean; name?: string } = {}) {
  edges.push({ a, b, kind: opts.kind ?? 'walk', ...opts })
}
/** Chain of walk edges along a named corridor. */
function path(ids: string[], name?: string, zone?: Zone, approx?: boolean) {
  for (let i = 1; i < ids.length; i++) e(ids[i - 1], ids[i], { name, zone, approx })
}
/** All floors served by one elevator shaft are joined pairwise so a ride waits only once. */
function shaft(ids: string[], approx?: boolean) {
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) e(ids[i], ids[j], { kind: 'elevator', approx })
}

// ---------------------------------------------------------------- Salt Palace, Level 1
n('ent_200s', 'SP1', 70, 875, 'entrance', '200 South Entrance')
n('ent_wt', 'SP1', 435, 990, 'entrance', 'West Temple Entrance')
n('ent_300w', 'SP1', 685, 190, 'entrance', '300 West Entrance')

// Lower Concourse, west to east
for (const [id, x] of [['lc0', 120], ['lcE', 176], ['lcHy', 192], ['lcDE', 240], ['lcGI', 256], ['lcJ', 272], ['lcH', 300],
  ['lcBDF', 357], ['lcC', 380], ['lcNF', 420], ['lcB', 455], ['lc150', 490], ['lcA', 534], ['lc151', 550]] as const) n(id, 'SP1', x, 852)
n('lcEnd', 'SP1', 585, 840)
path(['lc0', 'lcE', 'lcHy', 'lcDE', 'lcGI', 'lcJ', 'lcH', 'lcBDF', 'lcC', 'lcNF', 'lcB', 'lc150', 'lcA', 'lc151', 'lcEnd'], 'Lower Concourse')
e('ent_200s', 'lc0', { name: 'Lower Concourse' })
escalator('esc_lc', 'SP1', 545, 844)
e('lc151', 'esc_lc')

// Guest Relations bend up to the 155 block
n('gr', 'SP1', 597, 815, 'junction', 'Guest Relations')
escalator('esc_gr', 'SP1', 585, 806)
n('crv1', 'SP1', 612, 772)
n('crv2', 'SP1', 650, 752)
n('s155', 'SP1', 738, 748)
path(['lcEnd', 'gr', 'crv1', 'crv2'], 'Guest Relations corridor')
path(['crv2', 's155'], 'Hall 1 south corridor', undefined, true)
e('gr', 'esc_gr')
poi('rr_gr', 'SP1', 603, 806, 'restroom', 'All-gender restroom by Guest Relations', 'all-gender')
poi('mr_gr', 'SP1', 603, 818, 'mothers-room', "Mother's room")
e('gr', 'rr_gr'); e('gr', 'mr_gr')

// 155 block and the corridor north along the east side of the halls
n('c155s', 'SP1', 750, 728); n('c155m', 'SP1', 750, 690); n('c155n', 'SP1', 750, 664)
escalator('esc155s', 'SP1', 744, 729); escalator('esc155n', 'SP1', 744, 664); elevator('elev155', 'SP1', 756, 685, true)
path(['s155', 'c155s', 'c155m', 'c155n'], '155 corridor')
e('c155s', 'esc155s'); e('c155n', 'esc155n'); e('c155m', 'elev155')
door('d_155abc', 'SP1', 765, 725, 'Room 155 A-C'); door('d_155def', 'SP1', 765, 665, 'Room 155 D-G')
e('c155s', 'd_155abc'); e('c155n', 'd_155def')
poi('rr_155n', 'SP1', 760, 670, 'restroom', 'Restrooms by Room 155 (north)'); poi('rr_155s', 'SP1', 760, 724, 'restroom', 'Restrooms by Room 155 (south)')
e('c155n', 'rr_155n'); e('c155s', 'rr_155s')

n('lm_s', 'SP1', 735, 645); n('lm_m', 'SP1', 700, 600); n('lm_n', 'SP1', 705, 555)
path(['c155n', 'lm_s', 'lm_m', 'lm_n'], 'Lower Mezzanine')
poi('fa_lm', 'SP1', 723, 576, 'first-aid', 'First aid')
e('lm_n', 'fa_lm')

n('ec_s', 'SP1', 732, 545); n('ec_4', 'SP1', 733, 480); n('ec_esc', 'SP1', 735, 435); n('ec_5', 'SP1', 733, 380)
n('ec_el', 'SP1', 730, 303); n('ec_n', 'SP1', 730, 240); n('wl', 'SP1', 700, 224, 'junction', 'West Lobby')
path(['lm_n', 'ec_s', 'ec_4', 'ec_esc', 'ec_5', 'ec_el', 'ec_n', 'wl'], 'Halls 4–5 east corridor')
escalator('esc_ec', 'SP1', 738, 428); elevator('elev_ec', 'SP1', 726, 303)
e('ec_esc', 'esc_ec'); e('ec_el', 'elev_ec')
escalator('esc_wlA', 'SP1', 684, 221); escalator('esc_wlB', 'SP1', 734, 221)
e('wl', 'esc_wlA'); e('wl', 'esc_wlB'); e('wl', 'ent_300w', { name: 'West Lobby' })
poi('rr_h5', 'SP1', 729, 265, 'restroom', 'Restrooms by Hall 5'); poi('rr_h4', 'SP1', 728, 474, 'restroom', 'Restrooms by Hall 4')
poi('rr_h4b', 'SP1', 728, 522, 'restroom', 'Restrooms by Hall 4 (south)')
e('ec_n', 'rr_h5'); e('ec_4', 'rr_h4'); e('ec_s', 'rr_h4b')

// North Foyer + Grand Ballroom
n('nf', 'SP1', 420, 900, 'junction', 'North Grand Ballroom Foyer')
n('nfS', 'SP1', 430, 960)
path(['lcNF', 'nf', 'nfS', 'ent_wt'], 'North Foyer')
escalator('esc_nfA', 'SP1', 431, 870); stairs('st_nf', 'SP1', 428, 937); elevator('elev_nf', 'SP1', 427, 866, true)
e('lcNF', 'esc_nfA'); e('nfS', 'st_nf'); e('lcNF', 'elev_nf')
poi('info_lc', 'SP1', 412, 846, 'info', 'Info desk (Lower Concourse)'); e('lcNF', 'info_lc')
poi('fa_nf', 'SP1', 445, 868, 'first-aid', 'First aid'); poi('mr_nf', 'SP1', 441, 876, 'mothers-room', "Mother's room")
poi('rr_nf', 'SP1', 447, 892, 'restroom', 'Restrooms in the North Foyer')
e('lcNF', 'fa_nf'); e('nf', 'mr_nf'); e('nf', 'rr_nf')

door('d_gbJ', 'SP1', 272, 866, 'Grand Ballroom J'); e('lcJ', 'd_gbJ')
door('d_gbH', 'SP1', 300, 866, 'Grand Ballroom H'); e('lcH', 'd_gbH')
door('d_gbBDF', 'SP1', 357, 866, 'Grand Ballroom B/D/F'); e('lcBDF', 'd_gbBDF')
n('gi_c', 'SP1', 255, 890); door('d_gbGI', 'SP1', 262, 930, 'Grand Ballroom G/I')
path(['lcGI', 'gi_c', 'd_gbGI'], 'Ballroom west corridor', undefined, true)
door('d_gbACE', 'SP1', 404, 925, 'Grand Ballroom A/C/E'); e('nf', 'd_gbACE')

door('d_150', 'SP1', 490, 866, 'Room 150'); e('lc150', 'd_150')
door('d_151', 'SP1', 550, 866, 'Room 151'); e('lc151', 'd_151')

// Exhibit halls. Halls A–C and 1–5 are one contiguous show floor (zone "expo");
// Hall DE is the keynote hall.
door('d_hDE', 'SP1', 240, 842, 'Hall DE'); n('hDE', 'SP1', 240, 770, 'junction', 'Hall DE')
e('lcDE', 'd_hDE'); e('d_hDE', 'hDE', { name: 'Hall DE' })
for (const [h, x] of [['C', 380], ['B', 455], ['A', 534]] as const) {
  door(`d_h${h}`, 'SP1', x, 842, `Hall ${h}`)
  n(`h${h}`, 'SP1', x, 765, 'junction', `Hall ${h}`)
  e(`lc${h}`, `d_h${h}`); e(`d_h${h}`, `h${h}`, { name: `Hall ${h}`, zone: 'expo' })
}
n('h1', 'SP1', 650, 700, 'junction', 'Hall 1'); n('h2', 'SP1', 630, 622, 'junction', 'Hall 2')
n('h3', 'SP1', 630, 572, 'junction', 'Hall 3'); n('h4', 'SP1', 630, 490, 'junction', 'Hall 4')
n('h5', 'SP1', 630, 380, 'junction', 'Hall 5'); n('h5n', 'SP1', 680, 255, 'junction', 'Hall 5 (north)')
path(['hC', 'hB', 'hA', 'h1', 'h2', 'h3', 'h4', 'h5', 'h5n'], 'the show floor', 'expo')
door('d_h1', 'SP1', 736, 700, 'Hall 1 (east doors)'); e('c155m', 'd_h1'); e('d_h1', 'h1', { zone: 'expo', name: 'Hall 1' })
door('d_h2', 'SP1', 677, 622, 'Hall 2'); e('lm_m', 'd_h2'); e('d_h2', 'h2', { zone: 'expo', name: 'Hall 2' })
door('d_h3', 'SP1', 677, 572, 'Hall 3'); e('lm_n', 'd_h3'); e('d_h3', 'h3', { zone: 'expo', name: 'Hall 3' })
door('d_h4', 'SP1', 728, 490, 'Hall 4'); e('ec_4', 'd_h4'); e('d_h4', 'h4', { zone: 'expo', name: 'Hall 4' })
door('d_h5', 'SP1', 728, 380, 'Hall 5'); e('ec_5', 'd_h5'); e('d_h5', 'h5', { zone: 'expo', name: 'Hall 5' })
door('d_h5n', 'SP1', 680, 234, 'Hall 5 (West Lobby doors)'); e('wl', 'd_h5n'); e('d_h5n', 'h5n', { zone: 'expo', name: 'Hall 5' })
// Solutions Showcase spots inside the halls
door('x_demo', 'SP1', 615, 680, 'Demo Theater (Hall 1)'); e('h1', 'x_demo', { zone: 'expo' })
door('x_nook', 'SP1', 690, 725, 'Network Nook (Hall 1)'); e('h1', 'x_nook', { zone: 'expo' })
door('x_cosmic', 'SP1', 645, 410, 'Cosmic Canyon Zone (Hall 5)'); e('h5', 'x_cosmic', { zone: 'expo' })
door('x_pavilion', 'SP1', 590, 340, 'Project Pavilion (Hall 5)'); e('h5', 'x_pavilion', { zone: 'expo' })
door('x_starlight', 'SP1', 455, 735, 'Starlight Summit Zone (Hall B)'); e('hB', 'x_starlight', { zone: 'expo' })

// ---------------------------------------------------------------- Salt Palace, Level 2
// Upper Concourse (drawn +300 x from what it sits above)
escalator('esc_ucA', 'SP2', 731, 870); stairs('st_uc', 'SP2', 728, 937); elevator('elev_uc', 'SP2', 716, 867, true)
n('uc0', 'SP2', 742, 860); n('ucW', 'SP2', 748, 922)
door('d_ereg', 'SP2', 790, 940, 'East Registration')
e('uc0', 'esc_ucA'); e('uc0', 'elev_uc'); path(['uc0', 'ucW', 'd_ereg'], 'East Registration walkway')
e('ucW', 'st_uc')
for (const [id, x] of [['uc1', 777], ['uc2', 806], ['uc3', 840], ['uc4', 870]] as const) n(id, 'SP2', x, 858)
n('uc5', 'SP2', 898, 850); n('uc6', 'SP2', 896, 822)
path(['uc0', 'uc1', 'uc2', 'uc3', 'uc4', 'uc5', 'uc6'], 'Upper Concourse')
door('d_250ac', 'SP2', 777, 868, 'Room 250 A-C'); e('uc1', 'd_250ac')
door('d_250df', 'SP2', 806, 868, 'Room 250 D-F'); e('uc2', 'd_250df')
door('d_251ac', 'SP2', 840, 868, 'Room 251 A-C'); e('uc3', 'd_251ac')
door('d_251df', 'SP2', 870, 868, 'Room 251 D-F'); e('uc4', 'd_251df')
escalator('esc_uc', 'SP2', 845, 846); e('uc3', 'esc_uc')
escalator('esc_gr2', 'SP2', 890, 810)
e('uc6', 'esc_gr2')
poi('info_uc', 'SP2', 870, 848, 'info', 'Info desk (Upper Concourse)'); e('uc4', 'info_uc')
poi('rr_uc', 'SP2', 917, 820, 'restroom', 'Restrooms at the east end of the Upper Concourse'); poi('mr_uc', 'SP2', 917, 832, 'mothers-room', "Mother's room")
e('uc6', 'rr_uc'); e('uc6', 'mr_uc')

// Curved walkway past 254 up to the 255 block
n('crvA', 'SP2', 905, 790); n('crvB', 'SP2', 935, 758); n('crvC', 'SP2', 962, 745)
path(['uc6', 'crvA', 'crvB', 'crvC'], 'the curved walkway')
door('d_254', 'SP2', 898, 778, 'Room 254'); e('crvA', 'd_254')

n('c255s', 'SP2', 980, 742); n('c255m', 'SP2', 990, 700); n('c255n', 'SP2', 985, 664)
escalator('esc255s', 'SP2', 984, 729); escalator('esc255n', 'SP2', 984, 664); elevator('elev255', 'SP2', 996, 685, true)
path(['crvC', 'c255s', 'c255m', 'c255n'], '255 corridor')
e('c255s', 'esc255s'); e('c255n', 'esc255n'); e('c255m', 'elev255')
door('d_255a', 'SP2', 1003, 726, 'Room 255 A'); door('d_255bc', 'SP2', 1003, 738, 'Room 255 B-C')
door('d_255d', 'SP2', 1003, 660, 'Room 255 D'); door('d_255ef', 'SP2', 1003, 672, 'Room 255 E-F')
e('c255s', 'd_255a'); e('c255s', 'd_255bc'); e('c255n', 'd_255d'); e('c255n', 'd_255ef')
poi('rr_255', 'SP2', 996, 707, 'restroom', 'All-gender restroom by Room 255', 'all-gender'); e('c255m', 'rr_255')
poi('rr_255m', 'SP2', 993, 670, 'restroom', "Men's restroom by Room 255", 'men'); e('c255n', 'rr_255m')
poi('rr_255w', 'SP2', 993, 722, 'restroom', "Women's restroom by Room 255", 'women'); e('c255s', 'rr_255w')

// Upper Mezzanine, north to the level-2 West Lobby
n('um0', 'SP2', 968, 640); n('um258', 'SP2', 968, 610); n('um259', 'SP2', 968, 583); n('um260', 'SP2', 968, 555)
n('um_mid', 'SP2', 968, 500, 'junction', 'Upper Mezzanine'); n('um_esc', 'SP2', 968, 428); n('um_el', 'SP2', 968, 303)
n('um_n', 'SP2', 968, 240); n('wl2', 'SP2', 945, 224, 'junction', 'West Lobby (Level 2)')
path(['c255n', 'um0', 'um258', 'um259', 'um260', 'um_mid', 'um_esc', 'um_el', 'um_n', 'wl2'], 'Upper Mezzanine')
door('d_257', 'SP2', 940, 637, 'Room 257'); e('um0', 'd_257')
door('d_258', 'SP2', 945, 610, 'Room 258'); e('um258', 'd_258')
door('d_259', 'SP2', 945, 583, 'Room 259'); e('um259', 'd_259')
door('d_260', 'SP2', 942, 553, 'Room 260'); e('um260', 'd_260')
poi('rr_um', 'SP2', 978, 470, 'restroom', 'Restrooms on the Upper Mezzanine'); e('um_mid', 'rr_um')
// Stairs by 258/259 go down to the Lower Mezzanine, which sits directly below.
stairs('st_um', 'SP2', 952, 597); e('um259', 'st_um')
stairs('st_lm', 'SP1', 712, 597); e('lm_m', 'st_lm')
escalator('esc_um', 'SP2', 975, 428); e('um_esc', 'esc_um')
elevator('elev_um', 'SP2', 966, 303); e('um_el', 'elev_um')
escalator('esc_wl2A', 'SP2', 921, 221); escalator('esc_wl2B', 'SP2', 974, 221)
e('wl2', 'esc_wl2A'); e('wl2', 'esc_wl2B')

// ---------------------------------------------------------------- Salt Palace, Level 3 (355)
escalator('esc355n', 'SP3', 1005, 421); escalator('esc355s', 'SP3', 1005, 486); elevator('elev355', 'SP3', 1018, 442, true)
n('c355n', 'SP3', 1015, 425); n('c355m', 'SP3', 1015, 452); n('c355s', 'SP3', 1015, 486)
path(['c355n', 'c355m', 'c355s'], '355 corridor')
e('c355n', 'esc355n'); e('c355s', 'esc355s'); e('c355m', 'elev355')
door('d_355def', 'SP3', 1027, 425, 'Room 355 D-G'); door('d_355abc', 'SP3', 1027, 485, 'Room 355 A-C')
e('c355n', 'd_355def'); e('c355s', 'd_355abc')
poi('rr_355m', 'SP3', 1009, 433, 'restroom', "Men's restroom by Room 355", 'men'); e('c355n', 'rr_355m')
poi('rr_355w', 'SP3', 1009, 478, 'restroom', "Women's restroom by Room 355", 'women'); e('c355s', 'rr_355w')

// ---------------------------------------------------------------- Salt Palace vertical links
e('esc_nfA', 'esc_ucA', { kind: 'escalator' })
e('st_nf', 'st_uc', { kind: 'stairs' })
e('st_lm', 'st_um', { kind: 'stairs' })
e('esc_lc', 'esc_uc', { kind: 'escalator' })
e('esc_gr', 'esc_gr2', { kind: 'escalator' })
e('esc155n', 'esc255n', { kind: 'escalator' })
e('esc155s', 'esc255s', { kind: 'escalator' })
e('esc255n', 'esc355n', { kind: 'escalator' })
e('esc255s', 'esc355s', { kind: 'escalator' })
e('esc_ec', 'esc_um', { kind: 'escalator' })
e('esc_wlA', 'esc_wl2A', { kind: 'escalator' })
e('esc_wlB', 'esc_wl2B', { kind: 'escalator' })
shaft(['elev_nf', 'elev_uc'])
shaft(['elev155', 'elev255', 'elev355'])
shaft(['elev_ec', 'elev_um'])

// ---------------------------------------------------------------- Hyatt Regency
// The connector is where the KubeCon 2024 sign puts "ACCESS BETWEEN HYATT REGENCY + SALT PALACE":
// the west end of the Lower Concourse, just west of the Grand Ballroom. The lobby (Level 1) has no
// published plan, so its internals sit in the hotel footprint on this plan and are approximate.
n('hy1_door', 'HY1', 192, 874, 'entrance', 'Hyatt Regency connector')
e('lcHy', 'hy1_door', { kind: 'connector', name: 'the Hyatt Regency connector' })
n('hy1', 'HY1', 185, 905, 'junction', 'Hyatt Regency Lobby')
e('hy1_door', 'hy1', { approx: true, name: 'the Hyatt lobby' })
escalator('hy1_esc', 'HY1', 232, 968); e('hy1', 'hy1_esc', { approx: true, name: 'the Hyatt lobby' })
elevator('hy1_el', 'HY1', 205, 950, true); e('hy1', 'hy1_el', { approx: true, name: 'the Hyatt lobby' })
stairs('hy1_st', 'HY1', 190, 958); e('hy1', 'hy1_st', { approx: true })
poi('rr_hy1', 'HY1', 222, 884, 'restroom', 'All-gender restroom (Hyatt lobby)', 'all-gender'); e('hy1', 'rr_hy1', { approx: true })

addHyatt((node) => nodes.push(node), (edge) => edges.push(edge))
// Escalators: lobby -> L2 (Salt Lake Foyer West); L2 -> L3 and L3 -> L4 are separate runs, so you
// walk across each foyer between them. Level 5 has no escalator.
e('hy1_esc', 'h2_esc1', { kind: 'escalator', approx: true })
e('h2_esc2', 'h3_esc_dn', { kind: 'escalator' })
e('h3_esc_up', 'h4_esc', { kind: 'escalator' })
shaft(['hy1_el', 'h2_el', 'h3_el', 'h4_el', 'h5_el'])
shaft(['h2_el2', 'h3_el2', 'h4_el2', 'h5_el2'])
for (const [a, b] of [['hy1_st', 'h2_st'], ['h2_st', 'h3_st'], ['h3_st', 'h4_st'], ['h4_st', 'h5_st'], ['h2_st2', 'h3_st2'], ['h3_st2', 'h4_st2'], ['h4_st2', 'h5_st2']])
  e(a, b, { kind: 'stairs' })

export const saltPalace: Venue = {
  id: 'saltpalace',
  name: 'Salt Palace Convention Center',
  metersPerUnit: 0.55,
  mapBounds: [[140, 0], [1340, 1120]],
  mapImage: 'maps/saltpalace.png',
  mapImageBounds: [[140, 0], [1100, 1120]],
  overlays: hyattOverlays(),
  levels,
  nodes,
  edges,
}
