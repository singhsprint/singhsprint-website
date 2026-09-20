/**
 * The homepage's FALLBACK tier literal must agree with the engine's bands.
 *
 * index.html carries a hardcoded TIERS object used only when the live fetch
 * to /api/pricing/homepage-tiers fails. On 2026-09-20 its top two bands read
 * 100-249 / 250+, copied from the published chart; the engine breaks at 200.
 * Quantities 200-249 were quoted a band high — tee $11.95 against $9.95,
 * hoodie $26.95 against $24.95, longsleeve $17.95 against $14.95.
 *
 * A fallback nobody looks at is exactly where a stale number survives, so
 * this pins its edges.
 *
 * Run: node scripts/check-homepage-tier-bands.mjs
 */
import { readFileSync } from 'node:fs'

let pass = 0
const fails = []
const ok = (id, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok  ${id}`) }
  else { fails.push(id); console.log(`FAIL  ${id}${detail ? ' — ' + detail : ''}`) }
}

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

// Pull the literal out rather than regexing for numbers in the whole file —
// a bare /250,99999/ would also match the live-fetch commentary.
const m = html.match(/var TIERS = \{([\s\S]*?)\n\s*\};/)
ok('T0 the fallback TIERS literal is present', !!m)
if (!m) { console.log('\n0 passed, 1 failed'); process.exit(1) }
const block = m[1]

const GARMENTS = ['tshirt', 'hoodie', 'longsleeve', 'cap']
// The engine's real bands, measured live 2026-09-20. Identical for all four.
const EXPECTED_EDGES = [[1,4],[5,9],[10,24],[25,49],[50,99],[100,199],[200,99999]]

for (const g of GARMENTS) {
  const row = block.match(new RegExp(g + '\\s*:\\s*\\[(.*?)\\]\\s*,?\\s*(?:\\n|$)'))
  if (!row) { ok(`T:${g} parsed`, false); continue }
  const bands = [...row[1].matchAll(/\[(\d+),(\d+),([\d.]+)\]/g)]
      .map(x => [Number(x[1]), Number(x[2]), Number(x[3])])
  ok(`T:${g} has ${EXPECTED_EDGES.length} bands`, bands.length === EXPECTED_EDGES.length,
     `got ${bands.length}`)
  const edges = bands.map(b => [b[0], b[1]])
  ok(`T:${g} edges match the engine`,
     JSON.stringify(edges) === JSON.stringify(EXPECTED_EDGES),
     `got ${JSON.stringify(edges)}`)
  // The regression, stated directly.
  const top = bands[bands.length - 1]
  ok(`T:${g} top band starts at 200, not 250`, top && top[0] === 200,
     `got ${top && top[0]}`)
  ok(`T:${g} qty 220 is in the TOP band`, top && 220 >= top[0] && 220 <= top[1])
  // No gaps, no overlaps.
  let holes = 0, dupes = 0
  for (let q = 1; q <= 400; q++) {
    const hits = bands.filter(b => q >= b[0] && q <= b[1]).length
    if (hits === 0) holes++
    if (hits > 1) dupes++
  }
  ok(`T:${g} every qty 1-400 lands in exactly one band`, holes === 0 && dupes === 0,
     `${holes} holes, ${dupes} overlaps`)
  // Prices must descend as quantity rises — a ladder that goes up is a typo.
  const prices = bands.map(b => b[2])
  ok(`T:${g} prices never rise with quantity`,
     prices.every((p, i) => i === 0 || p <= prices[i - 1]),
     JSON.stringify(prices))
}

// The "from $X" chip reads the LAST band by index. If someone re-pins it to a
// fixed position it silently shows the wrong tier when band count changes.
ok('T9 from-price chip reads the last band, not a fixed index',
   /tier\[tier\.length - 1\]\[2\]/.test(html))

console.log(`\n${pass} passed, ${fails.length} failed`)
if (fails.length) { fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1) }
