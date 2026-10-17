#!/usr/bin/env node
/**
 * scripts/check-price-lockup.mjs
 *
 * Asserts that a catalogue card never presents a price as if it belonged to
 * the colour it is showing.
 *
 * WHAT WENT WRONG. Colourways of one style are not the same price. Q-Tees
 * Q800 at qty 50, measured through the live engine and the live API:
 *
 *     Black   $17.95     (blank costs $3.48)
 *     Grey    $17.95
 *     White   $17.95
 *     Natural $16.95     (blank costs $2.38)
 *     product-level      $16.95   <- the cheapest colourway
 *
 * /api/catalog prices each colour only on the SINGLE-product fetch. The LIST
 * fetch that fills the grid returns colors[].price_from = null for every
 * colour, so the card had exactly one number available -- the cheapest -- and
 * printed it under the name of whichever colour the shopper had clicked.
 * Select Black, read $16.95, open the card, and the modal says $17.95.
 *
 * 738 of 4,515 priced products (16.3%) have a colour spread. Average $17.76
 * of wholesale between cheapest and dearest; largest $245.
 *
 * WHY THESE ASSERTIONS. Checking that the string contains "From" is the weak
 * version -- it passes on a card that says "From" somewhere unrelated. These
 * assert on the PRICE ITSELF: every dollar figure the lockup emits must be
 * preceded by a qualifier, and the check finds the figures by regex rather
 * than trusting the template's shape.
 *
 *   node scripts/check-price-lockup.mjs
 *
 * Exit 0 = pass, 1 = fail. No network, no DOM, no browser.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC  = join(HERE, '..', 'catalog.js')
const LANG = join(HERE, '..', 'lang.js')

const problems = []
function eq(label, got, expected) {
  const g = JSON.stringify(got), e = JSON.stringify(expected)
  if (g !== e) problems.push(`${label}\n      got:      ${g}\n      expected: ${e}`)
}

function loadLockup() {
  const src = readFileSync(SRC, 'utf8')
  const a = src.indexOf('// ===== SP_PRICE_LOCKUP_START')
  const b = src.indexOf('// ===== SP_PRICE_LOCKUP_END')
  if (a < 0 || b < 0 || b < a) {
    console.error('check-price-lockup: SP_PRICE_LOCKUP markers not found in catalog.js')
    process.exit(1)
  }
  const body = src.slice(a, b)
  if (!/function priceLockup\s*\(/.test(body)) {
    console.error('check-price-lockup: priceLockup not inside the markers')
    process.exit(1)
  }
  // It must not read page state — qty is a parameter precisely so this
  // harness can drive every branch. Checked against the CODE, with comments
  // stripped: the doc block above the function names state.qty when it
  // explains why the parameter exists, and matching that would fail on prose.
  const code = body
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map(l => l.replace(/(^|[^:'"`])\/\/.*$/, '$1')).join('\n')
  if (/state\.qty/.test(code)) {
    problems.push('priceLockup reads state.qty instead of its qty argument')
  }
  // …and the stripper itself has to work, or the guard above is decoration.
  if (/WHY EVERY NUMBER HERE SAYS/.test(code)) {
    problems.push('the comment stripper did not strip comments')
  }
  return new Function(body + '\n; return priceLockup;')()
}

/** Every dollar figure in the emitted markup, with the ~40 chars before it. */
function figures(html) {
  const out = []
  const re = /\$(\d[\d,]*\.\d{2})/g
  let m
  while ((m = re.exec(html))) {
    out.push({ amount: m[1], before: html.slice(Math.max(0, m.index - 90), m.index) })
  }
  return out
}
const QUALIFIED = /data-i18n="cat\.card\.(from|justone-from)"/

