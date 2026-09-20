/**
 * Quote-page structure + disclosure defaults.
 *
 * These are one-line behaviours that a later edit flips without anyone
 * noticing, because nothing fails — the page still renders, just wrong.
 *
 *   1. "Bring Your Own" is NOT a product type. It lives in its own block
 *      below the grid. Its markup must stay byte-compatible with
 *      selectProduct(): same classes, same data-garment, same onclick.
 *   3. The per-item tier-pricing ladder is CLOSED until asked for.
 *   4. The per-item placement picker is OPEN until dismissed.
 *
 * Run: node scripts/check-quote-page-defaults.mjs
 */
import { readFileSync } from 'node:fs'

let pass = 0
const fails = []
const ok = (id, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok  ${id}`) }
  else { fails.push(id); console.log(`FAIL  ${id}${detail ? ' — ' + detail : ''}`) }
}
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const js = read('quote.js')

// ── 1. BYO placement ───────────────────────────────────────────────────
console.log('1. Bring Your Own is its own question')
for (const page of ['quote.html', 'fr/quote.html']) {
  const html = read(page)
  const grid = html.match(/<div class="product-grid">([\s\S]*?)\n {14}<\/div>/)
  ok(`1a ${page}: product grid parsed`, !!grid)
  if (!grid) continue
  ok(`1b ${page}: BYO is NOT in the product grid`,
     !grid[1].includes('product-option--byo'))
  ok(`1c ${page}: grid holds exactly 10 product types`,
     (grid[1].match(/class="product-option/g) || []).length === 10,
     `got ${(grid[1].match(/class="product-option/g) || []).length}`)
  ok(`1d ${page}: standalone BYO block exists`,
     /<div class="form-group byo-standalone">/.test(html))
  // The markup contract selectProduct() depends on. If any of these drift the
  // tile stops being deselected, stops highlighting, or stops routing to the
  // line builder — all silently.
  const card = html.match(/<div class="product-option product-option--byo"[^>]*>/)
  ok(`1e ${page}: BYO card still carries .product-option`, !!card)
  ok(`1f ${page}: still data-garment="byo" (routes to the line builder)`,
     !!card && /data-garment="byo"/.test(card[0]))
  ok(`1g ${page}: still onclick="selectProduct(this)"`,
     !!card && /onclick="selectProduct\(this\)"/.test(card[0]))
  ok(`1h ${page}: BYO card sits INSIDE the standalone block`,
     html.indexOf('byo-standalone') < html.indexOf('product-option--byo'))
  ok(`1i ${page}: exactly one BYO card on the page`,
     (html.match(/product-option--byo/g) || []).length === 1)
  // Every tile, not just BYO. selectProduct() is the only thing that sets
  // state.garment; a tile wired to anything else silently prices as whatever
  // was selected before it.
  const tiles = html.match(/<div class="product-option[^>]*>/g) || []
  ok(`1j ${page}: all ${tiles.length} product tiles call selectProduct`,
     tiles.length === 11 && tiles.every(t => /onclick="selectProduct\(this\)"/.test(t)),
     `${tiles.filter(t => !/onclick="selectProduct\(this\)"/.test(t)).length} tile(s) wired elsewhere`)
  ok(`1k ${page}: every tile declares a data-garment`,
     tiles.every(t => /data-garment="[a-z]+"/.test(t)))
}
ok('1m selectProduct still routes byo to the line builder',
   /el\.dataset\.garment === 'byo'\s*\)\s*\{\s*spShowByoLineBuilder\(\)/.test(js))
ok('1n .byo-standalone is styled', /\.byo-standalone/.test(read('quote.css')))

// ── 3. tier ladder closed ──────────────────────────────────────────────
console.log('3. tier-pricing ladder defaults closed')
const details = js.match(/'<details style="margin-top:4px"[^']*'/)
ok('3a the tier-pricing <details> is present', !!details)
ok('3b it does NOT open by default',
   !!details && !/\bopen\b/.test(details[0]), details && details[0])
ok('3c no viewport-conditional open survives',
   !/isMobile \? '' : 'open'/.test(js))
ok('3d the summary still says what is behind it',
   /Tier pricing for this item/.test(js))

// ── 4. placement picker open ───────────────────────────────────────────
console.log('4. placement picker defaults open')
ok('4a open-by-default model (tracks CLOSED rows)',
   /var _cartPickerClosedIdx = new Set\(\)/.test(js))
ok('4b the old open-index model is gone',
   !/var _cartPickerOpenIdx/.test(js))
ok('4c a row renders open unless it was closed',
   /var pickerOpen = !_cartPickerClosedIdx\.has\(idx\)/.test(js))
ok('4d toggling adds/removes from the closed set',
   /_cartPickerClosedIdx\.delete\(idx\)/.test(js) &&
   /_cartPickerClosedIdx\.add\(idx\)/.test(js))
// The interaction bug that open-by-default introduces if unguarded.
ok('4e "+ Add placement" is hidden while the picker is open',
   /var addBtn = pickerOpen\s*\n\s*\? ''/.test(js))
ok('4f the picker still offers a way to dismiss it',
   /ci-picker__close[^>]*>Done</.test(js))

console.log(`\n${pass} passed, ${fails.length} failed`)
if (fails.length) { fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1) }
