/**
 * check-catalog-reprice.mjs
 *
 * Asserts that a catalogue card which is REUSED across a quantity change ends
 * up saying what a freshly built one would.
 *
 * WHY THIS EXISTS. Changing "Pricing for" greyed the whole grid out and it
 * never came back. Two things had to be true at once:
 *
 *   setQty() dims every `.price` to opacity .4 and refetches. The dimming was
 *   only ever undone by the card being REBUILT — which is what render() did
 *   when it was `grid.innerHTML = ''`.
 *
 *   reconcileGrid reuses a node whenever the product id matches, and a
 *   quantity change never changes a product id. So every card in the grid was
 *   reused, and every card kept the markup it was built with.
 *
 * Measured on production at the 50 -> 100 switch, three cards deep:
 *
 *   after clicking 100:  node identity unchanged, style.opacity "0.4"
 *                        From $19.95 / $13.95 / $19.95   <- the qty-50 prices
 *   fresh load ?qty=100: From $17.95 / $11.95 / $17.95   <- the truth
 *
 * It did not just look stuck. It quoted two dollars a unit over the engine's
 * price, greyed, until the page was reloaded.
 *
 * The assertions are numeric and use those measured figures. The last family
 * is structural, because the two halves of this fix are individually correct
 * and useless unless they are wired to each other.
 *
 * Exit 0 = pass, 1 = fail.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC  = join(HERE, '..', 'catalog.js')

const problems = []
function eq(label, got, expected) {
  const g = JSON.stringify(got), e = JSON.stringify(expected)
  if (g !== e) problems.push(`${label}\n      got:      ${g}\n      expected: ${e}`)
}
function ok(label, cond) { if (!cond) problems.push(label) }

const rawSrc = readFileSync(SRC, 'utf8')

// Comments are prose, not code. Every source scan below runs on stripped
// text — this file's own explanations name the very identifiers it searches
// for, and priceLockup's doc comment says the words "state.qty" while the
// function deliberately takes qty as a parameter.
function strip(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}


// ---------------------------------------------------------------------------
// Load the real functions out of the real file.
// ---------------------------------------------------------------------------
function loadLockup() {
  const a = rawSrc.indexOf('// ===== SP_PRICE_LOCKUP_START')
  const b = rawSrc.indexOf('// ===== SP_PRICE_LOCKUP_END')
  if (a < 0 || b < 0 || b < a) {
    console.error('check-catalog-reprice: SP_PRICE_LOCKUP markers not found in catalog.js')
    process.exit(1)
  }
  const body = rawSrc.slice(a, b)
  for (const name of ['priceLockup', 'priceCellHtml', 'repriceCard']) {
    if (!new RegExp('function ' + name + '\\s*\\(').test(body)) {
      console.error(`check-catalog-reprice: ${name} not inside the markers`)
      process.exit(1)
    }
  }
  // A reprice that reads state.qty itself would be untestable here AND would
  // reintroduce the bug's shape: two places deciding what quantity means.
  const code = strip(body)
  for (const forbidden of ['state.', 'document.', 'window.']) {
    if (code.includes(forbidden)) problems.push(`the price block reaches outside its arguments: ${forbidden}`)
  }
  return new Function(body + '\n; return { priceLockup, priceCellHtml, repriceCard };')()
}

const { priceCellHtml, repriceCard } = loadLockup()

// The three products measured on production, at both quantities.
const AT_50  = [
  { id: 'ad36e774', price_from: 19.95, prices_by_qty: { 1: 30.95 }, weight_oz: 4.2 },
  { id: 'd9ae026b', price_from: 13.95, prices_by_qty: { 1: 24.95 } },
  { id: '4db7b6ec', price_from: 19.95, prices_by_qty: { 1: 30.95 } },
]
const AT_100 = [
  { id: 'ad36e774', price_from: 17.95, prices_by_qty: { 1: 30.95 }, weight_oz: 4.2 },
  { id: 'd9ae026b', price_from: 11.95, prices_by_qty: { 1: 24.95 } },
  { id: '4db7b6ec', price_from: 17.95, prices_by_qty: { 1: 30.95 } },
]

/** A card just real enough: one `.price` cell with an innerHTML and a style. */
function fakeCard(product, qty) {
  const cell = { innerHTML: priceCellHtml(product, qty), style: { opacity: '' } }
  return { querySelector: (sel) => (sel === '.price' ? cell : null), cell }
}

/** The figures a card is actually showing. */
function shown(card) {
  return (card.cell.innerHTML.match(/\$\d+\.\d\d/g) || [])
}

