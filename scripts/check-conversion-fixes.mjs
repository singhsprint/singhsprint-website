#!/usr/bin/env node
/**
 * check-conversion-fixes.mjs — the Nov 2026 conversion fixes, measured in a
 * phone-size browser (390x844) against this checkout served locally.
 *
 *   node scripts/check-conversion-fixes.mjs            # everything, offline (the OS is stubbed)
 *   node scripts/check-conversion-fixes.mjs --live     # also: baked ladder == the OS's live ladder
 *
 * Needs Playwright (npm i -g playwright, or run where it is installed).
 *
 * G  /get-a-price: each ad link's words and chips; the whole form and its
 *    button on one screen with the cookie bar up; one request to the OS per
 *    submit with the source, picks and every utm_/fbclid; the thank-you.
 * L  Meta: Lead fires once per quote-form submit (Pixel + server, one id),
 *    not when the OS says spam, and from nowhere else. A popup claim is
 *    FreeTeeClaim. A price-sheet download is PriceSheetDownload.
 * P  Prices: no $9.95 before 200+ is picked; "Pick a quantity" before any
 *    quantity; the picked tier's price at once; every "from" is the 5-9 row
 *    and the homepage and /quote agree.
 * D  Details: one name, one set of hours, one rating.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LIVE = process.argv.includes('--live')
const require = createRequire(import.meta.url)
let chromium
try { ({ chromium } = require('playwright')) } catch { console.error('Playwright is not installed here. npm i -g playwright'); process.exit(2) }

let fails = 0, passes = 0
const ok = (id, cond, detail = '') => { if (cond) { passes++; console.log(`  ok  ${id}`) } else { fails++; console.log(`FAIL  ${id}${detail ? '  —  ' + detail : ''}`) } }
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const has = (rel) => fs.existsSync(path.join(ROOT, rel))

// ── a static server that behaves like Vercel's cleanUrls ────────────────────
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' }
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  if (p === '/api/meta-capi') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); return }
  if (p.endsWith('/')) p += 'index.html'
  let f = path.join(ROOT, p)
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(ROOT, p + '.html')
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end('not found'); return }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' })
  fs.createReadStream(f).pipe(res)
})
await new Promise((r) => srv.listen(0, '127.0.0.1', r))
const BASE = `http://127.0.0.1:${srv.address().port}`

// ── the baked ladder, read out of the shipped components.js ─────────────────
const comp = read('components.js')
const tm = comp.match(/window\.SP_FROM = window\.SP_FROM \|\| \(function \(\) \{\s*var TIERS = (\{[\s\S]*?\n  \});/)
ok('P0 components.js carries the baked ladder (SP_FROM)', !!tm)
const TIERS = tm ? JSON.parse(tm[1]) : {}
const rowAt = (g, q) => (TIERS[g] || []).find((r) => q >= r[0] && q <= r[1])
const priceAt = (g, q) => rowAt(g, q)?.[2]
const usd = (n) => '$' + Number(n).toFixed(2)

// ── the OS, stubbed: deterministic, and nothing real is ever created ────────
const TEE = { garment_key: 'tshirt', tier: 'standard', product_id: '11111111-1111-4111-8111-111111111111', brand: 'Gildan', style_number: '64000', name: 'Unisex Softstyle T-Shirt', hero_image_url: null, color_count: 67, in_stock: true, price_from: priceAt('tshirt', 200) }
async function stubOs(page, state) {
  await page.route(/singhsprint-crm\.vercel\.app/, async (route) => {
    const req = route.request(); const u = new URL(req.url()); const json = (o, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(o) })
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } })
    if (u.pathname === '/api/inbound' && req.method() === 'POST') { const body = JSON.parse(req.postData() || '{}'); state.inbound.push(body); return json({ id: `req-${state.inbound.length}`, public_token: 't', ok: true, queued: !state.spam, spam: !!state.spam }, 201) }
    if (u.pathname.startsWith('/api/ads/capi/')) { state.capi.push({ event: u.pathname.split('/').pop(), body: JSON.parse(req.postData() || '{}') }); return json({ ok: true }) }
    if (u.pathname === '/api/pricing/homepage-tiers') return json({ tiers: TIERS })
    if (u.pathname === '/api/pricing/tier-blanks') return json({ tiers: [TEE] })
    if (u.pathname === '/api/pricing') {
      const qty = Number(u.searchParams.get('qty')) || 0
      const g = u.searchParams.get('category') || 'tshirt'
      if (u.searchParams.get('matrix')) return json({ bulk_matrix: TIERS.tshirt.filter((r) => r[0] >= 5).map((r) => ({ qty_min: r[0], qty_max: r[1], sides_1: r[2] })) })
      state.priced.push(qty)
      return json({ unit_price: priceAt(TIERS[g] ? g : 'tshirt', qty) ?? null })
    }
    if (u.pathname === '/api/google-reviews') return json({ rating: 4.7, count: 37, source: 'fallback' })
    return json({})
  })
  await page.route(/connect\.facebook\.net|googletagmanager|google-analytics|algolia/, (r) => r.abort())
}
const newState = () => ({ inbound: [], capi: [], priced: [], beacons: [], spam: false })

const browser = await chromium.launch()
async function phone(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  const state = newState()
  await stubOs(page, state)
  // Record every Pixel call (kept in sessionStorage so a navigation does not
  // lose them) and every server-side copy (seen from outside the page).
  page.on('request', (r) => { if (/\/api\/meta-capi$/.test(new URL(r.url()).pathname) && r.method() === 'POST') { try { state.beacons.push(JSON.parse(r.postData() || '{}')) } catch { /* not ours */ } } })
  await page.addInitScript((consent) => {
    const KEY = '__fbq'
    const f = function () { try { const all = JSON.parse(sessionStorage.getItem(KEY) || '[]'); all.push(Array.prototype.slice.call(arguments)); sessionStorage.setItem(KEY, JSON.stringify(all)) } catch (e) {} }
    f.callMethod = null; f.queue = []; f.loaded = true; f.version = '2.0'; f.push = f
    window.fbq = f; window._fbq = f
    // No sendBeacon: the site's helper then uses fetch, which the test can see.
    try { Object.defineProperty(Navigator.prototype, 'sendBeacon', { value: undefined, configurable: true }) } catch (e) {}
    if (consent) { try { localStorage.setItem('sp_consent', consent) } catch (e) {} }
  }, opts.consent || null)
  return { ctx, page, state }
}
const beacons = async (page, name, state) => state.beacons.filter((b) => b.event_name === name).map((b) => ({ body: b }))
const pixel = (page, name) => page.evaluate((n) => JSON.parse(sessionStorage.getItem('__fbq') || '[]').filter((c) => (c[0] === 'track' || c[0] === 'trackCustom') && c[1] === n), name)

