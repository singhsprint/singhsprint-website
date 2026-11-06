#!/usr/bin/env node
/**
 * Lead tracking: Google Ads click IDs and the one conversion gate (2026-11-06).
 *
 *   node scripts/check-lead-tracking.mjs
 *
 * Runs the real SP_LEAD block from components.js and the real gtag.js +
 * gtag-config.js in a sandbox, and asserts on what they send.
 *
 * L1  ?gclid / ?gbraid / ?wbraid are kept 90 days in localStorage; bad IDs
 *     are refused; an expired record is dropped; _gcl_aw is the fallback.
 * L2  ad_consent reports the visitor's cookie choice (granted|denied|unset).
 * L3  every POST to the OS's /api/inbound carries `ads`; nothing else is
 *     touched (uploads, GETs, other hosts, non-JSON, a body with ads).
 * L4  spam === true from the OS is the only thing that stops a conversion.
 * L5  a real lead fires Meta Lead (Pixel + server, one event id) and the
 *     Google Ads conversion with send_to AW-17792396715/e5RNCKD857UcEKvbiaRC
 *     and transaction_id = the OS request id. No email/phone to Meta
 *     without consent.
 * L6  every lead form uses SP_LEAD and keys on spam, not queued; every page
 *     that posts to /api/inbound loads components.js.
 */
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const ROOT = new URL('..', import.meta.url).pathname
const file = (rel) => readFileSync(process.env[`F_${rel.replace(/\W/g, '_')}`] || ROOT + rel, 'utf8')
let pass = 0, fail = 0
const ok = (n, c, d = '') => { if (c) { pass++; console.log(`  ok  ${n}`) } else { fail++; console.log(`  FAIL ${n}${d ? ' -- ' + d : ''}`) } }

const components = file('components.js')
const START = '(function initLeadTracking() {'
const i0 = components.indexOf(START)
const i1 = i0 < 0 ? -1 : components.indexOf('\n})();\n', i0)
const BLOCK = i0 < 0 || i1 < 0 ? '' : components.slice(i0, i1 + 6)
ok('L0 components.js has the SP_LEAD block', BLOCK.length > 1000)

const DAY = 864e5
const GCLID = 'Cj0KCQiA_test-GCLID_1234567890'

function sandbox({ search = '', cookie = '', store = {}, now = Date.now(), noStorage = false } = {}) {
  const ls = { ...store }
  const calls = { fetch: [], fbq: [], meta: [], gads: [], logs: [] }
  const localStorage = noStorage
    ? { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') }, removeItem() { throw new Error('blocked') } }
    : { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v) }, removeItem: (k) => { delete ls[k] } }
  const RealDate = Date
  class FakeDate extends RealDate { constructor(...a) { super(...(a.length ? a : [now])) } static now() { return now } }
  const window = {
    fetch: (input, init) => { calls.fetch.push({ input, init }); return Promise.resolve({ ok: true, json: () => Promise.resolve({}) }) },
    fbq: (...a) => calls.fbq.push(a),
    SP_META: { send: (...a) => calls.meta.push(a) },
    SP_GTAG: { trackConversion: (...a) => calls.gads.push(a) },
  }
  const ctx = {
    window, localStorage, document: { cookie }, location: { search, href: 'https://www.singhsprint.com/quote' + search },
    URLSearchParams, JSON, Math, Number, String, Object, Array, isFinite, Date: FakeDate,
    crypto: { randomUUID: () => 'uuid-fallback' },
    setTimeout: (fn) => fn && 0, console: { info: (m) => calls.logs.push(m), log() {}, warn() {} },
  }
  ctx.fetch = (...a) => window.fetch(...a)
  vm.createContext(ctx)
  vm.runInContext(BLOCK, ctx)
  ctx.fetch = (...a) => window.fetch(...a) // forms call the global fetch, which is the wrapper
  return { ...ctx, ls, calls, L: window.SP_LEAD }
}