// ── The bug, reproduced and then required not to happen ────────────────────
{
  // Build the grid at 50, dim it the way setQty does, then reprice at 100.
  const cards = AT_50.map((p) => fakeCard(p, 50))
  eq('a card built at qty 50 shows the qty-50 price', shown(cards[0])[0], '$19.95')
  for (const c of cards) c.cell.style.opacity = '.4'

  cards.forEach((c, i) => repriceCard(c, AT_100[i], 100))

  eq('after repricing, card 1 shows the qty-100 price', shown(cards[0])[0], '$17.95')
  eq('…card 2', shown(cards[1])[0], '$11.95')
  eq('…card 3', shown(cards[2])[0], '$17.95')
  eq('no card is left showing a qty-50 price',
    cards.filter(c => /\$(19|13)\.95\b/.test(c.cell.innerHTML)).length, 0)
  eq('and the dimming setQty painted on is cleared',
    cards.map(c => c.cell.style.opacity), ['', '', ''])
}

// ── A reused card must be indistinguishable from a fresh one ───────────────
// The point of the update path is that reuse costs nothing in correctness.
// Comparing against a FRESH BUILD rather than against an expected string is
// what makes this survive future changes to the lockup: anything the update
// path forgets to carry over shows up here without the assertion being
// rewritten.
for (const qty of [1, 4, 5, 10, 25, 50, 100, 200, 500]) {
  const reused = fakeCard(AT_50[0], 50)
  repriceCard(reused, AT_100[0], qty)
  const fresh = fakeCard(AT_100[0], qty)
  eq(`a reused card at qty ${qty} renders exactly what a fresh one does`,
    reused.cell.innerHTML, fresh.cell.innerHTML)
}

// A product whose price the engine will not give still has to stop being dim,
// or an unpriced card is frozen at .4 forever.
{
  const c = fakeCard(AT_50[0], 50)
  c.cell.style.opacity = '.4'
  repriceCard(c, { id: 'ad36e774', price_from: null }, 100)
  eq('an unpriced product still clears the dimming', c.cell.style.opacity, '')
  ok('…and the weight the card carries survives a reprice',
    /4\.2 oz/.test(fakeCard(AT_100[0], 100).cell.innerHTML))
  ok('…and says so rather than keeping the stale figure',
    /quote-on-request/.test(c.cell.innerHTML) && !/\$19\.95/.test(c.cell.innerHTML))
}

// A card with no price cell at all must not throw — that would abort the whole
// reconcile pass mid-grid and leave the page half drawn.
{
  let threw = null
  try { repriceCard({ querySelector: () => null }, AT_100[0], 100) } catch (e) { threw = String(e) }
  eq('a card without a price cell is skipped, not thrown on', threw, null)
}

// ── Structural: the two halves must actually be connected ──────────────────
// Self-test the stripper before trusting it: this file's own comments name
// repriceCard, updateCard and priceCellHtml repeatedly, so an un-stripped
// search would find the prose and pass with the code deleted.
ok('stripper removes line comments', !strip('a // updateCard\nb').includes('updateCard'))
ok('stripper removes block comments', !strip('a /* updateCard */ b').includes('updateCard'))
ok('stripper keeps code', strip('updateCard: fn // x').includes('updateCard: fn'))

const src = strip(rawSrc)

ok('reconcileGrid refreshes a node when it reuses one',
  /mounted\.delete\(key\)[\s\S]{0,400}?opts\.updateCard\(/.test(src))
ok('…unconditionally, so a missing hook is loud rather than silent',
  !/if\s*\(\s*opts\.updateCard\s*\)/.test(src))
ok('renderOpts supplies updateCard', /updateCard\s*:/.test(src))
ok('…wired to repriceCard at the current catalogue quantity',
  /updateCard\s*:[^\n]*repriceCard\(\s*node\s*,\s*p\s*,\s*state\.qty\s*\)/.test(src))

// One definition of the price cell. The bug was survivable only because the
// markup existed in exactly one place; two would have drifted instead.
const cellUses = (src.match(/priceCellHtml\(/g) || []).length
ok(`priceCellHtml is used by both the build and the update path (found ${cellUses})`, cellUses >= 3)
ok('productCard builds its price cell through priceCellHtml',
  /<div class="price">\$\{priceCellHtml\(p, state\.qty\)\}<\/div>/.test(src))
ok('the price-cell markup is not spelled out a second time inside productCard',
  !/<div class="price">\$\{priceLockup\(/.test(src))

// setQty must still dim — the update path is what UNdims, so if nothing dims
// there is no "a new number is coming" signal at all.
ok('setQty still dims the prices while the new ones are fetched',
  /querySelectorAll\('\.card \.price'\)[\s\S]{0,120}opacity = '\.4'/.test(src))

if (problems.length) {
  console.error(`check-catalog-reprice: ${problems.length} problem(s)\n`)
  for (const p of problems) console.error(`  - ${p}\n`)
  process.exit(1)
}
console.log('check-catalog-reprice: OK — a reused card is repriced to the current quantity and undimmed, and renders exactly what a fresh card would.')