// ═════════════════════ G. /get-a-price ═════════════════════════════════════
const PRESETS = [
  ['?product=hoodie&preset=cafe', 'HOODIE SEASON', 'Hoodies with your café’s logo', ['Hoodies', 'Crewnecks', 'Tees', 'Hats'], ['Hoodies'], 'Get my hoodie price', 'Printed or embroidered in Montreal. 5-piece minimum. You see a mockup before we print.'],
  ['?product=hoodie', 'HOODIE SEASON', 'Custom hoodies with your logo', ['Hoodies', 'Crewnecks', 'Tees', 'Hats'], ['Hoodies'], 'Get my hoodie price', null],
  ['?product=hoodie&method=embroidery', 'EMBROIDERED', 'Embroidered hoodies with your logo', ['Hoodies', 'Crewnecks', 'Hats', 'Quarter-zips'], ['Hoodies'], 'Get my hoodie price', 'Embroidered in Montreal. 5-piece minimum. You see a mockup before we stitch.'],
  ['?product=hat', 'HATS', 'Hats with your logo, embroidered', ['Hats', 'Beanies', 'Hoodies', 'Tees'], ['Hats'], 'Get my price', null],
  ['?product=business', 'MERCH FOR YOUR BUSINESS', 'Your logo on tees, hoodies and hats', ['Tees', 'Hoodies', 'Hats', 'Polos', 'Quarter-zips'], [], 'Get my price', null],
  ['', '', 'Get a price in an hour', ['Tees', 'Hoodies', 'Hats', 'Crewnecks', 'Polos', 'Something else'], [], 'Get my price', "Tell us what you need. We'll send a price and a free mockup."],
]
{
  const html = read('get-a-price.html')
  ok('G1 /get-a-price is noindex and loads no popup', /<meta name="robots" content="noindex/.test(html) && !/offer-popup\.js/.test(html) && /data-no-offer-popup/.test(html))
  ok('G2 it loads the Pixel + GA shell (components.js) and the consent banner', /src="\/components\.js"/.test(html) && /src="\/consent\.js"/.test(html))
  for (const [q, eyebrow, h1, chips, selected, button, sub] of PRESETS) {
    const { ctx, page } = await phone()   // first visit: no cookie choice yet, so the banner is up
    await page.goto(`${BASE}/get-a-price${q}`, { waitUntil: 'load' }); await page.waitForTimeout(900)
    const m = await page.evaluate(() => {
      const box = (e) => { const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, h: b.height, left: b.left, right: b.right } }
      const btn = document.getElementById('gpBtn')
      const fixed = [...document.querySelectorAll('body *')].filter((e) => { const cs = getComputedStyle(e); const b = e.getBoundingClientRect(); return cs.position === 'fixed' && cs.display !== 'none' && cs.visibility !== 'hidden' && b.height > 0 && b.width > 0 && !e.closest('#nav-placeholder') }).map((e) => ({ id: e.id || e.className, ...box(e) }))
      const eb = document.getElementById('gpEyebrow')
      return {
        eyebrow: eb.hidden ? '' : eb.textContent.trim().toUpperCase(), h1: document.getElementById('gpH1').textContent.trim(), sub: document.getElementById('gpSub').textContent.trim(),
        chips: [...document.querySelectorAll('#gpProducts .gp-chip')].map((c) => ({ t: c.textContent.trim(), on: c.getAttribute('aria-pressed') === 'true', ...box(c) })),
        qty: [...document.querySelectorAll('#gpQty .gp-chip')].map((c) => ({ t: c.textContent.trim(), ...box(c) })),
        btn: { t: btn.textContent.trim(), ...box(btn) }, fields: ['gpName', 'gpContact', 'gpLogo'].map((id) => !!document.getElementById(id)),
        inputs: [...document.querySelectorAll('#gpForm input:not([name="sp_hp_7f3"])')].map((i) => i.name), fixed, vh: innerHeight, vw: innerWidth, scrollY, popup: !!document.querySelector('.sp-op-overlay'), sticky: !!document.getElementById('sp-sticky-cta'),
        nameY: box(document.getElementById('gpName')), logoY: box(document.querySelector('.gp-file')),
      }
    })
    const tag = `[${q || 'no params'}]`
    ok(`G3 ${tag} eyebrow "${eyebrow}", heading "${h1}"`, m.eyebrow === eyebrow && m.h1 === h1, `${m.eyebrow} / ${m.h1}`)
    if (sub) ok(`G4 ${tag} subhead`, m.sub === sub, m.sub)
    ok(`G5 ${tag} chips ${chips.join(', ')}; preselected: ${selected.join(', ') || 'none'}`, JSON.stringify(m.chips.map((c) => c.t)) === JSON.stringify(chips) && JSON.stringify(m.chips.filter((c) => c.on).map((c) => c.t)) === JSON.stringify(selected), JSON.stringify(m.chips.map((c) => [c.t, c.on])))
    ok(`G6 ${tag} every chip is at least 44px tall`, [...m.chips, ...m.qty].every((c) => c.h >= 44), JSON.stringify([...m.chips, ...m.qty].map((c) => Math.round(c.h))))
    ok(`G7 ${tag} the five quantity chips sit on one row inside 390px`, m.qty.length === 5 && new Set(m.qty.map((c) => Math.round(c.top))).size === 1 && m.qty.every((c) => c.left >= 0 && c.right <= m.vw) && JSON.stringify(m.qty.map((c) => c.t)) === JSON.stringify(['5-9', '10-24', '25-49', '50-99', '100+']), JSON.stringify(m.qty.map((c) => [c.t, Math.round(c.top), Math.round(c.right)])))
    const cover = m.fixed.filter((f) => f.top < m.btn.bottom && f.bottom > m.btn.top && f.left < m.btn.right && f.right > m.btn.left)
    const bar = m.fixed.find((f) => /consent/i.test(String(f.id)))
    ok(`G8 ${tag} form and button on one 390x844 screen, cookie bar up, nothing over the button (button ends at ${Math.round(m.btn.bottom)}px, bar starts at ${bar ? Math.round(bar.top) : 'n/a'}px)`, m.scrollY === 0 && m.btn.bottom <= m.vh && m.nameY.top > 0 && m.logoY.bottom < m.btn.top && cover.length === 0 && !!bar && m.btn.bottom <= bar.top, JSON.stringify({ btn: m.btn, cover }))
    ok(`G9 ${tag} button says "${button}"; fields are name, contact, logo and nothing else`, m.btn.t === button && JSON.stringify(m.inputs) === JSON.stringify(['name', 'contact', 'logo']), `${m.btn.t} ${m.inputs}`)
    ok(`G10 ${tag} no free-tee popup, no second sticky bar`, !m.popup && !m.sticky)
    await ctx.close()
  }
}