if (BLOCK) {
  // ── L1 capture / expiry / validation / cookie fallback ─────────────────────
  const now = Date.UTC(2026, 10, 6, 15, 0, 0)
  let s = sandbox({ search: `?gclid=${GCLID}&utm_source=google`, now })
  const rec = JSON.parse(s.ls.sp_gads_click || 'null')
  ok('L1a gclid from the URL is kept in localStorage', rec && rec.gclid === GCLID, JSON.stringify(rec))
  ok('L1b kept for exactly 90 days', rec && rec.exp - now === 90 * DAY, rec && String((rec.exp - now) / DAY))
  ok('L1c click_at is the landing time', rec && rec.click_at === new Date(now).toISOString(), rec && rec.click_at)
  ok('L1d no cookie is written', s.document.cookie === '')
  s = sandbox({ search: '?gbraid=0AAAAA-gbraid_value&wbraid=CkQKCQiwbraid_value', now })
  let ids = s.L.clickIds()
  ok('L1e gbraid and wbraid kept too', ids && ids.gbraid === '0AAAAA-gbraid_value' && ids.wbraid === 'CkQKCQiwbraid_value', JSON.stringify(ids))
  for (const bad of ['short', 'has space in it xx', '<script>alert(1)</script>', 'x'.repeat(301)]) {
    s = sandbox({ search: '?gclid=' + encodeURIComponent(bad), now })
    ok(`L1f refuses gclid ${JSON.stringify(bad.slice(0, 20))}`, !s.ls.sp_gads_click && s.L.clickIds() === null)
  }
  const kept = JSON.stringify({ gclid: GCLID, click_at: new Date(now - 10 * DAY).toISOString(), exp: now - 10 * DAY + 90 * DAY })
  s = sandbox({ store: { sp_gads_click: kept }, now })
  ids = s.L.clickIds()
  ok('L1g a later page (no gclid in URL) still has the 10-day-old click', ids && ids.gclid === GCLID && ids.click_at === new Date(now - 10 * DAY).toISOString())
  const old = JSON.stringify({ gclid: GCLID, click_at: new Date(now - 91 * DAY).toISOString(), exp: now - DAY })
  s = sandbox({ store: { sp_gads_click: old }, now })
  ok('L1h a 91-day-old click is dropped and removed', s.L.clickIds() === null && !('sp_gads_click' in s.ls))
  const ts = Math.floor((now - 5 * DAY) / 1000)
  s = sandbox({ cookie: `_ga=GA1.1.1; _gcl_aw=GCL.${ts}.${GCLID}`, now })
  ids = s.L.clickIds()
  ok('L1i falls back to the _gcl_aw cookie, with its click time', ids && ids.gclid === GCLID && ids.click_at === new Date(ts * 1000).toISOString(), JSON.stringify(ids))
  s = sandbox({ cookie: `_gcl_aw=GCL.${Math.floor((now - 95 * DAY) / 1000)}.${GCLID}`, now })
  ok('L1j ignores a _gcl_aw older than 90 days', s.L.clickIds() === null)
  s = sandbox({ search: `?gclid=${GCLID}`, now, noStorage: true })
  ids = s.L.clickIds()
  ok('L1k storage blocked: the click still rides this page view', ids && ids.gclid === GCLID)

  // ── L2 consent ─────────────────────────────────────────────────────────────
  for (const [stored, want] of [[undefined, 'unset'], ['granted', 'granted'], ['denied', 'denied'], ['junk', 'unset']]) {
    const store = { sp_gads_click: kept }; if (stored) store.sp_consent = stored
    s = sandbox({ store, now })
    ok(`L2 sp_consent=${stored} -> ad_consent ${want}`, s.L.clickIds()?.ad_consent === want, s.L.clickIds()?.ad_consent)
  }

  // ── L3 fetch wrapper ───────────────────────────────────────────────────────
  s = sandbox({ store: { sp_gads_click: kept, sp_consent: 'granted' }, now })
  const post = (url, body, method = 'POST') => { s.calls.fetch.length = 0; s.fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body }); return s.calls.fetch[0].init.body }
  let sent = JSON.parse(post('https://singhsprint-crm.vercel.app/api/inbound', JSON.stringify({ kind: 'quote', email: 'a@b.co' })))
  ok('L3a POST /api/inbound gets ads.gclid', sent.ads && sent.ads.gclid === GCLID, JSON.stringify(sent))
  ok('L3b ...with click_at and ad_consent', sent.ads && sent.ads.click_at === new Date(now - 10 * DAY).toISOString() && sent.ads.ad_consent === 'granted')
  ok('L3c ...and the form fields untouched', sent.kind === 'quote' && sent.email === 'a@b.co')
  sent = JSON.parse(post('/api/inbound', JSON.stringify({ kind: 'rfp' })))
  ok('L3d relative /api/inbound too', sent.ads && sent.ads.gclid === GCLID)
  for (const [label, url, body, method] of [
    ['upload endpoint', 'https://singhsprint-crm.vercel.app/api/inbound/upload-url', '{"a":1}', 'POST'],
    ['GET', 'https://singhsprint-crm.vercel.app/api/inbound', '{"a":1}', 'GET'],
    ['other host', 'https://evil.example/api/inbound', '{"a":1}', 'POST'],
    ['Meta server events', 'https://singhsprint-crm.vercel.app/api/ads/capi/Lead', '{"a":1}', 'POST'],
    ['non-JSON body', 'https://singhsprint-crm.vercel.app/api/inbound', 'name=x', 'POST'],
    ['body already has ads', 'https://singhsprint-crm.vercel.app/api/inbound', '{"ads":{"gclid":"mine"}}', 'POST'],
  ]) ok(`L3e leaves ${label} alone`, post(url, body, method) === body)
  s = sandbox({ now })
  s.fetch('https://singhsprint-crm.vercel.app/api/inbound', { method: 'POST', body: '{"kind":"quote"}' })
  ok('L3f no click: body sent unchanged', s.calls.fetch[0].init.body === '{"kind":"quote"}')

  // ── L4 / L5 conversions ────────────────────────────────────────────────────
  const info = { value: 412.5, contentName: 'Gildan SF500', contentCategory: 'Screen print', numItems: 24, form: 'quote', user: { email: 'pat@example.com', phone: '514-555-0100', name: 'Pat Doe' } }
  s = sandbox({ now })
  let r = s.L.afterInbound({ id: 'req-1', ok: true, queued: false, spam: true }, info)
  ok('L4a spam:true -> no Meta Pixel Lead', s.calls.fbq.length === 0)
  ok('L4b spam:true -> no Meta server Lead', s.calls.meta.length === 0 && s.calls.fetch.length === 0)
  ok('L4c spam:true -> no Google Ads conversion', s.calls.gads.length === 0)
  ok('L4d spam:true -> logged', r === null && s.calls.logs.some((m) => /spam/.test(m)))
  for (const resp of [{ id: 'req-2', queued: false }, {}, null]) {
    s = sandbox({ now })
    s.L.afterInbound(resp, info)
    ok(`L4e not spam (${JSON.stringify(resp)}) -> converts`, s.calls.fbq.length === 1 && s.calls.gads.length === 1)
  }

  s = sandbox({ now }) // no consent
  s.L.afterInbound({ id: 'req-3', spam: false }, info)
  const [fbqArgs] = s.calls.fbq
  ok('L5a Meta Pixel Lead with eventID = OS request id', fbqArgs && fbqArgs[0] === 'track' && fbqArgs[1] === 'Lead' && fbqArgs[3]?.eventID === 'req-3', JSON.stringify(fbqArgs))
  ok('L5b Meta Lead value / currency', fbqArgs && fbqArgs[2].value === 412.5 && fbqArgs[2].currency === 'CAD')
  ok('L5c no consent: server Lead, same id, no PII', s.calls.meta.length === 1 && s.calls.meta[0][0] === 'Lead' && s.calls.meta[0][1] === 'req-3' && !JSON.stringify(s.calls.meta[0]).includes('pat@'), JSON.stringify(s.calls.meta))
  ok('L5d no consent: nothing posted with the email', !s.calls.fetch.some((c) => String(c.init?.body || '').includes('pat@')))
  const [gArgs] = s.calls.gads
  ok('L5e Google: quote_submit, transaction_id = OS request id', gArgs && gArgs[0] === 'quote_submit' && gArgs[1].transaction_id === 'req-3', JSON.stringify(gArgs))
  ok('L5f Google: value 412.5 CAD', gArgs && gArgs[1].value === 412.5 && gArgs[1].currency === 'CAD')

  s = sandbox({ now, store: { sp_consent: 'granted' } })
  s.L.afterInbound({ id: 'req-4' }, info)
  const capi = s.calls.fetch.find((c) => /\/api\/ads\/capi\/Lead$/.test(c.input))
  const cb = capi ? JSON.parse(capi.init.body) : {}
  ok('L5g consent: server Lead to the OS with the same event id', capi && cb.event_id === 'req-4' && s.calls.fbq[0][3].eventID === 'req-4')
  ok('L5h consent: email / phone / name go to Meta', cb.email === 'pat@example.com' && cb.phone === '514-555-0100' && cb.first_name === 'Pat' && cb.last_name === 'Doe', JSON.stringify(cb))
  ok('L5i consent: no duplicate cookie-free server Lead', s.calls.meta.length === 0)

  s = sandbox({ now })
  s.L.afterInbound({ id: 'req-5' }, { ...info, value: undefined })
  ok('L5j no value: omitted, not 0', !('value' in s.calls.gads[0][1]) && !('value' in s.calls.fbq[0][2]))

  // Real gtag.js + gtag-config.js: the hit carries the right send_to.
  const g = { window: {}, Date, console }
  g.window.window = g.window
  vm.createContext(g.window)
  vm.runInContext(file('gtag-config.js'), g.window)
  vm.runInContext(file('gtag.js'), g.window)
  const realGtag = g.window.SP_GTAG
  s = sandbox({ now })
  s.window.SP_GTAG = realGtag
  s.L.afterInbound({ id: 'req-6' }, info)
  const conv = [...g.window.dataLayer].map((a) => Array.from(a)).find((a) => a[0] === 'event' && a[1] === 'conversion')
  ok('L5k gtag conversion send_to AW-17792396715/e5RNCKD857UcEKvbiaRC', conv && conv[2].send_to === 'AW-17792396715/e5RNCKD857UcEKvbiaRC', JSON.stringify(conv))
  ok('L5l gtag conversion transaction_id = OS request id, value, CAD', conv && conv[2].transaction_id === 'req-6' && conv[2].value === 412.5 && conv[2].currency === 'CAD')
}

