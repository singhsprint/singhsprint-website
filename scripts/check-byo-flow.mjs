#!/usr/bin/env node
/**
 * check-byo-flow.mjs
 *
 * The Bring-Your-Own-garment panel quotes a price for work on garments we
 * never sold. Everything it shows is a number the shop has to honour, and the
 * three ways it got that wrong were all invisible on the page:
 *
 *   1. A cart holding one priced line and one unpriceable one showed a "Total"
 *      built by dividing the known unit prices by the number of LINES and
 *      multiplying by every PIECE. Measured on the live site: a $647.50
 *      embroidery line plus a "Not sure" line displayed $518.00 — less than
 *      the one line we could price.
 *   2. Dropping an embroidery line below the five-piece minimum kept the
 *      50-piece rate and multiplied it by the new quantity: "$12.95/garment ·
 *      subtotal $38.85" for a job the engine refuses to quote at all.
 *   3. Nothing stopped an unquotable line being added in the first place —
 *      embroidery under the minimum, or 99,999 pieces against an input whose
 *      max="10000" was never enforced.
 *
 * These are structural assertions over quote.js. The behaviour itself is
 * covered by the BYO browser checks, which drive the real panel; this is the
 * cheap guard that fails in CI if the shapes they depend on are edited away.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'quote.js')
const raw = readFileSync(SRC, 'utf8')
const css = readFileSync(join(ROOT, 'quote.css'), 'utf8')
const code = raw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

const problems = []
const ok = (name, cond, detail = '') => {
  if (cond) console.log('  ok  ' + name)
  else { problems.push(name + (detail ? ' — ' + detail : '')); console.log('  FAIL ' + name) }
}

// ── 1. the partial total ───────────────────────────────────────────────────
const partial = code.slice(code.indexOf('} else if (cartLineTotal > 0) {'),
                           code.indexOf('} else if (cartLineTotal > 0) {') + 1600)
ok('A1 a partially-priced cart has its own branch', partial.length > 100)
ok('A2 its figure is the sum of the priced lines, not an average',
   /livePriceTotal'\)\.textContent\s*=\s*\n?\s*'\$' \+ \(cartLineTotal \+ sur\.surchargeTotal\)/.test(partial),
   'the total must be cartLineTotal, the only number every line agreed to')
ok('A3 avgUnitPrice never reaches the total',
   !/avgUnitPrice\s*\*\s*effectiveUnits/.test(code),
   'this is the expression that produced $518 for a $647.50 cart')
ok('A4 it counts what is missing', /pendingLines/.test(partial))
ok('A5 and relabels the figure so it cannot read as the whole job',
   /spSetTotalLabel\(true\)/.test(partial))
ok('A6 the fully-priced branch puts the label back', /spSetTotalLabel\(false\)/.test(code))

// ── 2. a refused line must lose its price ──────────────────────────────────
ok('B1 there is one place that clears a refused line', /function spByoRowUnpriced\(/.test(code))
const cleared = code.slice(code.indexOf('function spByoRowUnpriced('),
                           code.indexOf('function spByoRowUnpriced(') + 1200)
ok('B2 it clears the item', /it\.byo_unit_price = null/.test(cleared))
ok('B3 it clears what was persisted — a re-render reads storage, not the item',
   /delete c\.items\[idx\]\.byo_unit_price/.test(cleared))
ok('B4 it clears the row on screen', /getElementById\('ci-price-' \+ idx\)/.test(cleared))
ok('B5 both failure paths go through it',
   (code.match(/spByoRowUnpriced\(idx, it\)/g) || []).length >= 3,
   'the json-failure path, the catch, and the local refusal')
ok('B6 a sub-minimum row is refused locally, not after a round trip',
   /if \(spByoBelowEmbMin\(qty, method\)\) \{ spByoRowUnpriced/.test(code),
   'otherwise the old price stays on screen for the length of the request')

// ── 3. nothing unquotable gets added ───────────────────────────────────────
const add = code.slice(code.indexOf('function spByoLineAdd('),
                       code.indexOf('function spByoLineAdd(') + 2200)
ok('C1 the add button gates on the embroidery minimum', /spByoBelowEmbMin\(qty, spByoMethod\)/.test(add))
ok('C2 and on the quantity ceiling the input advertises', /qty > BYO_QTY_MAX/.test(add))
ok('C3 the ceiling matches the input', /BYO_QTY_MAX = 10000/.test(add) && /max="10000"/.test(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'quote.html'), 'utf8')))
ok('C4 the builder says why before you press it', /spByoMinNote\(/.test(code))
ok('C5 the minimum comes from the engine here too',
   /spByoBelowEmbMin[\s\S]{0,220}SP_EMB_MIN\(\)/.test(code))

// ── 4. sides, sizes, and no paying for what we have not seen ───────────────
ok('D1 the builder offers placements', /SP_BYO_PLACEMENTS\s*=\s*\[/.test(code))
ok('D2 the price call carries them', /placements=' \+ encodeURIComponent\(pl\.join\(','\)\)/.test(code))
// Scoped to the BYO add: a catalog line's `sides: 1` is deliberate (its
// read() migration derives a garment-aware default placement from it), so a
// file-wide ban on that literal fails on correct code elsewhere.
ok('D3 sides follows the placement count, never a hardcoded 1',
   /sides:\s*Math\.max\(1, spByoPlacements\.length\)/.test(add) && !/sides:\s*1,/.test(add))
ok('D4 the cart row re-prices with its own placements', /pls\.length \? '&placements='/.test(code))
ok('D5 embroidery cannot be put somewhere we do not stitch',
   /spByoPrunePlacements/.test(code) && /EMB_DISALLOWED\[d\.id\]/.test(code))
ok('D6 a BYO row takes the same size grid as every other line',
   /renderCartItemSizes\(idx, it\.sizes \|\| \{\}, qty, it\)/.test(code))
ok('E1 Pay Now is switched off while the cart holds our customer\'s own garments',
   /function spByoSyncPayButtons\(/.test(code))
ok('E2 it runs on every cart render, not just when a total is drawn',
   /function renderCartList\(\)\s*\{\s*\n\s*(?:\/\/[^\n]*\n\s*)*spByoSyncPayButtons\(\)/.test(code),
   'updateCartTotal returns early on an empty cart, so removing the last BYO line left the button dead')
ok('E3 the click guard is still there as the backstop',
   /it\.is_byo[\s\S]{0,120}quote\.byoline\.nocheckout/.test(code))

// ── F. the placement row has to lay out as a grid ──────────────────────────
// .svc-btn carries flex:1, which is right for three method buttons and wrong
// for five placements: measured in Chromium at 1280px, the four that fit came
// out 152px each and the wrapped "Sleeve" stretched to 638px. And the mobile
// rule .service-row{flex-direction:column} turned the five chips into five
// full-width boxes stacked down a 390px screen. With the grid: 5 x 121px on
// one row at 1280, 3 + 2 at 860, 3 + 2 at 390, every chip the same size.
ok('F1 the placement row is a grid, not the method row\'s flex',
   /#byoPlacementRow\{[^}]*display:grid/.test(css),
   'flex:1 stretches the one wrapped chip across the full row')
ok('F2 it names its own column count instead of letting chips wrap',
   /#byoPlacementRow\{[^}]*grid-template-columns:repeat\(5,\s*1fr\)/.test(css))
ok('F3 and narrow screens get fewer columns, not five stacked boxes',
   /@media[^{]*max-width:\s*860px[^{]*\{\s*#byoPlacementRow\{[^}]*grid-template-columns:repeat\(3,\s*1fr\)/.test(css))
ok('F4 the chips may shrink below .svc-btn\'s 120px floor',
   /#byoPlacementRow \.svc-btn\{[^}]*min-width:0/.test(css))

if (problems.length) {
  console.error(`\ncheck-byo-flow: ${problems.length} problem(s)\n`)
  for (const p of problems) console.error('  - ' + p + '\n')
  process.exit(1)
}
console.log('\ncheck-byo-flow: OK — no fabricated totals, no stale prices, nothing unquotable added.')
