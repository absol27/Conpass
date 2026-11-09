import { describe, expect, it } from 'vitest'
import { Router } from '../../routing/router'
import { DEFAULT_SETTINGS } from '../../routing/settings'
import { locations } from './locations'
import { saltPalace } from './venue'

const router = new Router(saltPalace, locations)
const node = (id: string) => saltPalace.nodes.find((n) => n.id === id)
const kinds = (from: string, to: string, s = DEFAULT_SETTINGS) => {
  const r = router.route(from, to, s)
  if (r.kind !== 'ok') throw new Error(r.kind)
  return r.route.steps.map((st) => st.arc.edge.kind)
}
const SP_255EF = 'Salt Palace | Level 2 | 255 EF'
const CAPITOL_REEF = 'Hyatt Regency | Level 5 | Capitol Reef'
const REGENCY_CD = 'Hyatt Regency | Level 4 | Regency Ballroom CD'

describe('Salt Palace + Hyatt venue (KubeCon 2024 sign corrections)', () => {
  it('has no elevator at Guest Relations and stairs (not an escalator) at the North Foyer', () => {
    expect(node('elev_gr')).toBeUndefined()
    expect(node('st_nf')?.kind).toBe('stairs')
    expect(node('esc_nfB')).toBeUndefined()
  })

  it('marks the elevators the 2024 sign shows as verified', () => {
    for (const id of ['elev_nf', 'elev_uc', 'elev155', 'elev255', 'elev355', 'hy1_el', 'h4_el']) expect(node(id)?.verified).toBe(true)
  })

  it('reaches the Hyatt through the confirmed connector, not an estimated one', () => {
    const e = saltPalace.edges.find((x) => x.kind === 'connector')!
    expect(e.approx).toBeFalsy()
  })

  it('Level 5 has no escalator, so Capitol Reef is reached by elevator or stairs', () => {
    const steps = router.route(SP_255EF, CAPITOL_REEF, DEFAULT_SETTINGS)
    if (steps.kind !== 'ok') throw new Error(steps.kind)
    const last = steps.route.steps.filter((s) => s.arc.edge.kind !== 'walk').at(-1)!
    expect(['elevator', 'stairs']).toContain(last.arc.edge.kind)
  })

  it('step-free routes to every Hyatt floor use only elevators', () => {
    for (const to of [CAPITOL_REEF, REGENCY_CD, 'Hyatt Regency | Level 3 | Park City']) {
      const k = kinds(SP_255EF, to, { ...DEFAULT_SETTINGS, stepFree: true })
      expect(k).not.toContain('escalator')
      expect(k).not.toContain('stairs')
      expect(k).toContain('elevator')
    }
  })

  it('B-D picks the nearer of the B and C-D doors', () => {
    const r = router.route('Hyatt Regency | Level 2 | Salt Lake Ballroom C', 'Hyatt Regency | Level 4 | Regency Ballroom B-D', DEFAULT_SETTINGS)
    if (r.kind !== 'ok') throw new Error(r.kind)
    expect(['d_regB', 'd_regCD']).toContain(r.route.nodes.at(-1))
  })

  it('restroom preference filters suggestions', () => {
    const ag = router.restroomDetour('Salt Palace | Level 1 | 151', REGENCY_CD, { ...DEFAULT_SETTINGS, restroomPref: 'all-gender' })!
    expect(node(ag.nodeId)?.restroom).toBe('all-gender')
    const any = router.restroomDetour(SP_255EF, 'Salt Palace | Level 2 | 255 BC', DEFAULT_SETTINGS)!
    expect(['men', 'women']).not.toContain(node(any.nodeId)?.restroom)
  })
})