function main() {
  const priceLockup = loadLockup()
  const lang = readFileSync(LANG, 'utf8')

  // ── THE ASSERTION: no bare price, in any branch ─────────────────────────
  const cases = [
    { label: 'tier price with a cheaper single',  p: { price_from: 16.95, prices_by_qty: { 1: 26.95, 50: 16.95 } }, qty: 50 },
    { label: 'tier price, no ladder',             p: { price_from: 16.95 },                                          qty: 50 },
    { label: 'tier price, ladder repeats it',     p: { price_from: 16.95, prices_by_qty: { 1: 16.95 } },             qty: 50 },
    { label: 'small-qty flat pricing',            p: { price_from: 26.95, prices_by_qty: { 1: 26.95 } },             qty: 1 },
    { label: 'string-keyed ladder',               p: { price_from: 16.95, prices_by_qty: { '1': 26.95 } },           qty: 50 },
  ]
  for (const c of cases) {
    const html = priceLockup(c.p, c.qty)
    const figs = figures(html)
    eq(`${c.label}: emits at least one price`, figs.length > 0, true)
    for (const f of figs) {
      eq(`${c.label}: $${f.amount} is qualified, not bare`, QUALIFIED.test(f.before), true)
    }
  }

  // ── The headline specifically ───────────────────────────────────────────
  {
    // The sub-figure is the price of the SMALLEST RUN WE SELL. It used to be
    // prices_by_qty[1] and the card read "Just one from $X" beside a checkout
    // that refuses anything under the order minimum (2026-10-16), so the
    // fixture carries a 5 rung and the card is expected to quote that one.
    const html = priceLockup({ price_from: 16.95, prices_by_qty: { 1: 29.95, 5: 26.95 } }, 50, 5)
    eq('the headline is "From $16.95/unit"',
       /cat\.card\.from[^$]*\$16\.95<\/strong><span data-i18n="cat\.card\.perunit"/.test(html), true)
    eq('…and the minimum-run figure carries its own qualifier',
       /cat\.card\.justone-from[^$]*\$26\.95/.test(html), true)
    eq('…and it is NOT the single-unit price', /\$29\.95/.test(html), false)
    // The old wording must be gone, or a stale build could still ship a bare
    // "Just one $26.95" beside a qualified headline.
    eq('…and the unqualified "justone" key is no longer used',
       /data-i18n="cat\.card\.justone"/.test(html), false)
  }

  // ── A ladder that only prices below the minimum quotes nothing ──────────
  // Not a fallback to the qty-1 rung: that rung is a quantity the site will
  // not sell, and a price beside it is an offer.
  {
    const html = priceLockup({ price_from: 16.95, prices_by_qty: { 1: 29.95 } }, 50, 5)
    eq('a sub-minimum-only ladder prints no second figure', /\$29\.95/.test(html), false)
    eq('…and falls back to the print-side line instead',
       /cat\.card\.oneside/.test(html), true)
  }

  // ── /each branch is qualified too ───────────────────────────────────────
  {
    const html = priceLockup({ price_from: 26.95 }, 1)
    eq('the /each branch says From as well', /cat\.card\.from/.test(html), true)
    eq('…and reads /each, not /unit', /cat\.card\.pereach/.test(html), true)
  }

  // ── No price, no qualifier — and no invented number ──────────────────────
  for (const bad of [null, 0, -1, undefined, NaN, '16.95']) {
    const html = priceLockup({ price_from: bad }, 50)
    eq(`price_from=${JSON.stringify(bad)} falls back to quote-on-request`,
       /cat\.card\.quote-on-request/.test(html), true)
    eq(`…and prints no dollar figure`, figures(html).length, 0)
  }

  // ── Both i18n keys exist in both languages ──────────────────────────────
  // A data-i18n pointing at a missing key renders the English fallback in
  // French, which is how a translated site quietly stops being translated.
  for (const key of ['cat.card.from', 'cat.card.justone-from']) {
    // [^}]* stopped at the '}' of a '{ordermin}' placeholder, so the row came
    // back empty and both language assertions failed on correct strings.
    const row = new RegExp(`'${key.replace(/\./g, '\\.')}':\\s*\\{((?:[^{}]|\\{[a-z]+\\})*)\\}`).exec(lang)
    eq(`${key} is defined in lang.js`, !!row, true)
    if (row) {
      eq(`…with an en string`, /en:\s*'[^']+'/.test(row[1]), true)
      eq(`…and an fr string`, /fr:\s*'[^']+'/.test(row[1]), true)
    }
  }

  // ── An embroidery-only garment under the floor is TAGGED, not mispriced ──
  // The owner's rule, 2026-10-17: never make an item disappear at a quantity;
  // tag it. A cap at the 1 rung used to print the stale print-ladder rung as
  // "/each · Flat price at this tier" — a number the engine refuses. It must
  // print the smallest run we stitch, per unit, with the minimum on it.
  {
    const cap = { garment_type: 'hat', price_from: 36.95, prices_by_qty: { 1: 36.95, 5: 28.95, 10: 21.95 } }
    const h1 = priceLockup(cap, 1, 5)
    eq('cap at 1: the headline is the five-piece price, not the stale 1 rung', figures(h1)[0]?.amount, '28.95')
    eq('cap at 1: priced per unit, not "/each"', /cat\.card\.perunit/.test(h1) && !/cat\.card\.pereach/.test(h1), true)
    eq('cap at 1: carries the minimum tag', /cat\.card\.embmin/.test(h1) && /Minimum 5/.test(h1), true)
    eq('cap at 1: does not claim a flat price at this tier', /flat-no-min/.test(h1), false)
    const h5 = priceLockup(cap, 5, 5)
    eq('cap at 5: no tag, ordinary card', /cat\.card\.embmin/.test(h5), false)
    const tee = { garment_type: 'tshirt', price_from: 24.95, prices_by_qty: { 1: 24.95, 5: 18.95 } }
    const t1 = priceLockup(tee, 1, 5)
    eq('tee at 1: still /each with its own price', figures(t1)[0]?.amount === '24.95' && /cat\.card\.pereach/.test(t1), true)
    eq('tee at 1: no embroidery tag', /cat\.card\.embmin/.test(t1), false)
    // A cap whose ladder has NO rung at or above the floor falls back to its
    // own price_from rather than printing nothing or NaN.
    const bare = { garment_type: 'cap', price_from: 30.95 }
    eq('cap with no ladder: still prints a price', figures(priceLockup(bare, 1, 5))[0]?.amount, '30.95')
    // The server's word is enough on its own: /api/catalog sets price_min_qty
    // on the Popular page, where no per-tier ladder exists and the card has
    // only the garment type to go on — and the garment type can be wrong.
    const flagged = { garment_type: 'other', price_from: 28.95, price_min_qty: 5 }
    const hf = priceLockup(flagged, 1, 5)
    eq('server-flagged at 1: tagged with the server\'s minimum', /Minimum 5/.test(hf) && /cat\.card\.embmin/.test(hf) && /cat\.card\.perunit/.test(hf), true)
    eq('server-flagged: the tag carries the server\'s number, not the page\'s', /Minimum 10/.test(priceLockup({ ...flagged, price_min_qty: 10 }, 1, 5)), true)
    eq('server-flagged at 5: no tag', /cat\.card\.embmin/.test(priceLockup(flagged, 5, 5)), false)
  }

  if (problems.length) {
    console.error(`check-price-lockup: ${problems.length} problem(s)\n`)
    for (const p of problems) console.error(`  - ${p}\n`)
    process.exit(1)
  }
  console.log(
    'check-price-lockup: OK — every dollar figure a card emits is preceded by a "From" ' +
    'qualifier in all branches, a missing price falls back to Quote on request and invents ' +
    'no number, and both qualifier keys are translated in en and fr.'
  )
}

main()
