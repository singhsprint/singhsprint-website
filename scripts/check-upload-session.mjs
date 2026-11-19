/**
 * Website artwork stops getting stranded in the OS's "Unfinished uploads"
 * (2026-11-18): SP_UPLOADS in components.js, and the pages wired to it.
 *
 *   node scripts/check-upload-session.mjs        (needs jsdom, or JSDOM_DIR=...)
 *
 *   S  one id per browser (localStorage singhsCartId_v1), sent with uploads
 *   H  the same file is stored once: hashed, reused from the OS or the cache
 *   C  "Where should we send your mockup?" asked once, before the customizer
 *   F  failures reach the OS by sendBeacon, small enough to send
 *   W  quote.js / get-a-price.js / quick-quote.js / catalog.js / jerseys.js
 *      wiring: uploads through SP_UPLOADS, submit sends every stored design,
 *      browser_session and attempt_id, and reports every fallback
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { webcrypto, createHash } from 'node:crypto'

const require = createRequire(process.env.JSDOM_DIR ? join(process.env.JSDOM_DIR, 'x.js') : import.meta.url)
let JSDOM
try { ({ JSDOM } = require('jsdom')) } catch { console.error('jsdom not installed: npm i -D jsdom (or JSDOM_DIR=...)'); process.exit(2) }

const ROOT = new URL('../', import.meta.url).pathname
const src = (f) => readFileSync(ROOT + f, 'utf8')
let pass = 0, fail = 0
const ok = (n, c, d = '') => { if (c) { pass++; console.log('  ok  ' + n) } else { fail++; console.log('  FAIL ' + n + (d ? ' -- ' + d : '')) } }

function makeWindow(html = '<!doctype html><html lang="en"><body></body></html>') {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://www.singhsprint.com/quote' })
  const w = dom.window
  Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true })
  const calls = [], beacons = []
  w.__reuse = false
  w.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), opts })
    const u = String(url)
    if (u.endsWith('/api/inbound/upload-url')) {
      const b = JSON.parse(opts.body)
      if (w.__reuse) return { ok: true, status: 200, json: async () => ({ ok: true, reused: true, path: 'reused/logo.png', signed_url: 'https://signed/reused', mime: b.mime }) }
      return { ok: true, status: 201, json: async () => ({ ok: true, path: 'sess-1/logo.png', upload_url: 'https://storage/put/1', signed_url: '', mime: b.mime }) }
    }
    if (u.startsWith('https://storage/put/')) return { ok: true, status: 200 }
    if (u.endsWith('/upload-url/sign')) return { ok: true, status: 200, json: async () => ({ signed_url: 'https://signed/1' }) }
    return { ok: true, status: 200, json: async () => ({}), text: async () => '' }
  }
  w.navigator.sendBeacon = (url, blob) => { beacons.push({ url, blob }); return true }
  // components.js also wires consent, pixels and the nav; only SP_UPLOADS is under test.
  try { w.eval(src('components.js')) } catch (e) { /* unrelated DOM wiring may throw in jsdom */ }
  return { w, calls, beacons }
}
const fileOf = (text, name = 'logo.png') => {
  const bytes = new TextEncoder().encode(text)
  return { name, type: 'image/png', size: bytes.length, arrayBuffer: async () => bytes.buffer.slice(0) }
}
// jsdom's Blob has no .text(); read it back with jsdom's own FileReader.
const blobText = (w, b) => new Promise((res, rej) => { const r = new w.FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsText(b) })

