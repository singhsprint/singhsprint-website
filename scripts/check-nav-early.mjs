/**
 * The menu bar renders when components.js runs, not at DOMContentLoaded.
 *
 *   node scripts/check-nav-early.mjs     (needs jsdom: npm i -D jsdom, or JSDOM_DIR=<dir with node_modules/jsdom>)
 *
 * Why: DOMContentLoaded waits for every deferred script to download and run.
 * Measured 2026-11-11 on /quote: DOMContentLoaded at 2.9 s, quote.js (545 KB)
 * took 2.8 s of it, and the header waited the whole time.
 *
 * Runs the real components.js in jsdom in the three ways pages load it:
 *   A  deferred (122 pages: catalog, quote, home...): it runs with the page
 *      parsed (readyState "interactive") and the header is there at once,
 *      before DOMContentLoaded; the footer still waits for DOMContentLoaded;
 *      after it, exactly one header.
 *   B  plain <script> at the end of <body> (the product pages): the
 *      placeholder already exists, so the header is there at once too.
 *   C  a <script> in <head> (placeholder not parsed yet): nothing yet, then
 *      the header at DOMContentLoaded, once.
 *   D  vercel.json: .js/.css are no longer revalidated on every page view
 *      (max-age=0, must-revalidate) but kept a few minutes; images unchanged.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(process.env['F_' + f.replace(/\W/g, '_')] || join(ROOT, f), 'utf8')
const require = createRequire(process.env.JSDOM_DIR ? join(process.env.JSDOM_DIR, 'x.js') : import.meta.url)
let JSDOM
try { ({ JSDOM } = require('jsdom')) } catch { console.log('jsdom not installed: npm i -D jsdom (or JSDOM_DIR=...)'); process.exit(2) }

let pass = 0, fail = 0
const ok = (n, c, d = '') => { if (c) { pass++; console.log('  ok  ' + n) } else { fail++; console.log('  FAIL ' + n + (d ? ' -- ' + d : '')) } }

function make(body, state) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${body}</body></html>`, { url: 'https://www.singhsprint.com/quote', runScripts: 'outside-only', pretendToBeVisual: true })
  const w = dom.window
  let rs = state
  Object.defineProperty(w.document, 'readyState', { configurable: true, get: () => rs })
  w.fetch = async () => ({ ok: true, json: async () => ({}) })
  w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }))
  w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }
  const marks = []
  try { w.performance.mark = (n) => { marks.push({ n, headers: w.document.querySelectorAll('#nav-placeholder header.sp-nav').length }) } } catch (e) {}
  const headers = () => w.document.querySelectorAll('#nav-placeholder header.sp-nav').length
  const footer = () => (w.document.getElementById('footer-placeholder')?.innerHTML || '').length > 0
  const dcl = () => { rs = 'interactive'; w.document.dispatchEvent(new w.Event('DOMContentLoaded')) }
  return { w, marks, headers, footer, dcl, run: () => w.eval(read('components.js')) }
}
const PAGE = '<div id="nav-placeholder"></div><main>page</main><div id="footer-placeholder"></div>'

{
  const p = make(PAGE, 'interactive'); let err = null
  try { p.run() } catch (e) { err = e }
  ok('A1 deferred: the header is in the page as soon as components.js runs, before DOMContentLoaded', !err && p.headers() === 1, err ? String(err).slice(0, 200) : 'headers ' + p.headers())
  ok('A2 deferred: the footer still waits for DOMContentLoaded', !p.footer())
  ok('A3 the moment is recorded (performance mark sp-nav-rendered)', p.marks.length === 1 && p.marks[0].n === 'sp-nav-rendered' && p.marks[0].headers === 1, JSON.stringify(p.marks))
  p.dcl()
  ok('A4 after DOMContentLoaded: the footer is there, still exactly one header, and the header was built once (not rebuilt, listeners not doubled)', p.footer() && p.headers() === 1 && p.marks.length === 1, `footer ${p.footer()} headers ${p.headers()} builds ${p.marks.length}`)
}
{
  const p = make(PAGE, 'loading'); p.run()
  ok('B1 plain script at the end of <body>: header at once', p.headers() === 1)
  p.dcl()
  ok('B2 …and still one header after DOMContentLoaded, built once', p.headers() === 1 && p.marks.length === 1, 'builds ' + p.marks.length)
}
{
  const p = make('', 'loading'); p.run()
  ok('C1 script in <head>, placeholder not parsed yet: no header, no error', p.headers() === 0)
  p.w.document.body.innerHTML = PAGE
  p.dcl()
  ok('C2 …the header appears at DOMContentLoaded, once', p.headers() === 1, 'headers ' + p.headers())
}
{
  const v = JSON.parse(read('vercel.json'))
  const cc = (src) => (v.headers.find((h) => h.source === src)?.headers || []).find((x) => x.key === 'Cache-Control')?.value || ''
  for (const src of ['/(.*\\.js)', '/(.*\\.css)']) {
    const c = cc(src), m = c.match(/(?:^|[ ,])max-age=(\d+)/)
    ok(`D1 ${src}: kept ${m ? m[1] : '?'} s in the browser, not revalidated on every view`, !!m && Number(m[1]) >= 60 && Number(m[1]) <= 600 && !/must-revalidate/.test(c), c)
  }
  ok('D2 images unchanged (a week in the browser)', /max-age=604800/.test(cc('/images/(.*)')), cc('/images/(.*)'))
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
