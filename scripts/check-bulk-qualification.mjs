/**
 * check-bulk-qualification.mjs
 *
 * THE RULE (shop, 2026-10-17)
 * --------------------------
 * Five or more pieces of the SAME ITEM carrying the SAME DESIGN is what
 * reaches the bulk band. Colour is not part of it: three white tees and two
 * black tees carrying one print are one five-piece run off one gang sheet.
 * Two different prints across five white tees are two runs — three and two —
 * and price as such. Once a run has qualified it pools with every other
 * qualified run that shares a PRESS; dtg and dtf are one press, embroidery is
 * its own.
 *
 * WHY THIS CHECKER EXISTS
 * -----------------------
 * The rule was implemented twice, per CART LINE both times, and the cart
 * merged lines on product + colour alone. Measured on the live engine
 * 2026-10-17 (Gildan 64000, DTF, left chest; 1-4 $24.95, 5-9 $18.95):
 *
 *   3 white design A + 2 white design B   merged to one line of 5 -> $94.75
 *                                         the rule says 3 + 2     -> $124.75
 *                                         $30 UNDER, and the second artwork
 *                                         was discarded: production would
 *                                         have printed five of design A.
 *
 *   3 white + 2 black of ONE design       two lines of 3 and 2     -> $124.75
 *                                         the rule says one run of 5 -> $94.75
 *                                         $30 OVER.
 *
 * And the pool was method-BLIND on the storefront while the CRM had scoped it
 * to the press, so five printed tees beside twenty embroidered hoodies showed
 * $14.95/tee in the cart and charged $18.95 at checkout.
 *
 * WHAT IT ASSERTS — behaviour, numerically, never the presence of a string
 * -----------------------------------------------------------------------
 *   A. BANDS    the live engine's bands are what this file thinks they are,
 *               AND a sub-5 request cannot be lifted by tier_qty. That last
 *               one is the premise of the whole design: a short group has to
 *               keep its own qty, because the server would floor it anyway.
 *   B. PLAN     the storefront's rule, extracted from quote.js and executed,
 *               puts every line of nine carts in the right band.
 *   C. LINES    catalog.js's merge key keeps two designs as two lines and
 *               never discards the incoming artwork.
 *   D. DOLLARS  plan x engine = the cart total, to the cent, on every case.
 *   E. CHARGE   the DEPLOYED /api/v1/price-cart — the same priceShopCart()
 *               /api/shop/checkout bills from — agrees with D to the cent.
 *               This is the one that catches a cart that quotes one number
 *               and charges another. It FAILS until the CRM is deployed.
 *
 * Usage: node scripts/check-bulk-qualification.mjs [--skip-e]
 * Exit 0 = pass, 1 = fail.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const QUOTE = join(HERE, '..', 'quote.js')
const CATALOG = join(HERE, '..', 'catalog.js')
const PRICING_API = 'https://singhsprint-crm.vercel.app/api/pricing'
const CART_API = 'https://singhsprint-crm.vercel.app/api/v1/price-cart'
const SKIP_E = process.argv.includes('--skip-e')

const problems = []
function eq(label, got, expected) {
  const g = JSON.stringify(got), e = JSON.stringify(expected)
  if (g !== e) problems.push(`${label}\n      got:      ${g}\n      expected: ${e}`)
}

// Garments with measured, stable ladders. Both are core catalogue.
const TEE = '505a33c1-278e-4bc0-a8c6-97a502dac03b'   // Gildan 64000
const HOOD = '062eb3bf-211a-4095-8773-9d3d60a4e41a'  // Gildan 18500

// ── extraction ────────────────────────────────────────────────────────────
function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map((l) => l.replace(/(^|[^:'"`])\/\/.*$/, '$1')).join('\n')
}

function loadBlock(path, startMark, endMark, exportsList, purityLabel) {
  const src = readFileSync(path, 'utf8')
  const a = src.indexOf(startMark)
  const b = src.indexOf(endMark)
  if (a < 0 || b < 0 || b < a) {
    console.error(`check-bulk-qualification: ${startMark} markers not found in ${path}`)
    process.exit(1)
  }
  const body = src.slice(a, b)
  const code = stripComments(body)
  // The rule must be drivable off the page. A reach for window/document/state
  // is how a "pure" rule quietly becomes untestable and then wrong.
  for (const reach of ['window.', 'document.', 'state.', 'sessionStorage', 'localStorage']) {
    if (code.includes(reach)) problems.push(`${purityLabel} reaches outside its arguments: ${reach}`)
  }
  // …and the stripper itself has to work, or that guard is decoration.
  if (/scripts\/check-bulk-qualification/.test(code)) {
    problems.push(`${purityLabel}: the comment stripper did not strip comments`)
  }
  for (const name of exportsList) {
    if (!new RegExp(`function ${name}\\s*\\(`).test(body)) {
      console.error(`check-bulk-qualification: ${name} is not inside the markers in ${path}`)
      process.exit(1)
    }
  }
  return new Function(`${body}\n; return { ${exportsList.join(', ')} };`)()
}

// ── the case table ────────────────────────────────────────────────────────
// `want` is per line: [priceQty, tierQty]. `total` is the cart's dollar total.
// Artwork is identified by design_path, exactly as the cart carries it.
const A = { design_path: 'art/a.png' }
const B = { design_path: 'art/b.png' }
const L = (o) => Object.assign({ placements: ['left-chest'], decoration_type: 'dtf' }, o)

const CASES = [
  {
    name: 'one print, five pieces, one colour',
    items: [L({ product_id: TEE, color_id: 'white', qty: 5, ...A })],
    want: [[5, 0]],
  },
  {
    name: 'one print, five pieces, TWO colours — one run of five',
    items: [
      L({ product_id: TEE, color_id: 'white', qty: 3, ...A }),
      L({ product_id: TEE, color_id: 'black', qty: 2, ...A }),
    ],
    want: [[5, 0], [5, 0]],
  },
  {
    name: 'TWO prints, five pieces, one colour — two runs of three and two',
    items: [
      L({ product_id: TEE, color_id: 'white', qty: 3, ...A }),
      L({ product_id: TEE, color_id: 'white', qty: 2, ...B }),
    ],
    want: [[3, 0], [2, 0]],
  },
  {
    name: 'two prints, both already over five — neither borrows the other',
    items: [
      L({ product_id: TEE, color_id: 'white', qty: 6, ...A }),
      L({ product_id: TEE, color_id: 'white', qty: 7, ...B }),
    ],
    want: [[6, 13], [7, 13]],
  },
  {
    name: 'four pieces of one print stays a micro-run',
    items: [L({ product_id: TEE, color_id: 'white', qty: 4, ...A })],
    want: [[4, 0]],
  },
  {
    // A group that is bigger than any of its lines but still under the floor.
    // Every line must keep its OWN qty: pricing a 2-piece line at 3 would
    // disagree with the server, which cannot lift a sub-5 request at all.
    name: 'a three-piece group split across colours stays two micro-runs',
    items: [
      L({ product_id: TEE, color_id: 'white', qty: 2, ...A }),
      L({ product_id: TEE, color_id: 'black', qty: 1, ...A }),
    ],
    want: [[2, 0], [1, 0]],
  },
  {
    // One piece short of the floor, split. This is what tells a floor of five
    // from a floor of four.
    name: 'a four-piece group split across colours is still short',
    items: [
      L({ product_id: TEE, color_id: 'white', qty: 3, ...A }),
      L({ product_id: TEE, color_id: 'black', qty: 1, ...A }),
    ],
    want: [[3, 0], [1, 0]],
  },
  {
    name: 'same press pools across products',
    items: [
      L({ product_id: TEE, color_id: 'white', qty: 5, ...A }),
      L({ product_id: HOOD, color_id: 'black', qty: 20, ...A }),
    ],
    want: [[5, 25], [20, 25]],
  },
  {
    name: 'a DIFFERENT press does not pool',
    items: [
      L({ product_id: TEE, color_id: 'white', qty: 5, ...A }),
      L({ product_id: HOOD, color_id: 'black', qty: 20, decoration_type: 'embroidery', ...A }),
    ],
    want: [[5, 0], [20, 0]],
  },
  {
    name: 'dtg and dtf are ONE press',
    items: [
      L({ product_id: TEE, color_id: 'white', qty: 5, decoration_type: 'dtg', ...A }),
      L({ product_id: HOOD, color_id: 'black', qty: 20, decoration_type: 'dtf', ...A }),
    ],
    want: [[5, 25], [20, 25]],
  },
  {
    name: 'a short group does not join the pool, and is not lifted by it',
    items: [
      L({ product_id: TEE, color_id: 'white', qty: 3, ...A }),
      L({ product_id: HOOD, color_id: 'black', qty: 20, ...B }),
    ],
    want: [[3, 0], [20, 0]],
  },
]

// ── A. the engine's bands, and the floor on short runs ────────────────────
const priceCache = new Map()
async function enginePrice(productId, qty, tierQty, method) {
  const key = `${productId}|${qty}|${tierQty || 0}|${method}`
  if (priceCache.has(key)) return priceCache.get(key)
  let url = `${PRICING_API}?product_id=${productId}&qty=${qty}&sides=1&decoration_method=${method}`
    + '&embroidery_placements=left-chest'
  if (tierQty) url += `&tier_qty=${tierQty}`
  const r = await fetch(url)
  if (!r.ok) { problems.push(`engine ${r.status} for ${key}`); return null }
  const d = await r.json()
  const p = typeof d.unit_price === 'number' ? d.unit_price : null
  priceCache.set(key, p)
  return p
}

async function blockA() {
  eq('A1 tee, 3 pieces, is a micro-run', await enginePrice(TEE, 3, 0, 'dtf'), 24.95)
  eq('A2 tee, 5 pieces, reaches the bulk band', await enginePrice(TEE, 5, 0, 'dtf'), 18.95)
  eq('A3 tee, 5 pieces pooled to 25, reaches the 25 band', await enginePrice(TEE, 5, 25, 'dtf'), 14.95)
  // THE PREMISE. If this ever stops being true, a short group COULD be lifted
  // by tier_qty and planBulkPricing's "keep your own qty" branch is wrong.
  const floored = await enginePrice(TEE, 3, 10, 'dtf')
  eq('A4 the engine floors a sub-5 request whatever tier_qty says', floored, 24.95)
  if (floored !== 24.95) {
    problems.push('A4 is the premise of the whole design: if tier_qty can lift a '
      + 'short line, the storefront and the server must both start doing it.')
  }
}

// ── B. the storefront's plan ──────────────────────────────────────────────
function blockB(rule) {
  for (const c of CASES) {
    const ctx = rule.spBulkContext(c.items)
    const got = c.items.map((it) => {
      const lp = rule.spLinePricing(it, ctx)
      return [lp.qty, lp.tier_qty]
    })
    eq(`B ${c.name}`, got, c.want)
  }
  // The pool must count a GROUP once, not once per colour: three white and
  // two black of one print are five pieces in the pool, not ten.
  const ctx = rule.spBulkContext([
    { product_id: TEE, color_id: 'white', qty: 3, placements: ['left-chest'], decoration_type: 'dtf', ...A },
    { product_id: TEE, color_id: 'black', qty: 2, placements: ['left-chest'], decoration_type: 'dtf', ...A },
    { product_id: HOOD, color_id: 'black', qty: 20, placements: ['left-chest'], decoration_type: 'dtf', ...A },
  ])
  eq('B pool counts each group once, not once per colour', ctx.pools.dtf, 25)
  // BYO buys the shop no leverage and must not enter either.
  const byoCtx = rule.spBulkContext([
    { product_id: TEE, color_id: 'white', qty: 5, placements: ['left-chest'], decoration_type: 'dtf', ...A },
    { is_byo: true, qty: 40, placements: ['left-chest'], decoration_type: 'dtf', ...A },
  ])
  eq('B BYO pieces stay out of the pool', byoCtx.pools.dtf, 5)
  // The inside-neck label is an add-on, not a print side: it must not split a
  // design group, or a five-piece run with tags on three of them becomes two
  // micro-runs. (It IS in the cart LINE key — see C.)
  const tagCtx = rule.spBulkContext([
    { product_id: TEE, color_id: 'white', qty: 3, placements: ['left-chest', 'neck-tag'], decoration_type: 'dtf', neck_tag: true, ...A },
    { product_id: TEE, color_id: 'white', qty: 2, placements: ['left-chest'], decoration_type: 'dtf', ...A },
  ])
  eq('B the neck tag does not split a design group', tagCtx.pools.dtf, 5)
}

// ── C. the cart's merge key ───────────────────────────────────────────────
function blockC(lineKey) {
  const k = lineKey.spCartLineKey
  const base = { product_id: TEE, color_id: 'white', placements: ['left-chest'], decoration_type: 'dtf' }
  eq('C1 same product, colour, placement and design is ONE line',
    k({ ...base, ...A }) === k({ ...base, ...A }), true)
  eq('C2 a different design is a DIFFERENT line',
    k({ ...base, ...A }) === k({ ...base, ...B }), false)
  eq('C3 a different colour is a different line',
    k({ ...base, ...A }) === k({ ...base, color_id: 'black', ...A }), false)
  eq('C4 a different placement is a different line',
    k({ ...base, ...A }) === k({ ...base, placements: ['back-across'], ...A }), false)
  eq('C5 a different method is a different line',
    k({ ...base, ...A }) === k({ ...base, decoration_type: 'embroidery', ...A }), false)
  eq('C6 placement order does not invent a new line',
    k({ ...base, placements: ['left-chest', 'back-across'], ...A })
      === k({ ...base, placements: ['back-across', 'left-chest'], ...A }), true)
  eq('C7 the neck tag IS part of line identity',
    k({ ...base, ...A }) === k({ ...base, neck_tag: true, ...A }), false)
  eq('C8 per-placement artwork is part of the key',
    k({ ...base, placement_designs: { 'left-chest': { path: 'x.png' } } })
      === k({ ...base, placement_designs: { 'left-chest': { path: 'y.png' } } }), false)

  // The behaviour that actually lost artwork: a second add of the same
  // product+colour with DIFFERENT art must leave two lines, and both paths
  // must still be there.
  const cart = []
  for (const it of [{ ...base, qty: 3, ...A }, { ...base, qty: 2, ...B }]) {
    const dup = cart.find((x) => k(x) === k(it))
    if (dup) dup.qty += it.qty
    else cart.push({ ...it })
  }
  eq('C9 two designs stay two lines', cart.length, 2)
  eq('C10 neither artwork is discarded', cart.map((x) => x.design_path), ['art/a.png', 'art/b.png'])
  eq('C11 and the pieces are not silently pooled onto one line', cart.map((x) => x.qty), [3, 2])

  // …and the same loop must still merge a true duplicate, or every repeat add
  // becomes a new line and the cart fills with threes.
  const cart2 = []
  for (const it of [{ ...base, qty: 3, ...A }, { ...base, qty: 2, ...A }]) {
    const dup = cart2.find((x) => k(x) === k(it))
    if (dup) dup.qty += it.qty
    else cart2.push({ ...it })
  }
  eq('C12 a true duplicate still merges', [cart2.length, cart2[0].qty], [1, 5])
}

// ── D. plan x engine = the cart total ─────────────────────────────────────
async function blockD(rule) {
  const totals = []
  for (const c of CASES) {
    const ctx = rule.spBulkContext(c.items)
    let total = 0, ok = true
    for (const it of c.items) {
      const lp = rule.spLinePricing(it, ctx)
      const method = it.decoration_type === 'embroidery' ? 'embroidery' : 'dtf'
      const unit = await enginePrice(it.product_id, lp.qty, lp.tier_qty, method)
      if (unit == null) { ok = false; break }
      total += unit * (Number(it.qty) || 0)
    }
    totals.push({ name: c.name, total: ok ? Math.round(total * 100) / 100 : null, items: c.items })
  }
  // The two cases the rule exists for, in dollars.
  const byName = (n) => totals.find((t) => t.name === n)
  eq('D1 one print across two colours is a five-piece run',
    byName('one print, five pieces, TWO colours — one run of five').total, 94.75)
  eq('D2 two prints on five pieces are two micro-runs',
    byName('TWO prints, five pieces, one colour — two runs of three and two').total, 124.75)
  eq('D3 and those two carts differ by exactly $30',
    Math.round((byName('TWO prints, five pieces, one colour — two runs of three and two').total
      - byName('one print, five pieces, TWO colours — one run of five').total) * 100) / 100, 30)
  eq('D4 the same press pools across products',
    byName('same press pools across products').total,
    Math.round((14.95 * 5 + 29.95 * 20) * 100) / 100)
  eq('D5 a different press does not',
    byName('a DIFFERENT press does not pool').total,
    Math.round((18.95 * 5 + 40.95 * 20) * 100) / 100)
  // The disagreement the method-blind pool caused, in dollars on the tee line.
  eq('D6 method-blind pooling would have cost $20 on that cart',
    Math.round((18.95 - 14.95) * 5 * 100) / 100, 20)
  return totals
}

// ── E. what the server will actually charge ───────────────────────────────
async function blockE(totals) {
  for (const t of totals) {
    if (t.total == null) continue
    const items = t.items.map((it) => ({
      product_id: it.product_id,
      color_id: null,
      qty: it.qty,
      placements: it.placements,
      decoration_method: it.decoration_type,
      design_path: it.design_path ?? null,
      placement_designs: it.placement_designs ?? null,
    }))
    let d
    try {
      const r = await fetch(CART_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      d = r.ok ? await r.json() : null
      if (!r.ok) { problems.push(`E ${t.name}: price-cart returned ${r.status}`); continue }
    } catch (e) {
      problems.push(`E ${t.name}: price-cart unreachable (${e.message})`)
      continue
    }
    const sub = typeof d?.subtotal === 'number' ? Math.round(d.subtotal * 100) / 100 : null
    eq(`E the charge matches the cart — ${t.name}`, sub, t.total)
  }
}

// ── run ───────────────────────────────────────────────────────────────────
const rule = loadBlock(QUOTE, '// ===== SP_BULK_RULE_START', '// ===== SP_BULK_RULE_END',
  ['spDesignKey', 'spBulkMethodKey', 'spBulkGroupKey', 'spLineQty', 'spBulkContext', 'spLinePricing', 'spItemTierQty'],
  'the bulk rule in quote.js')
const lineKey = loadBlock(CATALOG, '// ===== SP_CART_LINE_KEY_START', '// ===== SP_CART_LINE_KEY_END',
  ['spCartDesignKey', 'spCartLineKey'], 'the cart line key in catalog.js')

await blockA()
blockB(rule)
blockC(lineKey)
const totals = await blockD(rule)
if (!SKIP_E) await blockE(totals)

if (problems.length) {
  console.error(`\ncheck-bulk-qualification: ${problems.length} problem(s)\n`)
  for (const p of problems) console.error('  • ' + p)
  process.exit(1)
}
console.log(`check-bulk-qualification: OK — ${CASES.length} carts, bands measured live${SKIP_E ? ' (E skipped)' : ''}`)
