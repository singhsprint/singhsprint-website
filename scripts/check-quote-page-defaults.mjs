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

// ── 2. blanks before quantity ──────────────────────────────────────────
console.log('2. blanks are chosen before quantity')
for (const page of ['quote.html', 'fr/quote.html']) {
  const html = read(page)
  const tier = html.indexOf('id="tierBlanksSection"')
  const qty  = html.indexOf('id="qtyBandSection"')
  ok(`2a ${page}: both sections present`, tier > -1 && qty > -1)
  ok(`2b ${page}: tier cards come BEFORE the quantity bands`, tier > -1 && qty > -1 && tier < qty,
     `tier@${tier} qty@${qty}`)
}
// The gate that used to hide every card until a band was picked.
ok('2c tier cards no longer bail out when no band is chosen',
   !/if \(!spQtyBand\) \{ host\.style\.display = 'none'; host\.innerHTML = ''; return; \}/.test(js))
ok('2d bandQty tolerates a missing band',
   /var bandQty = spQtyBand \? spQtyBand\.qty : null/.test(js))
// Without a band the card must keep its "From $X" floor.
ok('2e the From-price string is still built',
   /spTierT\('quote\.tiers\.from', 'From'\)/.test(js))
ok('2f repricing is gated on an actual band',
   /if \(bandQty\) \{/.test(js))
// Every spQtyBand read inside the renderer must be null-safe now.
const body = js.slice(js.indexOf('function spRenderTierCards'), js.indexOf('function spApplyTierPick'))
// Line-aware: a property read is fine when the SAME line carries the guard.
// Matching the bare access caught `spQtyBand ? spQtyBand.qty : null`, which is
// exactly the safe form — the assertion, not the code, was wrong.
const unsafe = body.split('\n')
  .filter(l => /spQtyBand\.[a-zA-Z]/.test(l))
  .filter(l => !/spQtyBand\s*\?/.test(l) && !/spQtyBand\s*&&/.test(l))
  .map(l => l.trim())
ok('2g every spQtyBand dereference in the renderer is guarded', unsafe.length === 0,
   `unguarded: ${JSON.stringify(unsafe)}`)
ok('2h the under-5 note is null-guarded',
   /if \(spQtyBand && spQtyBand\.id === 'u5'\)/.test(js))
// The reveal walk must follow the new DOM order or it scrolls past the cards.
ok('2i the scroll walk goes to the tier cards first',
   /spScrollTo\(tierChoicePending\(\) \? secEl\('tier'\)/.test(js))
ok('2j …and only then to the quantity chips',
   /tierChoicePending\(\) \? secEl\('tier'\)\s*\n\s*: \(qtyChoicePending\(\) \? secEl\('qtyband'\)/.test(js))

// ── 5. the tier cards and qty chips are actually interactive ───────────
console.log('5. interaction lives in CSS, not inline styles')
const css = read('quote.css')
// Inline styles outrank the stylesheet, so state written inline makes :hover
// unreachable. That is why these two controls felt dead.
ok('5a tier cards carry no inline style attribute',
   !/class="tier-card[^"]*"[^>]*style=/.test(js) &&
   !/'<button type="button" class="tier-card[\s\S]{0,80}?style="/.test(js))
ok('5b qty chips carry no inline style attribute',
   !/'<button type="button" class="qty-band[\s\S]{0,120}?style="/.test(js))
ok('5c selection is a class, not an inline border',
   /is-selected/.test(js) && /\.tier-card\.is-selected\{/.test(css) && /\.qty-band\.is-selected\{/.test(css))
for (const [sel, label] of [['.tier-card', 'tier card'], ['.qty-band', 'qty chip']]) {
  ok(`5d ${label} has a hover state`, new RegExp(sel.replace('.', '\\.') + ':hover\\{').test(css))
  ok(`5e ${label} has a pressed state`, new RegExp(sel.replace('.', '\\.') + ':active\\{').test(css))
  ok(`5f ${label} has a keyboard focus ring`, new RegExp(sel.replace('.', '\\.') + ':focus-visible\\{').test(css))
  ok(`5g ${label} animates`, new RegExp(sel.replace('.', '\\.') + '\\{[^}]*transition:').test(css))
}
ok('5h movement is dropped under prefers-reduced-motion',
   /@media \(prefers-reduced-motion: reduce\)/.test(css) &&
   /prefers-reduced-motion[\s\S]{0,400}?transform:none/.test(css))
ok('5i selection is exposed to assistive tech', /aria-pressed="/.test(js))

// ── 6. quantity bands come from the engine ─────────────────────────────
console.log('6. quantity bands are the engine\'s, not a literal')
ok('6a bands are derived per garment and method',
   /function spQtyBandsFor\(garmentKey, method\)/.test(js) &&
   /spLadderFor\(garmentKey/.test(js))
ok('6b they are re-derived on every render',
   /SP_QTY_BANDS = spQtyBandsFor\(garmentKey/.test(js))
ok('6c each band probes at its own minimum',
   /qty:\s*t\.min/.test(js))
// The literal survives only as a pre-load fallback, and must itself be right.
ok('6d the surviving literal is named a fallback',
   /SP_QTY_BANDS_FALLBACK/.test(js) && !/var SP_QTY_BANDS = \[/.test(js))
ok('6e the fallback no longer carries the 250 boundary',
   !/label: '100–249'/.test(js) && !/label: '250\+'/.test(js))
ok('6f the fallback matches the engine: 100–199 then 200+',
   /label: '100–199'/.test(js) && /label: '200\+'/.test(js))
// Ids are derived now, so anything that pinned a literal id had to move.
ok('6g "most popular" is pinned by quantity, not by a literal id',
   /var popular = b\.qty === 25/.test(js))
ok('6h the savings baseline is the cheapest real band, not a named one',
   /var baselineId = numeric\.length \? numeric\[0\]\.id : null/.test(js))
// A saved draft stores the band id; old ids must still land somewhere.
ok('6i a draft saved under an old band id still restores',
   /if \(!band && \/\^b\\d\+\$\/\.test\(String\(bandId/.test(js))

console.log(`\n${pass} passed, ${fails.length} failed`)
if (fails.length) { fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1) }