// ── L6 every form uses the gate ────────────────────────────────────────────
const quote = file('quote.js')
ok('L6a quote.js no longer keys on queued', !/queued\s*===?\s*false/.test(quote))
ok('L6b quote.js suppresses on spam === true only', /__sp_suppressConversion\s*=\s*!!\(j && j\.spam === true\)/.test(quote))
ok('L6c quote.js passes the OS request id to SP_LEAD.fire', /__sp_inboundId\s*=\s*\(j && j\.id\)/.test(quote) && /SP_LEAD\.fire\(\{\s*inboundId: inboundId/.test(quote))
ok('L6d quote.js has no second Lead / conversion of its own', !/fbq\('track',\s*'Lead'/.test(quote) && !/trackConversion\('quote_submit'/.test(quote))
const qq = file('quick-quote.js')
ok('L6e quick-quote uses SP_LEAD.afterInbound with the OS response', /SP_LEAD\.afterInbound\(resp,/.test(qq) && /fireConversions\(j,/.test(qq) && !/queued/.test(qq))
ok('L6f quick-quote has no Lead / conversion of its own', !/fbq\('track',\s*'Lead'/.test(qq) && !/trackConversion\(/.test(qq))
for (const p of ['businesses/rfp.html', 'fr/businesses/rfp.html']) {
  const h = file(p)
  ok(`L6g ${p}: SP_LEAD.afterInbound after the OS answers`, /\.then\(function\(j\) \{[\s\S]{0,400}SP_LEAD\.afterInbound\(j,/.test(h))
  ok(`L6h ${p}: no Lead fired before the OS answers`, !/fbq\('track',\s*'Lead'/.test(h))
}
for (const p of ['quote.html', 'fr/quote.html', 'businesses/rfp.html', 'fr/businesses/rfp.html', 'businesses.html', 'fr/businesses.html', 'inkwear.html', 'fr/inkwear.html', 'youth-initiative.html', 'fr/youth-initiative.html', 'index.html', 'fr/index.html', 'embroidery-montreal.html']) {
  ok(`L6i ${p} loads components.js (click IDs ride its inbound POST)`, /<script[^>]+src="\/?components\.js/.test(file(p)))
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
