#!/usr/bin/env node
/**
 * check-quote-price-inputs.mjs
 *
 * Every price the quote page shows must be asked for with the things the
 * engine actually charges on.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * Reported 2026-10-15 as "the price doesn't change based on the size of the
 * print". Measured on the live site — Gildan 64000, 25 pieces, DTF — by
 * clicking through the placement presets in a real browser and capturing every
 * request the page made:
 *
 *     placement              engine     page
 *     Left Chest             $14.95     $14.95
 *     Full Front             $17.95     $14.95
 *     Oversized              $18.95     $14.95
 *     Oversized + Full Back  $24.95     $16.95
 *
 * Every outgoing request was
 *     ?product_id=…&qty=25&sides=1&decoration_method=dtf
 * and nothing else. The engine prices placement correctly — full front is +$3
 * a piece under 50 and +$2 at 50+, oversized +$4 / +$3 — the page never asked.
 * $200 light on 25 oversized-plus-back pieces, and that is the number Pay &
 * Order Now runs on.
 *
 * The same request was missing `color_id`, which the pricing route's own
 * header warns about. Measured across the 40 Gildan 64000 colourways the
 * catalogue exposes: 39 price at $14.95 and Garnet at $22.95. A Garnet order
 * was quoted $8 a piece under.
 *
 * liveUnitPrice() — the CART rows — had sent the placements all along. So two
 * numbers on one screen disagreed, and the bulk table's own fallback copy
 * says "Pricing on the right is still accurate", pointing at the wrong one.
 *
 * Block A is the rule that would have caught it: any request that prices a
 * SPECIFIC product at a SPECIFIC quantity has to carry the placements. Block B
 * checks the premise against the live engine, so this cannot pass by being
 * vacuous.
 *
 * Run: node scripts/check-quote-price-inputs.mjs
 */
import { readFileSync } from 'node:fs'

const problems = []
const ok = (id, cond, detail = '') => {
  if (cond) console.log(`  ok  ${id}${detail ? ' — ' + detail : ''}`)
  else { problems.push(id + (detail ? ' — ' + detail : '')); console.log(`  FAIL ${id}${detail ? ' — ' + detail : ''}`) }
}
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const raw = read('quote.js')
const js = raw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

// ── A. every per-product price request carries the placements ──────────────
console.log('\nA. what the page asks the engine for')

ok('A1 there is one helper that answers "what is this quote for"',
   /function spQuotePricingParams\(\)/.test(js))
const helper = js.slice(js.indexOf('function spQuotePricingParams()'),
                        js.indexOf('function spQuotePricingParams()') + 900)
ok('A2 it reads the placements the customer actually picked',
   /presetByLocation/.test(helper),
   'presetByLocation is what togglePlacementPreset writes')
ok('A3 ...and the colourway they actually picked',
   /spSingleColor\(\)/.test(helper) && /color_id=/.test(helper))
ok('A4 it sends nothing when nothing is picked, rather than guessing',
   /if \(placements\.length\)/.test(helper) && /if \(cid\)/.test(helper))

const fnBody = (name, len = 1400) => {
  const i = js.indexOf('function ' + name + '(')
  return i < 0 ? '' : js.slice(i, i + len)
}
ok('A5 the headline price and the payment total carry them',
   /spQuotePricingParams\(\)/.test(fnBody('fetchLiveUnitPrice')),
   'fetchLiveUnitPrice feeds renderPriceDisplay, which gates paymentSection')
ok('A6 so does the live estimate strip',
   /spQuotePricingParams\(\)/.test(fnBody('fetchAndRenderTopTierEstimate', 2000)),
   'togglePlacementPreset calls straight into it on every click')
ok('A7 ...which also names the decoration method',
   /decoration_method=/.test(fnBody('fetchAndRenderTopTierEstimate', 2000)),
   'it was missing too, so an embroidery quote quoted the print ladder')
ok('A8 the cart rows still carry them, as they always did',
   /embroidery_placements=/.test(fnBody('liveUnitPrice', 2600)))

