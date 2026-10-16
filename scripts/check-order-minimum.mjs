#!/usr/bin/env node
/**
 * check-order-minimum.mjs
 *
 * The site sells custom decoration in runs of SP_MIN_ORDER or more. This
 * asserts the three things that have to stay true together, because any two
 * of them without the third is worse than none:
 *
 *   A. ONE NUMBER. Every gate and every string reads window.SP_MIN_ORDER.
 *      A second hardcoded 5 somewhere is how the copy and the gate drift
 *      apart, and the drift is invisible until a customer is told five and
 *      refused at six.
 *   B. THE GATE. The paid path counts the whole order and refuses below it.
 *      Copy alone is a promise nothing keeps: before this, a cart of three
 *      reached /api/shop/checkout and the engine priced it happily, because
 *      the 1-4 micro-run tier is still in the pricing config on purpose.
 *   C. THE CLAIM. No page still advertises "no minimum". The site said it on
 *      fifteen pages, two <title> tags, its meta descriptions and its
 *      LocalBusiness schema; a page that still says it is now false
 *      advertising, not just stale copy.
 *
 * Plus the two carve-outs, which are the easiest things to lose in a later
 * edit: DROPS are exempt (finished goods, their own endpoint, sold one at a
 * time) and the EMBROIDERY minimum is a different number from a different
 * source and must not be collapsed into this one.
 *
 * Run: node scripts/check-order-minimum.mjs
 */
import { readFileSync, existsSync } from 'node:fs'

const problems = []
const ok = (id, cond, detail = '') => {
  if (cond) console.log(`  ok  ${id}${detail ? ' — ' + detail : ''}`)
  else { problems.push(id + (detail ? ' — ' + detail : '')); console.log(`  FAIL ${id}${detail ? ' — ' + detail : ''}`) }
}
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

const componentsRaw = read('components.js')
const components = strip(componentsRaw)
const quote       = strip(read('quote.js'))
const catalog     = strip(read('catalog.js'))
const langRaw     = read('lang.js')
const lang        = strip(langRaw)

// ── A. one number ──────────────────────────────────────────────────────────
console.log('\nA. the number lives in one place')

const decl = components.match(/window\.SP_MIN_ORDER\s*=\s*(\d+)\s*;/)
ok('A1 components.js declares the minimum', !!decl, decl ? `SP_MIN_ORDER = ${decl[1]}` : 'not found')
const MIN = decl ? Number(decl[1]) : null
ok('A2 it is a real floor', MIN !== null && MIN > 1, String(MIN))
// Script ORDER, read off the <script src> tags only. A first pass matched any
// mention of the filename and failed on catalog.html, where a CSS comment says
// "set by catalog.js" 10KB above the real tag.
const scriptOrder = (page) =>
  [...read(page).matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1].replace(/^\/|\?.*$/g, ''))
const loadsFirst = (page, first, second) => {
  const list = scriptOrder(page)
  const i = list.indexOf(first), j = list.indexOf(second)
  return i > -1 && (j === -1 || i < j)
}
ok('A3 components.js loads before the files that read it',
   loadsFirst('quote.html', 'components.js', 'quote.js')
   && loadsFirst('catalog.html', 'components.js', 'catalog.js')
   && loadsFirst('index.html', 'components.js', 'lang.js'),
   'a constant read before it is defined is the fallback, silently')
ok('A4 the gate reads it rather than its own copy of the number',
   /window\.SP_MIN_ORDER/.test(quote))
ok('A5 so does the catalogue',
   /function catMinOrder\(\)[\s\S]{0,260}window\.SP_MIN_ORDER\s*:\s*5/.test(catalog),
   'catMinOrder must RETURN the shared constant — mentioning it in a condition and '
   + 'then returning a literal is the same drift wearing a helper')
// Named, because "the token appears somewhere" survives any one string being
// retyped with a bare 5 — which is exactly how copy and gate drift apart.
const MIN_KEYS = ['fold.note.nomin', 'home.diff.r2.us', 'home.faq.a2', 'sticky.sub',
                  'whyus.cmp.r2.us', 'cat.hero.meta3', 'about.clients.p2', 'home.hero.sub']
