#!/usr/bin/env node
/**
 * check-gifts-builder.mjs — runs the REAL gifts.js against the REAL gifts/build.html in jsdom, with the CRM's API
 * answered by fakes and every request recorded. Behaviour, not strings.
 *
 *   node scripts/check-gifts-builder.mjs        (needs jsdom: npm i -D jsdom, or JSDOM_DIR=<dir with node_modules/jsdom>)
 *
 *   L  landing on /gifts/build?tier=starter creates NO draft (measured 2026-11-11: 13 of 18 drafts were page loads
 *      nobody touched, three were one crawler); it loads the collection and prices the box
 *   C  a preset piece starts in Black, not the first colour in the list (Aquatic Blue), and the price request
 *      carries that colour (no "no colour given, one was assumed" from the engine)
 *   S  swatches are real colours from the name (the catalogue has no hex: every swatch was the same grey);
 *      a hex wins; an unknown name shows the photo; the card offers the common colours and "+N"
 *   D  the first real action creates exactly one draft, carrying the box as it stands (pieces + colours, count),
 *      then saves; the URL becomes the resume link
 *   E  "Email me the link": validates, creates the draft if there is none (with the email), posts email-link,
 *      says "Link sent to"; a bad address sends nothing
 *   M  phones: a bar with the per-client price and the next step stays on screen; it moves to step 2
 *   R  a resume link loads the draft and creates nothing; the concierge form creates nothing
 *   K  CSS: the bar is fixed under 900px, two product columns under 560px, the gear photo no longer stretches
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(process.env.JSDOM_DIR ? join(process.env.JSDOM_DIR, 'x.js') : import.meta.url)
let JSDOM
try { ({ JSDOM } = require('jsdom')) } catch { console.log('jsdom not installed: npm i -D jsdom (or JSDOM_DIR=...)'); process.exit(2) }

const JS = readFileSync(process.env.GIFTS_JS || join(ROOT, 'gifts.js'), 'utf8')
const CSS = readFileSync(process.env.GIFTS_CSS || join(ROOT, 'gifts.css'), 'utf8')
const HTML = readFileSync(join(ROOT, 'gifts/build.html'), 'utf8')
let pass = 0, fail = 0
const ok = (n, c, d = '') => { if (c) { pass++; console.log('  ok  ' + n) } else { fail++; console.log('  FAIL ' + n + (d ? ' -- ' + d : '')) } }
const J = JSON.stringify
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms))

const COL = (id, name, extra = {}) => ({ color_id: id, color_name: name, hex_code: null, mockup_front_url: `https://cdn.example/${id}.jpg`, ...extra })
const COLLECTION = { items: [
  { product_id: '11111111-0000-4000-8000-000000000001', sort_order: 10, default_placement: 'left-chest', default_decoration: 'dtg', forced_decoration: null, box_bulk: 'normal',
    product: { brand: 'ATC', style_number: 'ATC1000', name: 'EVERYDAY COTTON TEE', garment_type: 'tshirt', hero_image_url: null,
      colors: [COL('c-aqua', 'Aquatic Blue'), COL('c-ash', 'Ash Grey***'), COL('c-heather', 'Athletic Heather*'), COL('c-black', 'Black'), COL('c-navy', 'True Navy'), COL('c-red', 'Red'), COL('c-weird', 'Moonbeam Fizz'), COL('c-hex', 'Brand Teal', { hex_code: '#123456' }),
        ...Array.from({ length: 12 }, (_, i) => COL(`c-x${i}`, `Colour ${i}`))] } },
  { product_id: '11111111-0000-4000-8000-000000000002', sort_order: 20, default_placement: 'cap-front', default_decoration: 'embroidery', forced_decoration: 'embroidery', box_bulk: 'flat',
    product: { brand: 'Richardson', style_number: '112', name: 'Snapback Trucker Cap', garment_type: 'hat', hero_image_url: null, colors: [COL('h-amber', 'Amber Gold'), COL('h-black', 'Black'), COL('h-navy', 'Navy')] } },
] }

function boot(url, { draft = null } = {}) {
  const calls = []
  const dom = new JSDOM(HTML, { url, runScripts: 'outside-only', pretendToBeVisual: true })
  const w = dom.window
  w.localStorage.clear()
  w.scrollTo = () => {}
  let draftN = 0
  w.fetch = async (u, opt = {}) => {
    const method = (opt.method || 'GET').toUpperCase()
    const body = opt.body && typeof opt.body === 'string' ? JSON.parse(opt.body) : null
    const path = String(u).replace('https://singhsprint-crm.vercel.app', '').replace(/\?.*/, '')
    calls.push({ method, path, url: String(u), body })
    const res = (status, b) => ({ ok: status < 400, status, json: async () => b })
    if (path === '/api/gifts/collection/public') return res(200, COLLECTION)
    if (path === '/api/gifts/price') return res(200, { ok: true, items: (body.items || []).map(() => ({ unit_price: 20 })), per_recipient: { subtotal: 74.9, pieces: 39.9, box_line: 35, card_upgrade: 0 }, order: { subtotal: 1872.5, discount: 0, setup_fee: 0, tax: 280, total: 2152.5 }, volume: { discount_pct: 0 }, box_size: 'S', warnings: body.items.some((i) => !i.color_id) ? ['no colour given, one was assumed'] : [] })
    if (path === '/api/gifts/drafts' && method === 'POST') { draftN++; return res(201, { id: `aaaaaaaa-0000-4000-8000-00000000000${draftN}`, secret: 'b'.repeat(36) }) }
    if (/^\/api\/gifts\/drafts\/[^/]+$/.test(path) && method === 'PATCH') return res(200, { order: { ...(draft?.order ?? {}), status: 'draft', recipient_count: body.recipient_count ?? 25, tier: 'starter', budget_per_recipient: 80, card_mode: 'standard', delivery_mode: 'ship_each', logo_mode: 'subtle', ...body }, items: body.items ?? null })
    if (/^\/api\/gifts\/drafts\/[^/]+$/.test(path) && method === 'GET') return draft ? res(200, draft) : res(404, { error: 'not found' })
    if (/\/email-link$/.test(path)) return res(200, { ok: true, sent: true })
    return res(404, {})
  }
  w.eval(JS)
  return { w, d: w.document, calls, app: w.document.getElementById('gbApp') }
}
const posts = (calls, p) => calls.filter((c) => c.method === 'POST' && c.path === p)
const click = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }))

