// Renders each Hyatt floor from the hotel's floor-plan PDF to public/maps/hyatt-hy<N>.png,
// using the same crop boxes the venue graph is traced in (src/data/saltpalace/hyatt.ts).
//   npx tsx scripts/rasterize-hyatt.ts      (needs poppler's pdftoppm)
import { execFileSync } from 'node:child_process'
import { HYATT_SHEETS } from '../src/data/saltpalace/hyatt'

const PDF = new URL('../vendor/hyatt-regency-slc-floorplans-2023.pdf', import.meta.url).pathname
const DPI = 200
const k = DPI / 100

for (const s of HYATT_SHEETS) {
  const [x0, y0, x1, y1] = s.crop
  const out = new URL(`../public/maps/hyatt-${s.level.toLowerCase()}`, import.meta.url).pathname
  execFileSync('pdftoppm', [
    '-f', String(s.page), '-l', String(s.page), '-r', String(DPI),
    '-x', String(x0 * k), '-y', String(y0 * k), '-W', String((x1 - x0) * k), '-H', String((y1 - y0) * k),
    '-png', '-singlefile', PDF, out,
  ], { stdio: ['ignore', 'ignore', 'ignore'] })
  console.log(`wrote ${out}.png (${s.label})`)
}
