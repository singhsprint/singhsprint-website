/**
 * check-embroidery-minimum.mjs
 *
 * Asserts that the storefront never states an embroidery minimum of its own.
 *
 * WHY THIS EXISTS. quote.js carried the number as a literal `10`, twice, under
 * a comment that explained why it had to:
 *
 *     "embroidery has a 10-piece minimum. It can't live in the pricing config
 *      (qty_tiers is shared with print), so the funnel has to say it."
 *
 * True when written. Slice 81 then gave embroidery its own ladder and the
 * minimum became exactly "the lowest rung on embroidery_qty_tiers", per
 * garment. The comment stayed. On 2026-09-13 the ladder gained a 5-9 rung and
 * the engine began quoting five pieces at $37.95 a tee — while this page went
 * on telling customers "Embroidery needs 10+ pieces" and blanking the 5-piece
 * row of its own price table.
 *
 * A stale written-down claim reads exactly like a live one. So the rule is not
 * "keep the number correct", it is "do not hold a number": every figure the
 * page states comes from the CRM, with the compiled fallback used only when
 * the fetch has not landed.
 *
 * Exit 0 = pass, 1 = fail.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC  = join(HERE, '..', 'quote.js')

const problems = []
const ok = (label, cond) => { if (!cond) problems.push(label) }
const eq = (label, got, expected) => {
  if (JSON.stringify(got) !== JSON.stringify(expected)) {
    problems.push(`${label}\n      got:      ${JSON.stringify(got)}\n      expected: ${JSON.stringify(expected)}`)
  }
}

const raw = readFileSync(SRC, 'utf8')

// ── the getter, exercised ──────────────────────────────────────────────────
// Pulled out of the real file by markers, like the other storefront checks, so
// this tests what ships rather than a copy.
const a = raw.indexOf('// ===== SP_EMB_MIN_START')
const b = raw.indexOf('// ===== SP_EMB_MIN_END')
if (a < 0 || b < 0 || b < a) {
  console.error('check-embroidery-minimum: SP_EMB_MIN markers not found in quote.js')
  process.exit(1)
}
const body = raw.slice(a, b)

function loadGetter(fetchImpl) {
  const shim = 'var fetch = __fetch;\n' + body +
    '\n; return { SP_EMB_MIN: SP_EMB_MIN, set: function (v) { _spEmbMin = v; } };'
  // eslint-disable-next-line no-new-func
  return new Function('__fetch', shim)(fetchImpl)
}

/** A fetch shim that delivers `payload` synchronously, so the getter's own
 *  validation actually RUNS. An earlier version handed it a thenable that
 *  never fired: every "malformed payload" case then passed by never reaching
 *  the code under test, and deleting the validation outright did not fail. */
function fetchYielding(payload, opts = {}) {
  const res = { ok: opts.ok !== false, json: () => thenable(payload) }
  return () => thenable(res)
}
function thenable(value) {
  return {
    then(fn) {
      let next
      try { next = fn ? fn(value) : value } catch (e) { return rejected(e) }
      return next && typeof next.then === 'function' ? next : thenable(next)
    },
    catch() { return this },
  }
}
function rejected(err) {
  return { then() { return this }, catch(fn) { fn(err); return thenable(undefined) } }
}
const noop = () => ({ then: () => ({ then: () => ({ catch: () => {} }) }) })

{
  const g = loadGetter(noop)
  eq('A1 before the fetch lands, the fallback is 10', g.SP_EMB_MIN(), 10)
  g.set(5);  eq('A2 a live 5 is used',  g.SP_EMB_MIN(), 5)
  g.set(12); eq('A3 a live 12 is used', g.SP_EMB_MIN(), 12)
  // The fallback must be HIGH, not low. Advertising a minimum that is too high
  // costs a conversation; too low promises a price checkout will refuse.
  g.set(null)
  ok('A4 falling back never advertises fewer pieces than the compiled value',
    g.SP_EMB_MIN() >= 10)
}