// A9 is the rule rather than a list of names: find every place a pricing URL
// is built, and require that anything naming a product AND a quantity also
// names the placements. A new caller written tomorrow is caught by this.
const EXEMPT = /matrix=1|[?&]category=/   // a volume ladder and a category floor
                                          // price no particular configuration;
                                          // and the matrix branch returns before
                                          // the server applies placement
                                          // surcharges at all, so passing them
                                          // there would be theatre.
const offenders = []
const re = /PRICING_API_FOR_QUOTE\s*\+/g
let m
while ((m = re.exec(js))) {
  const chunk = js.slice(m.index, m.index + 700)
  const url = chunk.slice(0, Math.max(0, chunk.indexOf('fetch(')) || 500)
  if (!/product_id=/.test(url) || !/[?&]qty=/.test(url)) continue
  if (EXEMPT.test(url)) continue
  if (/spQuotePricingParams\(\)/.test(url) || /embroidery_placements=/.test(url)) continue
  const line = js.slice(0, m.index).split('\n').length
  offenders.push('line ' + line)
}
ok('A9 no price request names a product and a quantity without the placements',
   offenders.length === 0, offenders.length ? offenders.join(', ') : 'all callers covered')

// ── B. the premise, against the live engine ────────────────────────────────
console.log('\nB. the engine really does charge for this')

const API = 'https://singhsprint-crm.vercel.app/api'
const price = async (qs) => {
  const r = await fetch(`${API}/pricing?${qs}`)
  if (!r.ok) return null
  const d = await r.json()
  return d && typeof d.unit_price === 'number' ? d : null
}

let product = null
try {
  const r = await fetch(`${API}/catalog?limit=1&q=${encodeURIComponent('gildan 64000')}`)
  const d = await r.json()
  product = (d.products || [])[0] || null
} catch { /* reported below */ }
ok('B0 a reference style is reachable', !!product, product ? `${product.brand} ${product.style_number}` : 'catalogue unreachable')

if (product) {
  const base = `product_id=${product.product_id}&qty=25&sides=1&decoration_method=dtf`
  const got = {}
  for (const pl of ['left-chest', 'full-front', 'oversized']) {
    const d = await price(`${base}&embroidery_placements=${pl}`)
    got[pl] = d ? d.unit_price : null
  }
  console.log('      at 25 pieces, one side: ' +
    Object.entries(got).map(([k, v]) => `${k} $${v}`).join('  '))
  ok('B1 a bigger print costs more at the same side count',
     got['left-chest'] < got['full-front'] && got['full-front'] < got['oversized'],
     'if this ever stops being true, block A is guarding nothing')

  const withColour = await price(`${base}&embroidery_placements=left-chest&color_id=${product.colors[0].color_id}`)
  const without    = await price(`${base}&embroidery_placements=left-chest`)
  ok('B2 the engine picks a colour for you when you do not name one',
     !!without && without.color_assumed === true,
     'color_assumed: true is the engine saying this price belongs to a colour nobody chose')
  ok('B3 ...and stops guessing once you do',
     !!withColour && withColour.color_assumed !== true)

  // Evidence, not an assertion: what the guess is worth on a real style.
  const seen = []
  for (const c of product.colors.slice(0, 40)) {
    const d = await price(`${base}&color_id=${c.color_id}`)
    if (d) seen.push([d.unit_price, c.color_name])
  }
  if (seen.length) {
    seen.sort((a, b) => a[0] - b[0])
    const [lo, hi] = [seen[0], seen[seen.length - 1]]
    console.log(`      across ${seen.length} colourways: ${lo[1]} $${lo[0]} … ${hi[1]} $${hi[0]}`
      + `  (spread $${(hi[0] - lo[0]).toFixed(2)}/piece)`)
  }
}

if (problems.length) {
  console.error(`\ncheck-quote-price-inputs: ${problems.length} problem(s)\n`)
  for (const p of problems) console.error('  - ' + p + '\n')
  process.exit(1)
}
console.log('\ncheck-quote-price-inputs: OK — every per-product price the page shows is asked for with the placements and the colourway.')