// submit: phone only, then email only
async function submit({ q, name, contact, tapProducts = [], band, consent, spam = false, file = false }) {
  const { ctx, page, state } = await phone({ consent })
  state.spam = spam
  await page.goto(`${BASE}/get-a-price${q}`, { waitUntil: 'load' }); await page.waitForTimeout(600)
  for (const t of tapProducts) await page.locator('#gpProducts .gp-chip', { hasText: new RegExp(`^${t}$`) }).click()
  if (band) await page.locator('#gpQty .gp-chip', { hasText: new RegExp(`^${band.replace('+', '\\+')}$`) }).click()
  if (name != null) await page.fill('#gpName', name)
  if (contact != null) await page.fill('#gpContact', contact)
  const urlBefore = page.url()
  await page.locator('#gpBtn').click()
  await page.waitForTimeout(1200)
  const out = { state, page, ctx, url: page.url(), urlBefore, text: await page.evaluate(() => document.getElementById('gp').innerText), done: await page.evaluate(() => !!document.getElementById('gpDone')) }
  return out
}
{
  const a = await submit({ q: '?product=hoodie&preset=cafe&utm_source=ig&utm_medium=paid&utm_campaign=hoodie-season-cafes&utm_content=video1&utm_placement=reels&fbclid=FBCLID123', name: 'Sam', contact: '514 555 0199', tapProducts: ['Hats'], band: '10-24', consent: 'denied' })
  const b = a.state.inbound[0] || {}
  ok('G11 phone only: exactly one request to the OS', a.state.inbound.length === 1, String(a.state.inbound.length))
  ok('G12 it is a website quote request (the kind that becomes a lead), phone set, no email', b.kind === 'quote' && b.phone === '514 555 0199' && b.email === null && b.contact_name === 'Sam' && Array.isArray(b.cart_items) && b.cart_items.length === 0)
  ok('G13 source ad-landing, preset, products, quantity band', b.meta?.source === 'ad-landing' && b.meta?.preset === 'hoodie-cafe' && JSON.stringify(b.meta?.products) === JSON.stringify(['Hoodies', 'Hats']) && b.meta?.quantity_band === '10-24' && b.meta?.quantity_min === 10 && b.meta?.quantity_max === 24 && b.total_qty === 10, JSON.stringify(b.meta))
  const at = b.meta?.attribution || {}
  ok('G14 every utm_*, and the fbclid, saved on the request', at.utm_source === 'ig' && at.utm_medium === 'paid' && at.utm_campaign === 'hoodie-season-cafes' && at.utm_content === 'video1' && at.utm_placement === 'reels' && at.fbclid === 'FBCLID123', JSON.stringify(at))
  ok('G15 notes open with "Short ad form - no sizes or colours yet"', String(b.notes || '').split('\n')[0] === 'Short ad form - no sizes or colours yet', String(b.notes).slice(0, 60))
  ok('G16 no price is sent (nothing was priced)', b.estimated_total === 0)
  ok('G17 the page did not navigate; it swapped to the thank-you', a.url === a.urlBefore && a.done && /Got it\. We’re on it\./.test(a.text) && /We’ll text you a price and a mockup, usually within the hour \(9am-6pm\)\./.test(a.text))
  ok('G18 thank-you: what you sent, and Call + Text', /What you sent/i.test(a.text) && /Hoodies, Hats/.test(a.text) && /10-24/.test(a.text) && (await a.page.locator('#gp a[href="tel:4385443800"]').count()) === 1 && (await a.page.locator('#gp a[href="sms:4385443800"]').count()) === 1)
  ok('G19 10-24 can reach 15: the free-tee line says "Order 15 or more"', /Order 15 or more and you get a free tee/.test(a.text))
  // L: Lead, once, Pixel + server sharing an id
  const px = await pixel(a.page, 'Lead'), sv = await beacons(a.page, 'Lead', a.state)
  ok('L1 one Lead on the Pixel and one server copy', px.length === 1 && sv.length === 1, `${px.length} / ${sv.length}`)
  ok('L2 they share one event_id (Meta counts it once), and it is the OS request id', px[0]?.[3]?.eventID === sv[0]?.body.event_id && sv[0]?.body.event_id === 'req-1', `${px[0]?.[3]?.eventID} vs ${sv[0]?.body.event_id}`)
  ok('L3 without cookie consent the server copy carries no name, phone or email', !JSON.stringify(sv[0]?.body.user_data || {}).match(/Sam|5145550199|514 555/))
  await a.ctx.close()

  const e = await submit({ q: '?product=business', name: 'Dana', contact: 'dana@cafe.ca', band: '25-49', consent: 'granted' })
  const eb = e.state.inbound[0] || {}
  ok('G20 email only: exactly one request, email set, no phone', e.state.inbound.length === 1 && eb.email === 'dana@cafe.ca' && eb.phone === null)
  ok('G21 nothing preselected on the business link and none tapped: products empty, said so in the notes', JSON.stringify(eb.meta?.products) === '[]' && /Wants: not picked/.test(eb.notes))
  ok('G22 thank-you says email, and 25-49 gets the free tee', /We’ll email you a price and a mockup/.test(e.text) && /Your order qualifies for a free tee/.test(e.text))
  const px2 = await pixel(e.page, 'Lead')
  ok('L4 with consent: one Pixel Lead, one server Lead to the OS, same id', px2.length === 1 && e.state.capi.filter((c) => c.event === 'Lead').length === 1 && e.state.capi[0].body.event_id === px2[0][3].eventID && (await beacons(e.page, 'Lead', e.state)).length === 0)
  await e.ctx.close()

  const bad = await submit({ q: '', name: '', contact: '12345' })
  ok('G23 no name or a bad contact: nothing is sent, the fields say why', bad.state.inbound.length === 0 && !bad.done && /Add your name/.test(bad.text) && /phone number or an email/.test(bad.text))
  ok('L5 and no Lead', (await pixel(bad.page, 'Lead')).length === 0)
  await bad.ctx.close()

  const sp = await submit({ q: '?product=hat', name: 'Bot', contact: 'bot@x.io', spam: true })
  ok('L6 the OS says spam: the visitor still sees the thank-you, and no Lead fires', sp.done && (await pixel(sp.page, 'Lead')).length === 0 && (await beacons(sp.page, 'Lead', sp.state)).length === 0)
  await sp.ctx.close()
}
{
  const js = read('get-a-price.js')
  ok('G24 upload waits 45s + 20s per extra file (commit 9361d78b)', /UPLOAD_WAIT_BASE_MS = 45000/.test(js) && /UPLOAD_WAIT_PER_EXTRA_MS = 20000/.test(js))
  ok('G25 leaving mid-upload asks first; the form never navigates', /beforeunload/.test(js) && !/location\.href\s*=/.test(js) && !/form\.submit\(\)/.test(js))
}

