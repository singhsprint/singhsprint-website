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
const MIN_KEYS = ['fold.note.nomin', 'cat.cart.met', 'quote.order.minqty.note', 'quote.order.minqty.alert', 'quote.order.noqty.alert', 'home.diff.r2.us', 'home.faq.a2', 'sticky.sub',
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
// B6-B8 used to assert the opposite: that the catalogue clamped every
// quantity UP to five, hid the 1 rung and started its input at min="5". That
// was the per-ITEM reading of a per-ORDER minimum, and it left a customer who
// wanted one of five different things with no way to see the price of one.
// The minimum is enforced at the cart (B1-B4, H); the catalogue prices
// whatever quantity is asked and says "per order" beside it.
ok('B6 the catalogue prices a typed 1 as 1 — it does not clamp up to the minimum',
   /Math\.max\(1, n\)/.test(catalog) && !/Math\.max\(catMinOrder\(\), n\)/.test(catalog))
ok('B7 ...and its qty input starts at one',
   /id="qtyInput"[^>]*min="1"/.test(read('catalog.html')) && /id="qtyInput"[^>]*min="1"/.test(read('fr/catalog.html')))
ok('B8 the ladder offers a 1 rung, on both pages',
   /onclick="setQty\(1\)"/.test(read('catalog.html')) && /onclick="setQty\(1\)"/.test(read('fr/catalog.html')))
ok('B9 below five, the slider note says PER ORDER, through the translator',
   /note\.innerHTML = few\s*\?\s*\(_t\('cat\.qty\.note\.few'\)/.test(catalog) && !/'5-piece minimum'/.test(catalog))

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
ok('E3 the "N from $X" sub-line on a card quotes the order minimum, never a single unit',
   /ladder\[floor\]/.test(catalog) && !/ladder\[1\]/.test(catalog),
   'it read prices_by_qty[1] and printed "Just one from $X" on every card')
ok('E3b ...and below five the card says per order beside the price',
   /cat\.card\.few-at-tier/.test(catalog))
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

// ── G. the catalogue guides toward five of ANYTHING ───────────────────────
// The minimum is per order. The catalogue used to say "5-piece minimum" on
// every card and clamp the modal's quantity to five, which read as five OF
// THIS ONE and quietly turned away the customer who wanted one tee, one
// hoodie, one cap, one polo and one crew. Behaviour, numerically:
console.log('\nG. the catalogue guides toward five of anything')
{
  const a = componentsRaw.indexOf('// ===== SP_ORDER_METER_START')
  const b = componentsRaw.indexOf('// ===== SP_ORDER_METER_END')
  ok('G1 components.js carries the order meter between markers', a >= 0 && b > a)
  const body = componentsRaw.slice(a, b)
  const code = strip(body)
  ok('G2 the meter is pure — no document, no sessionStorage, no DOM',
     !/document\.|sessionStorage|localStorage|getElementById/.test(code))
  // Execute it with a stand-in window carrying only the policy number.
  const win = { SP_MIN_ORDER: MIN }
  const meter = new Function('window', body + '\n; return window.spOrderMeter;')(win)
  const m = (have, add) => { const r = meter(have, add); return [r.total, r.short, r.met, r.filled] }
  ok('G3 an empty cart adding one is four short', JSON.stringify(m(0, 1)) === JSON.stringify([1, 4, false, 1]), JSON.stringify(m(0, 1)))
  ok('G4 three in the cart plus one more is one short', JSON.stringify(m(3, 1)) === JSON.stringify([4, 1, false, 4]), JSON.stringify(m(3, 1)))
  ok('G5 three plus two meets it — any items, no product in the arithmetic', JSON.stringify(m(3, 2)) === JSON.stringify([5, 0, true, 5]), JSON.stringify(m(3, 2)))
  ok('G6 over the floor the pips never exceed the floor', JSON.stringify(m(6, 1)) === JSON.stringify([7, 0, true, MIN]), JSON.stringify(m(6, 1)))
  ok('G7 nothing in the cart and nothing being added is not "met"', m(0, 0)[2] === false && m(0, 0)[1] === MIN, JSON.stringify(m(0, 0)))
  ok('G8 a negative or junk quantity counts as zero', JSON.stringify(m(-3, 'x')) === JSON.stringify([0, MIN, false, 0]), JSON.stringify(m(-3, 'x')))
  ok('G9 the floor it uses IS the policy number, not a literal', meter(0, 1, 7).short === 6 && meter(0, 1).short === MIN - 1)

  // The surfaces that read it.
  const cat = strip(read('catalog.js'))
  ok('G10 the floating cart bar reads the meter', /function renderCartBar[\s\S]{0,1500}spOrderMeter\(/.test(cat))
  // 2026-10-17 — the tag stays once met. The met branch of renderCartBar
  // carries the met string AND the pips; the short branch clears is-met.
  {
    const body = cat.slice(cat.indexOf('function renderCartBar'), cat.indexOf('function pipsHtml'))
    const metBranch = body.slice(body.indexOf("} else {"))
    ok('G10b …and keeps the tag, as met, once the order clears the floor',
       /cat\.cart\.met/.test(metBranch) && /pipsHtml\(meter\)/.test(metBranch) && /classList\.add\('is-met'\)/.test(metBranch))
    ok('G10c …the short branch clears is-met and the met branch never adds is-short',
       /classList\.remove\('is-met'\)/.test(body.slice(0, body.indexOf("} else {"))) && !/is-short'\)/.test(metBranch.replace(/classList\.remove\('is-short'\)/, '')))
    ok('G10d the met tag is styled and hidden on phones with the pips, both languages',
       [read('catalog.html'), read('fr/catalog.html')].every((h) => /\.cart-bar__met\{/.test(h) && /\.cart-bar__pips,\.cart-bar__met\{display:none\}/.test(h)))
  }
  ok('G11 the detail modal reads the meter from ITS OWN quantity, not the page slider',
     /function renderOrderMeter[\s\S]{0,600}detailModalQtyInput[\s\S]{0,300}spOrderMeter\(/.test(cat)
     && !/function renderOrderMeter[\s\S]{0,900}state\.qty/.test(cat))
  ok('G11b …and says nothing once the minimum is met — a meter is for a gap',
     /if \(meter\.met\) \{ host\.className = 'dm-order-meter'; host\.innerHTML = ''; return; \}/.test(cat))
  ok('G12 the modal re-renders the meter on every quantity change',
     /function syncDetailAddBtn[\s\S]{0,600}renderOrderMeter\(\)/.test(cat))
  const catHtml = read('catalog.html')
  ok('G13 the modal lets a customer add ONE — the floor is on the order, not the line',
     /id="detailModalQtyInput"[^>]*\bmin="1"/.test(catHtml))
  ok('G14 the modal has the meter element', /id="dmOrderMeter"/.test(catHtml))
  const fr = read('fr/catalog.html')
  ok('G15 …and the French mirror carries both', /id="detailModalQtyInput"[^>]*\bmin="1"/.test(fr) && /id="dmOrderMeter"/.test(fr))

  // Copy: no card may say "N-piece minimum" bare — that is the per-item reading.
  const langStr = read('lang.js')
  for (const key of ['cat.card.few-at-tier', 'cat.qty.note.few']) {
    // Whole line, not [^}]* — the {ordermin} token's own brace ends that
    // match ten characters in. (That exact slip has bitten this file before.)
    const row = langStr.match(new RegExp("^\\s*'" + key.replace(/\./g, '\\.') + "'\\s*:.*$", 'm'))
    ok(`G16 ${key} says per ORDER, not a bare minimum`,
       !!row && /per order|par commande/.test(row[0]) && !/-piece minimum|Minimum \{ordermin\} pi/.test(row[0]),
       row ? row[0].slice(0, 120) : 'row not found')
  }

  // The phone-only CTA and label must actually render on a phone. Their
  // default display:none has to sit BEFORE the max-width media block; placed
  // after it, equal specificity means the later rule wins and the phone CTA
  // was an empty 28px pill on production (measured 2026-10-17 at 390px).
  const css = catHtml
  const mediaAt = css.indexOf('@media (max-width:520px){\n      .cart-bar{')
  const ctaDefault = css.indexOf('.cart-bar__cta .cta-short{display:none}')
  const meterDefault = css.indexOf('.cart-bar__meter-short{display:none}')
  ok('G17 the phone CTA default is declared before the phone media block',
     mediaAt > 0 && ctaDefault > 0 && ctaDefault < mediaAt, `cta default @${ctaDefault}, media @${mediaAt}`)
  ok('G18 …and so is the phone meter label', meterDefault > 0 && meterDefault < mediaAt)
  ok('G19 the phone block shows the short label and hides the pips',
     /@media \(max-width:520px\)\{[\s\S]*?\.cart-bar__meter-short\{display:inline\}[\s\S]*?\n    \}/.test(css)
     && /@media \(max-width:520px\)\{[\s\S]*?\.cart-bar__pips(,\.cart-bar__met)?\{display:none\}/.test(css))
}

// ── H. the server enforces the same floor ────────────────────────────────
// Everything above is the page. A stale client, a cached quote.js or a
// hand-made POST reaches /api/shop/checkout directly, and until 2026-10-17
// a three-piece cart went straight through to Stripe. These hit the DEPLOYED
// CRM, so they go red the moment the two copies of the number disagree, and
// stay red until the CRM is deployed. Skip with --skip-live.
console.log('\nH. the server enforces the same floor')
if (!process.argv.includes('--skip-live')) {
  const CRM = 'https://singhsprint-crm.vercel.app'
  let serverFloor = null
  try {
    const reg = await (await fetch(`${CRM}/api/v1/registry`)).json()
    serverFloor = typeof reg.shop_min_order_pieces === 'number' ? reg.shop_min_order_pieces : null
    ok('H1 /api/v1/registry serves the order floor', serverFloor !== null, JSON.stringify(reg.shop_min_order_pieces))
    ok('H2 …and it is the same number this site gates on', serverFloor === MIN, `server ${serverFloor}, site ${MIN}`)
  } catch (e) {
    ok('H1 /api/v1/registry reachable', false, String(e && e.message))
  }
  // A three-piece cart, sizes consistent, real product, nothing else wrong
  // with it. The ONLY acceptable answer is a refusal naming the minimum — any
  // other 4xx means the gate sits behind another check and a cart that passes
  // that check would reach Stripe; a 200 means it did.
  //
  // ONLY probed once the server advertises a floor. Against a CRM that does
  // not, this POST is not a test, it is an order: the first run of this block
  // on 2026-10-17 came back 200 with a live Stripe Checkout session and an
  // inbound_requests row for "checker", because that is exactly the hole. A
  // checker that opens a Stripe session to prove Stripe sessions can be
  // opened has proved it once already.
  if (serverFloor === null) {
    ok('H3 a 3-piece checkout is refused', false, 'not probed — the deployed CRM serves no order floor yet, and a POST would open a real Stripe session')
  } else try {
    const r = await fetch(`${CRM}/api/shop/checkout`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_email: 'check-order-minimum@example.invalid', customer_name: 'checker',
        items: [{ product_id: '505a33c1-278e-4bc0-a8c6-97a502dac03b', qty: MIN - 2, sizes: { M: MIN - 2 },
                  placements: ['left-chest'], decoration_method: 'dtf', garment_type: 'tshirt' }],
      }),
    })
    const body = await r.json().catch(() => ({}))
    ok(`H3 a ${MIN - 2}-piece checkout is refused`, r.status === 400, `HTTP ${r.status} ${JSON.stringify(body).slice(0, 160)}`)
    ok('H4 …for being under the minimum, not for some other reason', body && body.reason === 'below_order_minimum' && body.min_pieces === MIN, JSON.stringify(body).slice(0, 160))
    ok('H5 …and the refusal tells the customer what to do', typeof body.error === 'string' && /request a quote/i.test(body.error), body.error)
  } catch (e) {
    ok('H3 /api/shop/checkout reachable', false, String(e && e.message))
  }
}

// ── I. the quote page offers nothing under the minimum ─────────────────────
// 2026-10-17 — the quantity picker on /quote still had an "Under 5" pill that
// prefilled a run of three, and the homepage fold's quantity select offered the
// same band with a note that embroidery "starts at 10". The order minimum is
// five, the embroidery minimum is five, and the checkout refuses less; a chip
// offering a quantity the shop will not sell is a promise the gate breaks.
{
  const quote = read('quote.js')
  const home = read('index.html'), homeFr = read('fr/index.html')
  const qhtml = read('quote.html'), qhtmlFr = read('fr/quote.html')
  ok('I1 no band object is built with id u5 or qty under the minimum',
     !/\{\s*id:\s*'u5'/.test(quote) && !/qty:\s*[1-4]\s*\}/.test(quote.slice(quote.indexOf('SP_QTY_BANDS_FALLBACK'), quote.indexOf('SP_QTY_BANDS_FALLBACK') + 1200)))
  ok('I2 the live ladder drops any rung under the order minimum',
     /if \(t\.min < spOrderMinimum\(\)\) return;/.test(quote))
  ok('I3 …and that minimum is the policy constant, not a literal',
     /function spOrderMinimum\(\)[\s\S]{0,200}window\.SP_MIN_ORDER\s*:\s*5/.test(quote))
  ok('I4 no "Under 5" pill is rendered', !/qty-band--pill/.test(quote) && !/quote\.qty\.under5/.test(quote))
  ok('I5 an old ?qty=u5 link lands on the smallest real band, not nowhere',
     /String\(bandId \|\| ''\) === 'u5'\)[\s\S]{0,400}band = smallest/.test(quote) && /URL_BANDS = \['u5'/.test(quote))
  ok('I6 the BYO line refuses under the minimum where the number is typed',
     /if \(qty < ordMin\)[\s\S]{0,300}quote\.byoline\.err\.ordmin/.test(quote)
     && /if \(qty < spOrderMinimum\(\)\)[\s\S]{0,300}quote\.byoline\.err\.ordmin/.test(quote))
  ok('I7 the BYO price panel never prices under it',
     /Math\.max\(spOrderMinimum\(\), parseInt\(document\.getElementById\('byoQty'\)/.test(quote))
  ok('I8 both BYO inputs carry min="5" in both languages',
     [qhtml, qhtmlFr].every((h) => /id="byoLineQty"[^>]*min="5"/.test(h) && /id="byoQty"[^>]*min="5"/.test(h)))
  ok('I9 the homepage quantity select has no under-5 option, either language',
     !/value="u5"/.test(home) && !/value="u5"/.test(homeFr) && !/u5:/.test(home) && !/u5:/.test(homeFr))
  ok('I10 the homepage no longer says embroidery starts at 10',
     !/fold\.note\.emb\b/.test(home) && !/fold\.note\.emb\b/.test(homeFr) && !/'fold\.note\.emb'/.test(langRaw) && !/starts at <b>10/.test(home))
  ok('I11 the "from 5" fold line shows for every method',
     /else \{ lines\.push\(T\('fold\.note\.nomin'/.test(home) && !/method!=='Embroidery'/.test(home))
  ok('I12 the under-5 strings are gone from lang.js, the BYO one is in',
     !/quote\.qty\.under5/.test(langRaw) && !/fold\.opt\.u5/.test(langRaw) && /quote\.byoline\.err\.ordmin/.test(langRaw))
}

// ── J. zero is under the minimum ──────────────────────────────────────────
// 2026-10-17 — a paid-ad lead on an iPhone submitted a T-shirt quote with no
// quantity at all and reached the inbox as "? × 1 side". The quote gate was
// `q >= 1 && q < 5`: it stopped a run of three and waved through a run of
// nothing. Meanwhile a 1-4 run was sent from the quote button to the pay
// button and back, each refusing it.
{
  const quote = read('quote.js')
  const gate = quote.slice(quote.indexOf('function spIsMicroRun'), quote.indexOf('function spIsMicroRun') + 600)
  ok('J1 the quote gate treats no quantity as under the minimum', /return q < QUOTE_MIN_QTY;/.test(gate) && !/q >= 1 &&/.test(gate))
  ok('J2 BYO lines stay quote-only at any count', /gs\.value === 'BYOG'\) return false/.test(gate))
  ok('J3 no quantity → "how many", short → "add {short} more", both from lang.js',
     /q <= 0\s*\n?\s*\? T\('quote\.order\.noqty\.alert'/.test(quote) && /T\('quote\.order\.minqty\.alert'[\s\S]{0,300}\{short\}/.test(quote))
  ok('J4 with no quantity the warning scrolls to the quantity chips', /q <= 0 \? \(document\.getElementById\('qtyBandSection'\)/.test(quote))
  ok('J5 the pay button is no longer promoted for a short run', !/pay\.classList\.toggle\('btn-accent',\s*micro\)/.test(quote))
  ok('J6 nothing sends a 1-4 customer to the other button',
     !/Request a quote instead\u201d and we will price/.test(quote) && !/checkout-only/.test(langRaw) && !/price the smaller run/.test(langRaw) && !/Request a quote instead\u201d/.test(langRaw))
}

if (problems.length) {
  console.error(`\ncheck-order-minimum: ${problems.length} problem(s)\n`)
  for (const p of problems) console.error('  - ' + p + '\n')
  process.exit(1)
}
console.log(`\ncheck-order-minimum: OK — ${MIN} pieces per order, one source, gated before checkout, and nothing left claiming otherwise.`)