// A malformed payload must not become a minimum. These run the real fetch
// callback, so the validation is the thing being tested.
for (const bad of [0, -1, 2.5, NaN, Infinity, null, undefined, {}, [], 'abc']) {
  const g = loadGetter(fetchYielding({ embroidery_min_qty: bad }))
  eq(`A5 ${JSON.stringify(bad) ?? String(bad)} is refused, fallback stands`, g.SP_EMB_MIN(), 10)
}
// …and a good one is taken.
for (const good of [5, 10, 12, 24]) {
  const g = loadGetter(fetchYielding({ embroidery_min_qty: good }))
  eq(`A6 a live ${good} is adopted`, g.SP_EMB_MIN(), good)
}
// A numeric STRING is refused rather than coerced: the engine sends numbers,
// and a string here means the payload is not what we think it is.
eq('A7 "5" as a string is refused',
  loadGetter(fetchYielding({ embroidery_min_qty: '5' })).SP_EMB_MIN(), 10)
// A non-OK response, and a payload with the field missing, both fall back.
eq('A8 a non-200 falls back',
  loadGetter(fetchYielding({ embroidery_min_qty: 5 }, { ok: false })).SP_EMB_MIN(), 10)
eq('A9 a payload without the field falls back',
  loadGetter(fetchYielding({ placements: [] })).SP_EMB_MIN(), 10)

// ── structural: no second opinion anywhere on the page ─────────────────────
function strip(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}
ok('B0 stripper removes line comments', !strip('a // EMB_MIN\nb').includes('EMB_MIN'))
ok('B0 stripper removes block comments', !strip('a /* EMB_MIN */ b').includes('EMB_MIN'))
ok('B0 stripper keeps code', strip('var EMB_MIN = x // n').includes('var EMB_MIN = x'))

const code = strip(raw)

ok('B1 the old EMB_MIN_QTY literal is gone', !/EMB_MIN_QTY/.test(code))
ok('B2 the funnel hint reads the live figure', /EMB_MIN\s*=\s*SP_EMB_MIN\(\)/.test(code))
ok('B3 no bare numeric minimum is assigned anywhere',
  !/EMB_MIN\w*\s*=\s*\d+/.test(code))
// Every place the page SAYS the embroidery minimum must interpolate it, never
// spell it. Scoped to the embroidery strings on purpose: this page also talks
// about a 5-piece minimum for quotes generally, which is a different rule and
// not this checker's business. An earlier version of B5 banned any "N piece"
// phrase and flagged that unrelated copy — a false alarm from an assertion
// that was broader than the thing it was defending.
{
  const outside = strip(raw.slice(0, a) + raw.slice(b))
  const spoken = outside.match(/Embroidery (?:has a|needs)[^;]{0,80}/g) || []
  ok(`B4 the page still states the minimum somewhere (${spoken.length} site(s))`, spoken.length >= 2)
  for (const [i, phrase] of spoken.entries()) {
    ok(`B5.${i} "${phrase.slice(0, 46)}…" interpolates the figure rather than spelling it`,
      /\+ (SP_EMB_MIN\(\)|EMB_MIN) \+/.test(phrase))
  }
  // And the fallback literal is allowed to exist in exactly one place.
  ok(`B6 the fallback 10 lives in the getter`, /_spEmbMin == null \? 10 :/.test(strip(body)))
  ok('B7 …and nowhere else assigns a numeric minimum',
    !/_spEmbMin\s*=\s*\d/.test(outside))
}
ok('B8 the price table asks the cell instead of a constant',
  /fmtEmb\s*=\s*function\s*\(\s*cell\s*\)\s*\{\s*return fmt\(cell\)/.test(code))
ok('B9 the registry endpoint is what supplies it',
  /REGISTRY_API_FOR_QUOTE\s*=\s*'[^']*\/api\/v1\/registry'/.test(code) &&
  /fetch\(REGISTRY_API_FOR_QUOTE\)/.test(code))

if (problems.length) {
  console.error(`check-embroidery-minimum: ${problems.length} problem(s)\n`)
  for (const p of problems) console.error(`  - ${p}\n`)
  process.exit(1)
}
console.log('check-embroidery-minimum: OK — the page states no minimum of its own; every figure comes from the engine.')