// ═════════════════════ L. who may fire Lead ════════════════════════════════
{
  const SKIP = /^(p|fr\/p|_to_delete|tmp|fr\/tmp|node_modules|\.git|scripts)\//
  const files = []
  const walk = (d) => { for (const f of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) { const rel = d ? `${d}/${f.name}` : f.name; if (SKIP.test(rel + '/')) continue; if (f.isDirectory()) walk(rel); else if (/\.(html|js)$/.test(f.name) && !/debug-pixel/.test(rel)) files.push(rel) } }
  walk('')
  const direct = files.filter((f) => /fbq\(\s*'track'\s*,\s*'Lead'/.test(read(f)) || /SP_META\.send\(\s*'Lead'/.test(read(f)))
  ok('L7 the Meta Lead is sent from one place only: SP_LEAD in components.js', JSON.stringify(direct) === JSON.stringify(['components.js']), direct.join(', '))
  const callers = files.filter((f) => /SP_LEAD\.(fire|afterInbound)\(/.test(read(f)) && f !== 'components.js').sort()
  const QUOTE_FORMS = ['businesses/rfp.html', 'fr/businesses/rfp.html', 'get-a-price.js', 'quick-quote.js', 'quote.js']
  ok(`L8 only quote-request forms call it (${QUOTE_FORMS.join(', ')})`, callers.every((c) => QUOTE_FORMS.includes(c)) && callers.includes('get-a-price.js') && callers.includes('quote.js'), callers.join(', '))
  ok('L9 the popup, the price-sheet download and the newsletter never call it', !/SP_LEAD|'Lead'/.test(read('offer-popup.js')) && !/'Lead'/.test(read('businesses.html')) && (!has('fr/businesses.html') || !/'Lead'/.test(read('fr/businesses.html'))))
  ok('L10 /api/meta-capi accepts FreeTeeClaim and PriceSheetDownload', /'FreeTeeClaim', 'PriceSheetDownload'\]/.test(read('api/meta-capi.js')))

  // the popup, for real
  const { ctx, page, state } = await phone({ consent: 'denied' })
  await page.goto(`${BASE}/custom-hoodies-montreal`, { waitUntil: 'load' }); await page.waitForTimeout(500)
  await page.evaluate(() => { const o = document.getElementById('popup'); if (o) o.classList.add('show') })
  const fields = await page.evaluate(() => [...document.querySelectorAll('.sp-op-form input:not([type=checkbox])')].map((i) => [i.name, i.placeholder]))
  ok('T1 popup: phone first ("Mobile number"), email second ("Email (optional)")', JSON.stringify(fields) === JSON.stringify([['phone', 'Mobile number'], ['email', 'Email (optional)']]), JSON.stringify(fields))
  const copy = await page.evaluate(() => ({ p: document.querySelector('.sp-op p[data-i18n="home.popup.p"]')?.textContent, box: document.querySelector('.sp-op-optin span')?.textContent }))
  ok('T2 popup copy', copy.p === "Leave your number and we'll lock it to your quote. Orders of 15+, same design." && copy.box === 'Yes, send me deals from Singhs Print.', JSON.stringify(copy))
  await page.route(`${BASE}/quote**`, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>quote</body></html>' }))
  await page.fill('.sp-op-form input[name="phone"]', '438 555 0100')
  await page.locator('.sp-op-cta').click()
  await page.waitForURL(/\/quote/, { timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(600)
  const claim = state.inbound.find((b) => b.meta?.popup_capture)
  ok('T3 a claim with only a phone goes to the OS as a popup claim', !!claim && claim.phone === '438 555 0100' && claim.email === null && claim.kind === 'other', JSON.stringify(claim || {}).slice(0, 160))
  const ftc = await pixel(page, 'FreeTeeClaim'), lead = await pixel(page, 'Lead')
  const ftcSrv = await beacons(page, 'FreeTeeClaim', state), leadSrv = await beacons(page, 'Lead', state)
  ok('T4 it fires FreeTeeClaim (Pixel + server, one id) and no Lead', ftc.length === 1 && ftc[0][0] === 'trackCustom' && ftcSrv.length === 1 && ftc[0][3]?.eventID === ftcSrv[0].body.event_id && lead.length === 0 && leadSrv.length === 0, `ftc ${ftc.length}/${ftcSrv.length} lead ${lead.length}/${leadSrv.length}`)
  await ctx.close()
}

// ═════════════════════ P. prices ═══════════════════════════════════════════
{
  const { ctx, page, state } = await phone({ consent: 'denied' })
  await page.goto(`${BASE}/quote`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500)
  const strip = () => page.evaluate(() => { const s = document.getElementById('livePriceStrip'); return { shown: getComputedStyle(s).display !== 'none', text: s.innerText.replace(/\s+/g, ' ').trim(), unit: document.getElementById('livePriceUnit').textContent.trim(), cards: [...document.querySelectorAll('.tier-card__price')].map((e) => e.textContent.trim()), page: document.querySelector('#quoteForm, form')?.innerText || '' } })
  await page.evaluate(() => document.querySelector('.product-option[data-garment="tshirt"]').click()); await page.waitForTimeout(2500)
  let s = await strip()
  ok('P1 T-Shirt picked, no quantity yet: the estimate says "Pick a quantity" and shows no price', s.shown && s.unit === 'Pick a quantity' && !/\$\d/.test(s.text), s.text)
  ok('P2 the blank card says "5 for $18.95 each", not "From $9.95"', s.cards.length === 1 && s.cards[0] === `5 for ${usd(priceAt('tshirt', 5))} each`, s.cards.join(' | '))
  ok('P3 nothing in the estimate or the blank cards says $9.95 yet, and nothing was priced at 200', !/9\.95/.test(s.text + s.cards.join(' ')) && !state.priced.includes(200), `priced at ${state.priced}`)
  const pick = async (re) => { await page.evaluate((src) => { const el = [...document.querySelectorAll('#qtyBandSection .qty-band')].find((e) => new RegExp(src).test(e.querySelector('.qty-band__label').textContent.trim())); if (el) el.click() }, re); await page.waitForTimeout(1500) }
  await pick('^25')
  s = await strip()
  ok(`P4 T-Shirt → 25-49: the estimate reads ${usd(priceAt('tshirt', 25))} straight away, with no blank chosen`, s.unit === usd(priceAt('tshirt', 25)) && /25.49 units/.test(s.text) && !/9\.95/.test(s.text), s.text)
  ok('P5 it does not say "starting at 200+"', !/starting at|200\+/.test(s.text), s.text)
  await pick('^200')
  s = await strip()
  ok(`P6 only when 200+ is picked does it read ${usd(priceAt('tshirt', 200))}`, s.unit === usd(priceAt('tshirt', 200)) && /200\+ units/.test(s.text), s.text)
  await ctx.close()

  // "from" prices: every one is the 5-9 row; the homepage and /quote agree
  const from = (rel) => [...read(rel).matchAll(/data-sp-from="([a-z_]+)"(?: data-sp-fmt="([a-z0-9]+)")?[^>]*>([^<]*)</g)].map((m) => ({ g: m[1], fmt: m[2] || 'five', text: m[3] }))
  const home = from('index.html'), tiles = from('quote.html')
  ok('P7 homepage: 8 product cards, each "5 for $X each" from the 5-9 row, with its 25+ line', home.filter((f) => f.fmt === 'five').length === 8 && home.filter((f) => f.fmt === 'five').every((f) => f.text === `5 for ${usd(priceAt(f.g, 5))} each`) && home.filter((f) => f.fmt === 'at25').length === 8 && home.filter((f) => f.fmt === 'at25').every((f) => f.text === `${usd(priceAt(f.g, 25))} each at 25+`), JSON.stringify(home.slice(0, 3)))
  ok('P8 /quote: 9 product tiles, each "5 for $X each" from the 5-9 row', tiles.length === 9 && tiles.every((f) => f.text === `5 for ${usd(priceAt(f.g, 5))} each`), JSON.stringify(tiles.slice(0, 3)))
  const both = home.filter((f) => f.fmt === 'five').filter((h) => tiles.some((t) => t.g === h.g))
  ok(`P9 the homepage and /quote show the same "from" price for every product they share (${both.length})`, both.length >= 8 && both.every((h) => tiles.find((t) => t.g === h.g).text === h.text))
  ok('P10 hats and long sleeves no longer disagree (homepage $14.95/$14.95 vs /quote $15.95/$13.95)', home.find((f) => f.g === 'cap' && f.fmt === 'five').text === tiles.find((f) => f.g === 'cap').text && home.find((f) => f.g === 'longsleeve' && f.fmt === 'five').text === tiles.find((f) => f.g === 'longsleeve').text)
  ok('P11 no page says "Starting at" or "From $" next to a typed price any more', !/home\.price\.startingat">[^<]*<\/span> <strong/.test(read('index.html')) && !/<span class="from">From \$/.test(read('quote.html')))
  if (has('fr/index.html') && has('fr/quote.html')) {
    const eur = (n) => Number(n).toFixed(2).replace('.', ',') + ' $'
    const fh = from('fr/index.html'), ft = from('fr/quote.html')
    ok('P11b French pages: 8 cards and 9 tiles, "5 pour 18,95 $ chacun" from the same rows', fh.filter((f) => f.fmt === 'five').length === 8 && fh.filter((f) => f.fmt === 'five').every((f) => f.text === `5 pour ${eur(priceAt(f.g, 5))} chacun`) && fh.filter((f) => f.fmt === 'at25').every((f) => f.text === `${eur(priceAt(f.g, 25))} chacun à 25+`) && ft.length === 9 && ft.every((f) => f.text === `5 pour ${eur(priceAt(f.g, 5))} chacun`), JSON.stringify(fh.slice(0, 2)))
  }
  // $9.95 anywhere in a page a visitor loads must be on a line about 200+
  const pages = ['index.html', 'quote.html', 'get-a-price.html', 'custom-t-shirts-montreal.html', 'dtg-printing-montreal.html', 'dtf-printing-montreal.html', 'businesses.html', 'why-us.html', 'catalog.html', 'fr/index.html', 'fr/quote.html', 'fr/custom-t-shirts-montreal.html', 'fr/dtg-printing-montreal.html', 'fr/dtf-printing-montreal.html', 'fr/businesses.html'].filter(has)
  const stray = []
  for (const rel of pages) read(rel).split('\n').forEach((line, i) => { if (/(^|[^\d])9[.,]95/.test(line) && !/200/.test(line) && !/^\s*(\/\/|\*)/.test(line)) stray.push(`${rel}:${i + 1}`) })
  ok('P12 "$9.95" appears only on lines that say 200+', stray.length === 0, stray.slice(0, 8).join(', '))
  for (const [rel, g] of [['custom-hats-caps-montreal.html', 'cap'], ['custom-hoodies-montreal.html', 'hoodie'], ['custom-t-shirts-montreal.html', 'tshirt'], ['embroidery-montreal.html', 'polo_embroidery']].filter(([r]) => has(r))) {
    const rows = [...read(rel).matchAll(/data-sp-price="([a-z_]+)@(\d+)">\$([\d.]+)/g)]
    ok(`P13 ${rel}: every ladder row (${rows.length}) is the engine's price for its band`, rows.length >= 9 && rows.every((m) => m[1] === g && Number(m[3]) === priceAt(g, Number(m[2]))), rows.filter((m) => Number(m[3]) !== priceAt(m[1], Number(m[2]))).map((m) => m[0]).join(' '))
    ok(`P14 ${rel}: no band is still labelled 100-249 or 250+`, !/100-249|250\+/.test(read(rel)))
  }
  // homepage in the browser: SP_FROM paints the same thing the HTML ships
  const h = await phone({ consent: 'denied' })
  await h.page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' }); await h.page.waitForTimeout(2000)
  const painted = await h.page.evaluate(() => ({ cards: [...document.querySelectorAll('.product-card [data-sp-from]:not([data-sp-fmt])')].map((e) => e.textContent.trim()), chips: [...document.querySelectorAll('.sp-calc__chip span')].map((e) => e.textContent.trim()) }))
  ok('P15 homepage, live: cards read "5 for $18.95 each" …; slider chips read "5 for $18.95" (was "from $9.95")', painted.cards[0] === `5 for ${usd(priceAt('tshirt', 5))} each` && painted.cards.length === 8 && (painted.chips.length === 0 || painted.chips[0] === `5 for ${usd(priceAt('tshirt', 5))}`) && !painted.chips.some((c) => /9\.95/.test(c)), JSON.stringify(painted))
  await h.ctx.close()
  // a ladder page in the browser: the live number goes in, the words around it stay
  for (const [rel, want] of [['custom-hats-caps-montreal', `${usd(priceAt('cap', 25))}/ea`], ['fr/custom-hats-caps-montreal', `${Number(priceAt('cap', 25)).toFixed(2).replace('.', ',')} $/unité`]].filter(([r]) => has(r + '.html'))) {
    const l = await phone({ consent: 'denied' })
    await l.page.goto(`${BASE}/${rel}`, { waitUntil: 'domcontentloaded' }); await l.page.waitForTimeout(1500)
    const got = await l.page.evaluate(() => [...document.querySelectorAll('[data-sp-price="cap@25"]')].map((e) => e.textContent))
    ok(`P16 /${rel}, live: the 25-49 row reads "${want}"`, got.length === 2 && got.every((g) => g === want), JSON.stringify(got))
    await l.ctx.close()
  }
}

// ═════════════════════ D. details ══════════════════════════════════════════
{
  const SKIP = /^(p|fr\/p|_to_delete|tmp|fr\/tmp|node_modules|\.git)\//
  const files = []
  const walk = (d) => { for (const f of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) { const rel = d ? `${d}/${f.name}` : f.name; if (SKIP.test(rel + '/')) continue; if (f.isDirectory()) walk(rel); else if (/\.(html|js|json|py|mjs)$/.test(f.name) && !/check-conversion-fixes/.test(rel)) files.push(rel) } }
  walk('')
  const NAME = /Singh(?:'|&#39;|&apos;|’|&rsquo;|\\'|\\u2019)s\b/
  const named = files.filter((f) => NAME.test(read(f)))
  ok('D1 the name is written "Singhs Print" everywhere (no "Singh\'s")', named.length === 0, named.slice(0, 8).join(', '))
  const oldHours = files.filter((f) => /9 ?AM ?(?:–|-|\\u2013|to) ?6 ?PM|Ouvert 7 jours sur 7, (?:de )?9 h à 18 h|"opens":\s*"09:00"/.test(read(f)))
  ok('D2 no page still says the shop is open 9AM-6PM', oldHours.length === 0, oldHours.slice(0, 8).join(', '))
  ok('D3 the hours: "Open 7 days, 10am-4pm. Call before visiting." in the footer, the quote page box and the About page', /Open 7 days, 10am-4pm\. Call before visiting\./.test(read('components.js')) && /Open 7 days, 10am-4pm\. Call before visiting\./.test(read('quote.html')) && /Open 7 days, 10am-4pm\. Call 438-544-3800 before you come by\./.test(read('lang.js')))
  ok('D4 structured data: opens 10:00, closes 16:00, seven days', /"opens":"10:00",\s*"closes":"16:00"/.test(read('index.html')) && /"opens":"10:00",\s*"closes":"16:00"/.test(read('components.js')))
  ok('D5 FAQ: "Any deals right now?"', /Any deals right now\?<\/button><div class="faq-a"><p data-i18n="home\.faq\.a8">Free tee on orders of 15\+, same design\. It&#39;s added automatically when you request your quote\.<\/p>/.test(read('index.html')) && !/first-order discount/.test(read('index.html') + read('lang.js')))
  ok('D6 one typed rating: quote.js reads SP_REVIEWS.BAKED instead of its own 5.0 / 23', /BAKED: \{ rating: [\d.]+, count: \d+ \}/.test(comp) && !/id="spSocialRating" style="font-size:\.9rem">5\.0</.test(read('quote.js')) && !/id="spSocialCount">23</.test(read('quote.js')) && /SP_BAKED_REVIEWS/.test(read('quote.js')))
}

// ═════════════════════ live: the baked ladder is the OS's ══════════════════
if (LIVE) {
  try {
    const j = await (await fetch('https://singhsprint-crm.vercel.app/api/pricing/homepage-tiers?d=' + Date.now())).json()
    for (const g of Object.keys(TIERS)) {
      const live = j.tiers?.[g]
      ok(`LIVE ${g}: baked ladder equals the OS's`, JSON.stringify(live) === JSON.stringify(TIERS[g]), live ? `live 5-9 ${live.find((r) => r[0] === 5)?.[2]}, baked ${priceAt(g, 5)}` : 'the OS does not return this garment yet (deploy the OS first)')
    }
  } catch (e) { ok('LIVE the OS answered', false, String(e)) }
}

await browser.close(); srv.close()
console.log(fails ? `\n${fails} FAILED, ${passes} passed` : `\nall ${passes} checks passed`)
process.exit(fails ? 1 : 0)