async function main() {
  // ── S ───────────────────────────────────────────────────────────────────
  {
    const { w } = makeWindow()
    ok('S0 SP_UPLOADS is defined by components.js', !!w.SP_UPLOADS && typeof w.SP_UPLOADS.upload === 'function')
    const a = w.SP_UPLOADS.session(), b = w.SP_UPLOADS.session()
    ok('S1 one id per browser, stored as singhsCartId_v1 (the cart-recovery id)', a === b && w.localStorage.getItem('singhsCartId_v1') === a && /^[a-zA-Z0-9_-]{8,64}$/.test(a))
    w.localStorage.setItem('singhsCartId_v1', 'existingCartId123')
    ok('S2 an existing cart id is reused, not replaced', w.SP_UPLOADS.session() === 'existingCartId123')
  }

  // ── H ───────────────────────────────────────────────────────────────────
  {
    const { w, calls } = makeWindow()
    const f1 = fileOf('PNG-BYTES-ONE')
    const r1 = await w.SP_UPLOADS.upload(f1)
    const req = JSON.parse(calls.find((c) => c.url.endsWith('/api/inbound/upload-url')).opts.body)
    const expect = createHash('sha256').update('PNG-BYTES-ONE').digest('hex')
    ok('H1 the upload request carries this browser\'s id and the file\'s SHA-256', req.browser_session === w.SP_UPLOADS.session() && req.sha256 === expect, JSON.stringify(req))
    ok('H2 first time: PUT to storage, signed after, path returned', r1.path === 'sess-1/logo.png' && r1.signed_url === 'https://signed/1' && calls.some((c) => c.url.startsWith('https://storage/put/')))
    const before = calls.length
    const r2 = await w.SP_UPLOADS.upload(fileOf('PNG-BYTES-ONE', 'renamed.png'))
    ok('H3 the same bytes again (another File, another name) -> no network, same path', calls.length === before && r2.path === r1.path && r2.reused === true)
    const r3 = await w.SP_UPLOADS.upload(f1)
    ok('H4 the same File object again -> same in-flight/cached result', r3.path === r1.path && calls.length === before)
    w.__reuse = true
    w.localStorage.removeItem('sp_upload_cache_v1')
    const n0 = calls.length
    const r4 = await w.SP_UPLOADS.upload(fileOf('PNG-BYTES-TWO'))
    ok('H5 the OS says this browser already stored it -> no PUT, its path is used', r4.path === 'reused/logo.png' && r4.reused === true && !calls.slice(n0).some((c) => c.url.startsWith('https://storage/put/')))
  }

  // ── C ───────────────────────────────────────────────────────────────────
  {
    const { w, calls } = makeWindow()
    let ran = 0
    const asked = w.SP_UPLOADS.askContactThen(() => { ran++ })
    const dlg = w.document.getElementById('spAskContact')
    ok('C1 no contact known -> asks first, and the customizer waits', asked === true && !!dlg && ran === 0 && /Where should we send your mockup\?/.test(dlg.textContent))
    ok('C2 the dialog is accessible: dialog role, labelled input, close button', dlg.getAttribute('role') === 'dialog' && !!dlg.querySelector('label[for="spAskContactInput"]') && !!dlg.querySelector('[aria-label]'))
    const input = dlg.querySelector('input'), form = dlg.querySelector('form')
    input.value = 'not an email'
    form.dispatchEvent(new w.Event('submit', { cancelable: true }))
    ok('C3 junk is refused with a message, nothing continues', ran === 0 && /valid email or phone/.test(dlg.querySelector('[data-err]').textContent))
    input.value = 'amy@example.com'
    form.dispatchEvent(new w.Event('submit', { cancelable: true }))
    ok('C4 a real email: saved, the dialog closes, the customizer opens', ran === 1 && !w.document.getElementById('spAskContact') && w.SP_UPLOADS.contact().email === 'amy@example.com')
    const sent = calls.find((c) => c.url.endsWith('/api/inbound/upload-contact'))
    ok('C5 it is put on this browser\'s uploads in the OS', !!sent && JSON.parse(sent.opts.body).browser_session === w.SP_UPLOADS.session())
    ok('C6 asked once: next time it just carries on', w.SP_UPLOADS.askContactThen(() => { ran++ }) === false && !w.document.getElementById('spAskContact'))
    await w.SP_UPLOADS.upload(fileOf('WITH-CONTACT'))
    const up = JSON.parse(calls.filter((c) => c.url.endsWith('/api/inbound/upload-url')).pop().opts.body)
    ok('C7 later uploads carry the contact', up.email === 'amy@example.com')
    const page = makeWindow('<!doctype html><html lang="fr"><body><input id="email" value=""><input id="phone" value="514 555 0100"></body></html>')
    ok('C8 the quote form already has a phone -> not asked', page.w.SP_UPLOADS.askContactThen(() => {}) === false && page.w.SP_UPLOADS.contact().phone === '514 555 0100')
    const frw = makeWindow('<!doctype html><html lang="fr"><body></body></html>').w
    frw.SP_UPLOADS.askContactThen(() => {})
    ok('C9 French pages ask in French', /Où devons-nous envoyer votre maquette/.test(frw.document.getElementById('spAskContact').textContent))
  }

  // ── F ───────────────────────────────────────────────────────────────────
  {
    const { w, beacons } = makeWindow()
    w.SP_UPLOADS.reportFailure('http_error', { attempt_id: 'att1', status_code: 502, email: 'a@b.co', payload: { kind: 'quote', cart_items: [{ name: 'Hoodie', qty: 25 }] } })
    // components.js also beacons its own page-view event; look only at failure reports.
    const fails = () => beacons.filter((x) => /\/api\/inbound\/failure$/.test(x.url))
    const b = fails()[0], body = JSON.parse(await blobText(w, b.blob))
    ok('F1 sent by sendBeacon as text/plain (no preflight), to /api/inbound/failure', /\/api\/inbound\/failure$/.test(b.url) && /text\/plain/.test(b.blob.type))
    ok('F2 carries kind, attempt, browser id, status and contact', body.kind === 'http_error' && body.attempt_id === 'att1' && body.browser_session === w.SP_UPLOADS.session() && body.status_code === 502 && body.email === 'a@b.co')
    w.SP_UPLOADS.reportFailure('timeout', { attempt_id: 'att2', payload: { notes: 'x'.repeat(100000), cart_items: Array.from({ length: 300 }, (_, i) => ({ name: 'Item ' + i, qty: 1, placement_designs: { a: { path: 'p'.repeat(200) } } })) } })
    const big = await blobText(w, fails()[1].blob)
    ok('F3 a huge cart is trimmed under the 64 KB beacon limit, still saying what was asked', big.length < 60000 && JSON.parse(big).payload.truncated === true && JSON.parse(big).payload.cart_items.length === 5)
  }

  // ── W ───────────────────────────────────────────────────────────────────
  const q = src('quote.js')
  ok('W1 quote.js uploads through SP_UPLOADS (relay kept as fallback)', /window\.SP_UPLOADS\.upload\(file, \{ page: 'quote' \}\)[\s\S]{0,80}uploadDesignFileViaRelay/.test(q))
  ok('W2 the submit sends every design already stored (cart placement_designs / design_path / __spSingleDesign), deduped with the fresh uploads', /function spExistingDesigns\(\)/.test(q) && /spExistingDesigns\(\)\.forEach/.test(q) && /placement_designs/.test(q))
  ok('W3 the submit sends browser_session, attempt_id and single_design', /browser_session: \(window\.SP_UPLOADS/.test(q) && /attempt_id:\s+spAttemptId/.test(q) && /single_design:/.test(q))
  ok('W4 every way the request can miss the OS is reported: http error, network error, timeout, Web3Forms fallback, upload error', ["spFail('http_error'", "spFail('network_error'", "spFail('timeout'", "spFail('web3forms_fallback'", "spFail('upload_error'"].every((k) => q.includes(k)))
  ok('W5 "Customize & preview" asks for a contact first, once', /askContactThen\(function \(\) \{ opts\.__contactAsked = true; spOpenCustomizer\(opts\); \}\)/.test(q))
  const gp = src('get-a-price.js'), qq = src('quick-quote.js'), cat = src('catalog.js'), jer = src('jerseys.js')
  ok('W6 the ad form and the quick quote: SP_UPLOADS upload, browser_session + attempt_id, failure report', [gp, qq].every((s) => /SP_UPLOADS\.upload\(/.test(s) && /browser_session/.test(s) && /attempt_id/.test(s) && /reportFailure\(/.test(s)))
  ok('W7 catalog and jerseys upload through SP_UPLOADS with their old path as fallback', /SP_UPLOADS\.upload\(file, \{ page: 'catalog' \}\)[\s\S]{0,200}dmczPutArtworkDirect/.test(cat) && /SP_UPLOADS\.upload\(file, \{ page: 'jerseys' \}\)[\s\S]{0,200}jerseyPutArtworkDirect/.test(jer))

  console.log(`\n${pass} passed, ${fail} failed`)
  if (fail) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
