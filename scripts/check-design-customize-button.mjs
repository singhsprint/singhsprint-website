/**
 * The "Customize" button on a cart row's uploaded-design card.
 *
 * It opens the mockup editor ON THAT DESIGN'S TAB and puts the customer back
 * on the garment when they close it. Three things make it work and each one
 * fails silently if it drifts:
 *
 *   1. The card is a <label for="design_…">. ANY control inside it opens the
 *      file picker unless the click is stopped — so the button must carry
 *      preventDefault + stopPropagation, exactly like Remove always has.
 *   2. spOpenCustomizer must honour startPlacement, and must fall back to tab
 *      0 when the placement is absent or has no art, or a stale id opens an
 *      empty editor.
 *   3. close() restores the pre-open scroll position with window.scrollTo, so
 *      the "back to the garment" scroll has to run AFTER it. That is why it
 *      hangs off an onClose hook rather than the call site.
 *
 * Run: node scripts/check-design-customize-button.mjs
 */
import { readFileSync } from 'node:fs'

let pass = 0
const fails = []
const ok = (id, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok  ${id}`) }
  else { fails.push(id); console.log(`FAIL  ${id}${detail ? ' — ' + detail : ''}`) }
}
const ROOT = new URL('../', import.meta.url).pathname
const js  = readFileSync(ROOT + 'quote.js', 'utf8')
const css = readFileSync(ROOT + 'quote.css', 'utf8')

console.log('A. the button exists on the card')
ok('A1 rendered only when the card HAS art',
   /\(has \? '<button type="button" class="ci-upload__customize"/.test(js))
ok('A2 it calls cartCustomizePlacement with the row AND the placement',
   /cartCustomizePlacement\(' \+ idx \+ ',\\'' \+ p \+ '\\'\)/.test(js))
// The label trap. Without both guards the button uploads a file instead.
const btn = js.match(/<button type="button" class="ci-upload__customize"[^>]*>/)
ok('A3 the click is stopped from reaching the <label>', !!btn &&
   /event\.preventDefault\(\)/.test(btn[0]) && /event\.stopPropagation\(\)/.test(btn[0]))
ok('A4 Remove still carries the same guards',
   /class="ci-upload__remove" onclick="event\.preventDefault\(\);event\.stopPropagation\(\);/.test(js))
ok('A5 the button is styled', /\.ci-upload__customize\{/.test(css))

console.log('B. it opens the editor on the right design')
ok('B1 cartCustomizePlacement exists and is reachable from inline HTML',
   /function cartCustomizePlacement\(idx, placementId\)/.test(js) &&
   /window\.cartCustomizePlacement = cartCustomizePlacement/.test(js))
ok('B2 it refuses without a colour (a mockup needs the garment colour)',
   /function cartCustomizePlacement[\s\S]{0,400}?if \(!it\.color_id\)[\s\S]{0,200}?return/.test(js))
ok('B3 it forwards the placement to the launcher',
   /spLaunchCartCustomizer\(idx, placementId\)/.test(js))
ok('B4 the launcher takes a startPlacement',
   /function spLaunchCartCustomizer\(idx, startPlacement\)/.test(js))
ok('B5 …and passes it to the customizer',
   /startPlacement: startPlacement \|\| null/.test(js))
ok('B6 the customizer opens on that tab',
   /var active = \(function \(\) \{[\s\S]{0,400}?placements\.indexOf\(want\)/.test(js))
// A stale or art-less placement must not open an empty tab.
ok('B7 it falls back to tab 0 when the placement is absent or has no art',
   /return \(i >= 0 && hasArt\(want\)\) \? i : 0/.test(js))
ok('B8 no startPlacement still means tab 0',
   /if \(!want\) return 0/.test(js))

console.log('C. it brings them back to the garment')
ok('C1 the customizer runs an onClose hook',
   /if \(typeof opts\.onClose === 'function'\)/.test(js))
// Ordering is the whole point: close() calls window.scrollTo to restore the
// pre-open position, so a scroll fired before that is undone.
const closeFn = js.slice(js.indexOf('      function close() {'))
const scrollAt = closeFn.indexOf('window.scrollTo(0, _lockY)')
const hookAt   = closeFn.indexOf('opts.onClose')
ok('C2 onClose fires AFTER the scroll restore, or it would be undone',
   scrollAt > -1 && hookAt > -1 && hookAt > scrollAt,
   `scrollTo@${scrollAt} onClose@${hookAt}`)
ok('C3 the cart launcher scrolls back to the row',
   /onClose: function \(\) \{[\s\S]{0,400}?\.cart-item\[data-idx="' \+ idx \+ '"\]/.test(js))
ok('C4 it anchors on the row, which survives the re-render',
   /document\.querySelector\('\.cart-item\[data-idx=/.test(js))
ok('C5 the row actually carries that attribute',
   /'<div class="cart-item" data-idx="' \+ idx \+ '"/.test(js))
ok('C6 the row-level Customize button still works with no placement',
   /onclick="spLaunchCartCustomizer\(' \+ idx \+ '\)"/.test(js))

console.log(`\n${pass} passed, ${fails.length} failed`)
if (fails.length) { fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1) }