async function main() {
  // ── L / C / S ──
  let t = boot('https://www.singhsprint.com/gifts/build?tier=starter')
  await tick(450)
  ok('L1 landing on ?tier=starter creates no draft', posts(t.calls, '/api/gifts/drafts').length === 0, J(t.calls.map((c) => c.method + ' ' + c.path)))
  ok('L2 ...it loads the collection and prices the box (the builder is on screen)', t.calls.some((c) => c.path === '/api/gifts/collection/public') && posts(t.calls, '/api/gifts/price').length === 1 && /Pick the pieces/.test(t.app.textContent))
  const pr = posts(t.calls, '/api/gifts/price')[0]?.body
  ok('C1 the preset tee starts in Black (not Aquatic Blue, the first listed) and the cap in Black', J(pr?.items?.map((i) => i.color_id)) === J(['c-black', 'h-black']), J(pr?.items))
  ok('C2 ...so the engine gets a colour for every piece (no "one was assumed" warning shown)', !/assumed/.test(t.app.textContent))
  ok('C3 the card names the colour without the catalogue\'s asterisks', /Black/.test(t.app.querySelector('.gb-colname')?.textContent ?? ''))
  const mini = [...t.app.querySelectorAll('.gb-mini button[data-act="pcol"]')]
  const bg = (b) => b.getAttribute('style')
  ok('S1 the card offers up to 10 colours, Black first-pick ringed, and "+N" for the rest', mini.length > 0 && mini.filter((b) => b.closest('.gb-prod').querySelector('[data-v="11111111-0000-4000-8000-000000000001"]')).length <= 10 && !!t.app.querySelector('.gb-mini .more') && t.app.querySelector('.gb-mini button.on')?.getAttribute('data-v') === 'c-black')
  const swBlack = mini.find((b) => b.getAttribute('data-v') === 'c-black'), swNavy = mini.find((b) => b.getAttribute('data-v') === 'c-navy'), swHeather = mini.find((b) => b.getAttribute('data-v') === 'c-heather')
  ok('S2 swatches are real colours from the name: Black #1a1a1a, True Navy #0a1f44, Athletic Heather grey-heather — not the same grey', /#1a1a1a/.test(bg(swBlack)) && /#0a1f44/.test(bg(swNavy)) && /#a9abae/.test(bg(swHeather)) && !mini.every((b) => /#ccc/.test(bg(b))), J([bg(swBlack), bg(swNavy), bg(swHeather)]))

  // ── D first real action ──
  click(t.w, t.app.querySelector('[data-act="n"][data-v="1"]'))
  await tick(600)
  const created = posts(t.calls, '/api/gifts/drafts')
  ok('D1 the first real action (one more box) creates exactly one draft, with the box as it stands', created.length === 1 && created[0].body.recipient_count === 30 && J(created[0].body.items?.map((i) => i.color_id)) === J(['c-black', 'h-black']) && created[0].body.tier === 'starter', J(created[0]?.body))
  ok('D2 ...then saves the change, and the URL is the resume link', t.calls.some((c) => c.method === 'PATCH' && /drafts\/aaaaaaaa/.test(c.path)) && /d=aaaaaaaa-0000-4000-8000-000000000001&k=b{36}/.test(t.w.location.search), t.w.location.search)
  click(t.w, t.app.querySelector('.gb-mini button[data-v="c-navy"]'))
  await tick(600)
  ok('D3 clicking a colour on the card changes that piece (saved and repriced with True Navy), no second draft', posts(t.calls, '/api/gifts/drafts').length === 1 && posts(t.calls, '/api/gifts/price').at(-1).body.items[0].color_id === 'c-navy' && t.calls.filter((c) => c.method === 'PATCH').at(-1).body.items?.[0]?.color_id === 'c-navy')

  // ── E email link (draft exists) ──
  t.app.querySelector('#gbLinkEmail').value = 'not-an-email'
  const before = t.calls.length
  click(t.w, t.app.querySelector('[data-act="emaillink"]'))
  await tick(50)
  ok('E1 a bad address: says so, sends nothing', /Check the email/.test(t.app.textContent) && t.calls.length === before)
  t.app.querySelector('#gbLinkEmail').value = 'pat@acme.ca'
  click(t.w, t.app.querySelector('[data-act="emaillink"]'))
  await tick(100)
  const el = posts(t.calls, '/api/gifts/drafts/aaaaaaaa-0000-4000-8000-000000000001/email-link')
  ok('E2 a good address posts email-link for this draft (with the secret) and shows "Link sent to"', el.length === 1 && el[0].body.email === 'pat@acme.ca' && /k=b{36}/.test(el[0].url) && /Link sent to/.test(t.app.querySelector('.gb-save')?.textContent ?? ''), J(el))

  // ── E email link before any draft ──
  t = boot('https://www.singhsprint.com/gifts/build?tier=signature')
  await tick(450)
  t.app.querySelector('#gbLinkEmail').value = 'sam@roy.ca'
  click(t.w, t.app.querySelector('[data-act="emaillink"]'))
  await tick(150)
  const c2 = posts(t.calls, '/api/gifts/drafts')
  ok('E3 no draft yet: the draft is created first, carrying the email, then the link is sent to it', c2.length === 1 && c2[0].body.buyer_email === 'sam@roy.ca' && t.calls.findIndex((c) => /email-link$/.test(c.path)) > t.calls.findIndex((c) => c.path === '/api/gifts/drafts'), J(t.calls.map((c) => c.method + ' ' + c.path)))

  // ── M phone bar ──
  const bar = t.app.querySelector('.gb-mbar')
  ok('M1 the bar shows the per-client price and the next step', /\$74\.90/.test(bar?.textContent ?? '') && /Your logo/.test(bar?.querySelector('button')?.textContent ?? ''))
  click(t.w, t.app.querySelector('[data-act="mnext"]'))
  await tick(50)
  ok('M2 ...and moves to step 2', /Your logo on the gear/.test(t.app.textContent))
  const teeTab = [...t.app.querySelectorAll('[data-act="gear"]')].find((b) => /ATC1000/.test(b.textContent))
  if (teeTab) { click(t.w, teeTab); await tick(20) }
  const sw2 = [...t.app.querySelectorAll('.gb-sw')]
  ok('S3 step 2: a hex wins (Brand Teal #123456); an unknown name shows the photo; none of the known ones are grey', sw2.some((b) => /#123456/.test(b.getAttribute('style'))) && sw2.some((b) => /url\('https:\/\/cdn\.example\/c-weird\.jpg'\)/.test(b.getAttribute('style'))) && /#1a1a1a/.test(sw2.find((b) => b.getAttribute('data-v') === 'c-black')?.getAttribute('style') ?? ''))

  // ── R resume / concierge ──
  const draft = { order: { id: 'dd', status: 'draft', path: 'self_serve', step: 2, tier: 'starter', recipient_count: 25, budget_per_recipient: 80, card_mode: 'standard', delivery_mode: 'ship_each', logo_mode: 'subtle', lang: 'en', buyer_email: null }, items: [{ product_id: COLLECTION.items[0].product_id, color_id: 'c-red', color_name: 'Red', placements: ['left-chest'], decoration_method: 'dtg', brand: 'ATC', style_number: 'ATC1000', garment_type: 'tshirt' }], recipients: [] }
  t = boot('https://www.singhsprint.com/gifts/build?d=dd000000-0000-4000-8000-000000000000&k=' + 'c'.repeat(36), { draft })
  await tick(450)
  ok('R1 a resume link loads the draft (step 2, its own colour) and creates nothing', posts(t.calls, '/api/gifts/drafts').length === 0 && t.calls.some((c) => c.method === 'GET' && /drafts\/dd/.test(c.path)) && /Your logo on the gear/.test(t.app.textContent) && /Red/.test(t.app.textContent))
  t = boot('https://www.singhsprint.com/gifts/build?path=concierge')
  await tick(200)
  ok('R2 the "have us build it" form creates nothing', posts(t.calls, '/api/gifts/drafts').length === 0 && /Tell us about the box/.test(t.app.textContent))

  // ── K CSS ──
  const at = (bp) => { const i = CSS.indexOf(`@media (max-width:${bp}px){`); return i < 0 ? '' : CSS.slice(i, CSS.indexOf('\n}', i)) }
  ok('K1 under 900px the bar is fixed to the bottom and the page leaves room for it', /\.gb-mbar\{display:flex;position:fixed;left:0;right:0;bottom:0/.test(at(900)) && /#gbApp\{padding-bottom:86px\}/.test(at(900)) && /^\.gb-mbar\{display:none\}/m.test(CSS))
  ok('K2 under 560px the pieces are two columns', /\.gb-prods\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/.test(at(560)))
  ok('K3 the gear photo is square and does not stretch to the controls', /\.gb-gear \.ph\{[^}]*aspect-ratio:1\/1;align-self:start/.test(CSS) && !/\.gb-gear \.ph\{[^}]*min-height:300px/.test(CSS))

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
