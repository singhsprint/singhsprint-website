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
  // Two legal shapes, one rule: the number must come from the engine, never
  // from the sentence.
  //
  //   'Embroidery needs ' + SP_EMB_MIN() + '+ pieces'      — concatenated
  //   'Embroidery needs {min}+ pieces'  … .replace('{min}', embMin)
  //
  // The placeholder form arrived with the BYO panel, because that copy lives
  // in lang.js and French puts the figure mid-sentence ("La broderie exige
  // {min} pièces ou plus"), which concatenation cannot express. It is
  // accepted only when a .replace() nearby feeds it something that traces
  // back to SP_EMB_MIN() — a literal there would fail the same way a literal
  // in the sentence does.
  //
  // What this cannot see is whether the replace actually RAN, so a stray
  // "{min}" could in principle reach a customer. That is covered where it
  // belongs: the BYO browser checks assert the rendered string reads
  // "needs 5+ pieces", so an unfilled placeholder fails them.
  const FROM_ENGINE = /\+ (SP_EMB_MIN\(\)|EMB_MIN) \+/
  const FILLED = /\.replace\(\s*'\{min\}'\s*,\s*(SP_EMB_MIN\(\)|EMB_MIN|embMin|_m|min)\b/
  // A TYPED FIGURE, which is the thing being banned: "needs 5+", "has a
  // 10-piece". Checked on its own rather than relying on the positive rules,
  // because the phrase regex runs 80 characters past the sentence and can
  // sweep in a .replace() from the NEXT line — which is exactly how a typed
  // "Embroidery needs 5+ pieces" passed the first version of this.
  const TYPED = /(?:needs|has a)\s*\d/
  for (const [i, phrase] of spoken.entries()) {
    const at = outside.indexOf(phrase)
    const window = at >= 0 ? outside.slice(at, at + 300) : phrase
    ok(`B5.${i} "${phrase.slice(0, 46)}…" takes the figure from the engine, never from the sentence`,
      !TYPED.test(phrase) &&
      (FROM_ENGINE.test(phrase) || (/\{min\}/.test(phrase) && FILLED.test(window))))
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

// ── C. caps are embroidery-only, on EVERY surface ──────────────────────────
// The owner's call, 2026-10-17. quote.js had snapped a cap to embroidery
// since May; the catalogue modal, the card ladder and the "From" price all
// priced the same cap as a print job, so a Richardson 112 read $36.95 in
// the catalogue and $40.95 on the quote page. One list, read by both pages
// and by the engine's root.
const catRaw = readFileSync(join(HERE, '..', 'catalog.js'), 'utf8')
const cat = strip(catRaw)
const listOf = (src, name) => {
  const m = src.match(new RegExp(name + '\\s*=\\s*\\{([^}]*)\\}'))
  return m ? m[1].split(',').map((x) => x.split(':')[0].trim()).filter(Boolean).sort() : null
}
const quoteList = listOf(code, 'EMBROIDERY_ONLY_GARMENTS')
const catList = listOf(cat, 'SP_EMBROIDERY_ONLY')
eq('C1 the catalogue and the quote page agree on which garments are embroidery-only', catList, quoteList)
ok('C2 …and the list is not empty', Array.isArray(quoteList) && quoteList.length > 0)
ok('C3 the catalogue modal opens an embroidery-only garment on Embroidery',
   /method:\s*dmczEmbroideryOnly\(p\)\s*\?\s*'Embroidery'\s*:\s*'DTG'/.test(cat))
ok('C4 …and refuses a switch to print on one',
   /function dmczSelectMethod\(id\)\s*\{\s*if \(id !== 'Embroidery' && dmczEmbroideryOnly\(_detailProduct\)\) id = 'Embroidery';/.test(cat))
ok('C5 …and a shared design cannot reopen it on print',
   /dmczEmbroideryOnly\(_detailProduct\)\s*\?\s*'Embroidery'\s*:\s*\(share\.decoration_method/.test(cat))
// The modal opens an embroidery-only garment AT the floor and will not go
// under it (owner, 2026-10-17: "the hat should still open at 5 and it
// shouldn't let us go lower"). The floor is the embroidery minimum less what
// of the same run is already in the cart, so three black caps in the cart
// open a white one at two.
ok('C12 the modal seeds an embroidery-only garment at its line floor',
   /initDmczCustomizer\(p\);[\s\S]{0,400}const lineFloor = dmczMinLineQty\(p\);\s*const seeded = Math\.max\(lineFloor, state\.qty \|\| 25\);[\s\S]{0,200}qtyInput\.value = seeded;\s*qtyInput\.min = String\(lineFloor\);/.test(cat))
ok('C12b …and re-prices when the floor lifted the slider\'s number',
   /if \(lifted\) \{\s*try \{ refreshDmczPrice\(\); \} catch \(_\) \{\}/.test(cat))
ok('C13 …the stepper cannot go under it',
   /qtyInp\.value = Math\.max\(dmczMinLineQty\(_detailProduct\), \(parseInt\(qtyInp\.value, 10\) \|\| 1\) - 1\);/.test(cat))
ok('C14 …nor a typed number on blur or Add',
   /const floor = dmczMinLineQty\(_detailProduct\);\s*if \(!n \|\| n < floor\) n = floor;/.test(cat) && /const n = clampDetailQty\(\);/.test(cat))
ok('C15 …and the floor counts what of the run is already in the cart',
   /function dmczMinLineQty[\s\S]{0,700}spCartRunQty\(SinghsCart\.read\(\)\.items, p\.product_id, 'embroidery', pl, 0\)\.inCart;[\s\S]{0,80}return Math\.max\(1, min - inCart\);/.test(cat))
ok('C16 …and reads the minimum from the engine\'s registry, five until it answers',
   /api\/v1\/registry/.test(cat) && /embroidery_min_qty_by_garment/.test(cat) && /_spEmbMin = \{ overall: 5, by: \{\} \}/.test(cat))
ok('C17 a printed garment keeps a floor of one', /if \(!p \|\| !dmczEmbroideryOnly\(p\)\) return 1;/.test(cat))
ok('C6 the print card on a cap is blocked, with the same sentence the quote page uses',
   /dmczEmbroideryOnly\(_detailProduct\)\)\s*\{\s*blocked = true;/.test(cat) && /capembonly/.test(cat))

// The ENGINE: asked for print on a cap, it answers with the embroidery
// price. Live, so it is red until the CRM that decides this at its root is
// deployed — and it is the assertion that matters, because it covers the
// card ladder, the "From" price and checkout at once.
if (!process.argv.includes('--skip-live')) {
  const CAP = '3269ef37-3963-43e7-b502-6f10d2566423' // Richardson 112, garment_type hat
  // At FIVE — a quantity the engine will sell. At one, every method is now
  // refused (C8), which agrees with itself but is not what this asks.
  const price = async (m) => {
    const r = await fetch(`https://singhsprint-crm.vercel.app/api/pricing?product_id=${CAP}&qty=5&sides=1&decoration_method=${m}&embroidery_placements=cap-front`)
    const d = await r.json().catch(() => ({}))
    return typeof d.unit_price === 'number' ? d.unit_price : null
  }
  const [dtf, dtg, emb] = await Promise.all([price('dtf'), price('dtg'), price('embroidery')])
  ok('C7 the engine prices a cap the same whatever method is asked', dtf != null && dtf === emb && dtg === emb)
  if (!(dtf != null && dtf === emb && dtg === emb)) problems.push(`C7 detail: dtf ${dtf}, dtg ${dtg}, embroidery ${emb} — a customer who sees the print number pays the stitched one`)

  // The embroidery minimum is five on EVERY garment (owner, 2026-10-17). The
  // engine refused one embroidered tee and sold one embroidered cap at a
  // premium — two minimums for one process. Live, red until the CRM deploys.
  const refusal = async (q) => {
    const r = await fetch(`https://singhsprint-crm.vercel.app/api/pricing?product_id=${CAP}&qty=${q}&sides=1&decoration_method=embroidery&embroidery_placements=cap-front`)
    const d = await r.json().catch(() => ({}))
    return { status: r.status, reason: d.reason, min: d.min_qty, unit: d.unit_price }
  }
  const [c1, c4, c5] = await Promise.all([refusal(1), refusal(4), refusal(5)])
  ok('C8 one embroidered cap is refused, and the refusal names five',
     c1.status === 400 && c1.reason === 'below_embroidery_minimum' && c1.min === 5)
  ok('C9 …so are four', c4.status === 400 && c4.reason === 'below_embroidery_minimum')
  ok('C10 …and five is priced', c5.status === 200 && typeof c5.unit === 'number')
  if (!(c1.status === 400 && c4.status === 400 && c5.status === 200)) problems.push(`C8-10 detail: qty1 ${JSON.stringify(c1)}, qty4 ${JSON.stringify(c4)}, qty5 ${JSON.stringify(c5)}`)
  const reg = await (await fetch('https://singhsprint-crm.vercel.app/api/v1/registry')).json().catch(() => ({}))
  ok('C11 the registry lists the hat minimum beside the others',
     reg && reg.embroidery_min_qty_by_garment && reg.embroidery_min_qty_by_garment.hat === 5)
  // The floor is ONE number for every garment. The apron's ladder took the
  // "layered embroidery" path, which promoted a short run to five instead of
  // refusing it: two embroidered Augusta 4350s priced at $65.95 on
  // 2026-10-17 while two embroidered tees were refused. Same stitching, two
  // minimums. Red until the CRM that decides this at its root is deployed.
  const APRON = 'e296d349-7817-40c5-ab17-8362bab03021' // Augusta 4350, garment_type apron
  const apron = async (q) => {
    const r = await fetch(`https://singhsprint-crm.vercel.app/api/pricing?product_id=${APRON}&qty=${q}&sides=1&decoration_method=embroidery&embroidery_placements=left-chest`)
    const d = await r.json().catch(() => ({}))
    return { status: r.status, reason: d.reason, unit: d.unit_price }
  }
  const [a2, a5] = await Promise.all([apron(2), apron(5)])
  ok('C18 two embroidered aprons are refused, like two embroidered tees', a2.status === 400 && a2.reason === 'below_embroidery_minimum')
  ok('C19 …and five are priced', a5.status === 200 && typeof a5.unit === 'number')
  if (!(a2.status === 400 && a5.status === 200)) problems.push(`C18-19 detail: qty2 ${JSON.stringify(a2)}, qty5 ${JSON.stringify(a5)}`)
  ok('C20 no garment in the registry reports an embroidery minimum under five',
     reg && reg.embroidery_min_qty_by_garment && Object.values(reg.embroidery_min_qty_by_garment).every((n) => n >= 5))
}

if (problems.length) {
  console.error(`check-embroidery-minimum: ${problems.length} problem(s)\n`)
  for (const p of problems) console.error(`  - ${p}\n`)
  process.exit(1)
}
console.log('check-embroidery-minimum: OK — the page states no minimum of its own; every figure comes from the engine.')