const typed = MIN_KEYS.filter((k) => {
  const m = langRaw.match(new RegExp("'" + k.replace(/\./g, '\\.') + "':[\\s\\S]{0,2600}?\\},?\\n"))
  // BOTH languages. Checking the key as a whole let a mutation retype the
  // English with a bare 5 while the French kept the token, and pass.
  return !m || (m[0].match(/\{ordermin\}/g) || []).length < 2
})
ok('A6 every order-minimum string carries the placeholder, not a typed figure',
   typed.length === 0, typed.length ? 'typed: ' + typed.join(', ') : MIN_KEYS.length + ' keys')
ok('A7 and something fills it',
   /replace\(\/\\\{ordermin\\\}\/g/.test(lang),
   'SP_LANG.t() substitutes it so a string cannot promise what the gate will not honour')

// ── B. the gate ────────────────────────────────────────────────────────────
console.log('\nB. the paid path refuses a short order')

// Offsets in the WHOLE file, not a fixed window: the first version of this
// sliced 9,000 characters from handlePayment and the checkout fetch sits 9,347
// past it, so B3 failed on correct code. A magic window is a second thing to
// keep true.
const payStart = quote.indexOf('function handlePayment()')
const pay = quote.slice(payStart, payStart + 16000)
const gateAt  = quote.indexOf('spOrderPieces < spMinOrder')
const fetchAt = quote.indexOf('fetch(SHOP_CHECKOUT_API')
ok('B1 handlePayment has a minimum check', /spOrderPieces\s*<\s*spMinOrder/.test(pay))
ok('B2 it counts the WHOLE order, not one line',
   /items\.reduce\(/.test(pay) && /parseInt\(i\.qty, 10\)/.test(pay),
   'two lines of 2 and 3 are five pieces and must go through')
// Not just "before the fetch textually" — before the ASYNC work starts. Once
// handlePayment reaches the artwork upload it is inside a promise chain, and a
// check added down there runs after the buttons are disabled and the overlay
// is up, which is a refusal the customer meets halfway through paying.
const asyncAt = quote.indexOf('spCollectPendingFiles === ')
ok('B3 it stops in the synchronous prelude, before any of the checkout work',
   gateAt > payStart && asyncAt > gateAt && fetchAt > gateAt,
   'a gate after the POST is not a gate, and one inside the upload chain is barely one')
ok('B4 and tells the customer how many more are needed',
   /\{short\}/.test(pay) && /quote\.min\.order/.test(pay))
ok('B5 the free-quote path is deliberately NOT gated',
   !/spOrderPieces\s*<\s*spMinOrder/.test(
     quote.slice(quote.indexOf("getElementById('quoteForm')"),
                 quote.indexOf("getElementById('quoteForm')") + 4000)),
   'a short run still reaches a human who can price it by hand')
ok('B6 the catalogue cannot set a quantity checkout would refuse',
   /Math\.max\(catMinOrder\(\), n\)/.test(catalog))
ok('B7 ...and its qty inputs start there too',
   !/id="qtyInput"[^>]*min="1"/.test(read('catalog.html'))
   && /id="qtyInput"[^>]*min="5"/.test(read('catalog.html')))
ok('B8 the 1-4 rung is gone from the ladder',
   !/onclick="setQty\(1\)"/.test(read('catalog.html')))

// ── C. the claim ───────────────────────────────────────────────────────────
console.log('\nC. nothing still advertises no minimum')

// Live, customer-facing surfaces only. /p/ product pages carry the SUPPLIER's
// own description verbatim — "No minimum quantity" there is ATC's sentence
// about its own blank, not a promise this shop is making, and rewriting a
// supplier's product copy is its own kind of wrong.
const PAGES = [
  'index.html', 'why-us.html', 'catalog.html', 'about.html', 'inkwear.html',
  'custom-hoodies-montreal.html', 'custom-t-shirts-montreal.html',
  'custom-hats-caps-montreal.html', 'dtf-printing-montreal.html',
  'dtg-printing-montreal.html', 'screen-printing-montreal.html',
  'embroidery-montreal.html', 'businesses.html', 'portfolio.html',
  'industries/charity-events-fundraisers.html', 'industries/corporate-tech-swag.html',
  'industries/construction-workwear.html', 'industries/schools-sports-teams.html',
  'industries/restaurant-hospitality-uniforms.html',
  'guides/minimum-order-price-breaks.html', 'guides/bulk-order-size-run.html',
]
// "no hard minimum" slipped past the first version of this on six pages — five
// industry pages and the screen-printing one — because it is not the phrase
// "no minimum". It is the same promise.
const CLAIM = /no (hard |real |strict )?minimum(s)?\b|aucun minimum|pas de minimum/i
// The one true exception: how many SPONSOR logos a charity shirt may carry.
const SPONSOR = /no minimum sponsor count/i

const offenders = []
for (const page of PAGES) {
  if (!existsSync(new URL('../' + page, import.meta.url))) continue
  const html = read(page).replace(/<!--[\s\S]*?-->/g, ' ')
  for (const line of html.split('\n')) {
    if (CLAIM.test(line) && !SPONSOR.test(line)) offenders.push(`${page}: ${line.trim().slice(0, 70)}`)
  }
}
ok('C1 no page body, title or meta still promises it',
   offenders.length === 0, offenders.length ? offenders.join(' | ') : `${PAGES.length} pages clean`)
ok('C2 nor any translation string',
   !CLAIM.test(langRaw.replace(/\/\/[^\n]*/g, ' ')))
ok('C3 nor the shared schema and sticky bar in components.js',
   !CLAIM.test(componentsRaw.replace(/\/\/[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')))
ok('C4 the catalogue cards stopped saying it too',
   !CLAIM.test(catalog))

// ── D. the carve-outs ──────────────────────────────────────────────────────
console.log('\nD. what the minimum deliberately does not touch')

ok('D1 drops still sell one at a time',
   /drop_id/.test(read('api/shop/checkout.js'))
   && !/SP_MIN_ORDER/.test(read('api/shop/checkout.js')),
   'finished goods, their own endpoint — a 5-piece floor there would end that shop')
ok('D2 the embroidery minimum keeps its own token',
   /\{min\}/.test(langRaw) && /quote\.byoline\.err\.embmin/.test(langRaw),
   'it comes from the pricing engine and moves when the config moves')
ok('D3 ...and its own source',
   /SP_EMB_MIN/.test(quote) && /embroidery_min_qty/.test(quote))
ok('D4 the two are not the same symbol',
   /function SP_EMB_MIN\(\)\s*\{\s*return _spEmbMin/.test(quote)
   && !/function SP_EMB_MIN\(\)[^}]*SP_MIN_ORDER/.test(quote)
   && !/SP_MIN_ORDER\s*=\s*SP_EMB_MIN/.test(components),
   'SP_EMB_MIN must still answer from its own registry-fed state')

// ── E. nothing still OFFERS a quantity we will not sell ───────────────────
//
// Block C catches the words "no minimum". It does not catch a page that keeps
// the promise in other words, and plenty did: the DTG page was titled
// "One-Off Tees", its FAQ asked "Can you print just one t-shirt?" and answered
// yes, the t-shirt page said "One shirt or a thousand", and every one of the
// 4,600 catalogue cards carried "Just one from $X" read straight off
// prices_by_qty[1]. All of that survived the first pass and all of it
// contradicts a 5-piece floor as plainly as the phrase itself would.
console.log('\nE. nothing offers a run below the minimum')

const OFFERS = /one-off|just one|print one shirt|print 1\b|a single (tee|shirt|hoodie|garment)|(one|1) (shirt|piece|hoodie|item) or a thousand|1-9 tier|1&ndash;4/i

// Idioms that are not an offer. Each is here because it reads like one and
// is not: "before we print a single piece" means before any printing starts;
// a fitting kit of one of every size is seven garments; a guide describing a
// "one-off charity run" is describing the EVENT, not the order.
const NOT_AN_OFFER = [
  /before we print a single piece/i,
  /one of (every|each) (standard )?size/i,
  /one-off charity runs?/i,
  /instead of one-off orders/i,
  /a one-off order at the worst per-unit price/i,
  /before you pick a single garment/i,
  /order one physical sample set/i,
]

const LIVE = [
  'index.html', 'why-us.html', 'catalog.html', 'about.html', 'inkwear.html',
  'custom-hoodies-montreal.html', 'custom-t-shirts-montreal.html',
  'dtf-printing-montreal.html', 'dtg-printing-montreal.html',
  'screen-printing-montreal.html', 'embroidery-montreal.html',
  'bulk-apparel-montreal.html', 'bulk-apparel-printing-montreal.html',
  'custom-hats-caps-montreal.html', 'businesses.html', 'jerseys.html',
]
const offers = []
for (const page of LIVE) {
  if (!existsSync(new URL('../' + page, import.meta.url))) continue
  for (const line of read(page).split('\n')) {
    if (!OFFERS.test(line)) continue
    if (NOT_AN_OFFER.some((rx) => rx.test(line))) continue
    offers.push(`${page}: ${line.trim().slice(0, 64)}`)
  }
}
ok('E1 no live page offers a one-off or a sub-minimum tier',
   offers.length === 0, offers.length ? offers.slice(0, 3).join(' | ') : 'swept clean')
ok('E2 nor any translation string', !OFFERS.test(langRaw.replace(/\/\/[^\n]*/g, ' ')))
ok('E3 the catalogue card prices the MINIMUM, not a single unit',
   /ladder\[floor\]/.test(catalog) && !/ladder\[1\]/.test(catalog),
   'it read prices_by_qty[1] and printed "Just one from $X" on every card')
ok('E4 ...and the rung it quotes is never below the floor',
   /k >= floor/.test(catalog))

// ── F. the 9,224 generated product pages ──────────────────────────────────
//
// The biggest surface by far, and the easiest to forget: every /p/<style>/
// page carries a stock paragraph from scripts/generate-product-pages.mjs.
// They said "No minimum on DTG/DTF printing for this blank" on 4,612 EN and
// 4,612 FR pages — more copies of the claim than the rest of the site put
// together, and all of it indexed.
console.log('\nF. the generated product pages')

const gen = read('scripts/generate-product-pages.mjs')
const body = /bodyP2:\s*\{([\s\S]*?)\},\n/.exec(gen)
ok('F1 the generator has a bodyP2 block', !!body)
if (body) {
  ok('F2 it no longer tells 4,612 pages there is no minimum',
     !/no minimum|aucun minimum/i.test(body[1]))
  ok('F3 it states the minimum instead, in both languages',
     /en:[^\n]*[Mm]inimum order is \d+ pieces/.test(body[1])
     && /fr:[^\n]*Commande minimum de \d+ pi/.test(body[1]))
}
// A generator fixed but never re-run leaves the claim on every live page.
const sample = ['p/gildan-64000/index.html', 'p/98000-98000/index.html']
  .find((f) => existsSync(new URL('../' + f, import.meta.url)))
if (sample) {
  const page = read(sample)
  ok('F4 and the pages on disk were regenerated from it',
     /Minimum order is \d+ pieces/.test(page) && !/No minimum on DTG\/DTF/.test(page),
     sample)
}
// The one place "No minimum quantity" is allowed to survive: it is the
// SUPPLIER's sentence about their own blank, reproduced verbatim in the
// product description. Rewriting a supplier's copy is its own kind of wrong,
// and it is not this shop making the promise.
ok('F5 supplier descriptions are still reproduced verbatim',
   /description/i.test(gen),
   '"No minimum quantity" inside an ATC or EuroSpun blurb is their sentence, not ours')

if (problems.length) {
  console.error(`\ncheck-order-minimum: ${problems.length} problem(s)\n`)
  for (const p of problems) console.error('  - ' + p + '\n')
  process.exit(1)
}
console.log(`\ncheck-order-minimum: OK — ${MIN} pieces per order, one source, gated before checkout, and nothing left claiming otherwise.`)
