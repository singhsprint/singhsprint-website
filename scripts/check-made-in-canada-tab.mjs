/**
 * The catalog's "Made in Canada" tab.
 *
 *   node scripts/check-made-in-canada-tab.mjs     (needs jsdom: npm i -D jsdom, or JSDOM_DIR=<dir with node_modules/jsdom>)
 *
 * Measured on the real files, by running them:
 *   A  catalog-algolia.js — search({ canadian: true }) sends the facet
 *      is_canadian_made:true in the main query; without it, it does not. The
 *      facet is the product's own flag (CRM migration 20261111a); no supplier
 *      code is involved, so a delisted line cannot come back through it.
 *   B  catalog.js in a DOM — the chip row has a "Made in Canada" chip; clicking
 *      it re-searches with canadian: true and lights the chip; clicking again
 *      turns it off; ?canadian=1 lands with it on; "Clear filters" turns it off;
 *      the legacy /api/catalog fallback carries canadian=1; a Canadian-made
 *      card wears the badge and others do not.
 *   C  lang.js — the chip and badge strings exist in English and French.
 *   D  the menu bar (components.js in a DOM, EN and FR): a "Made in Canada"
 *      item to /catalog?canadian=1, every sub-link keeps canadian=1, it is in
 *      the phone drawer and the phone category strip too, and no menu link
 *      asks for Canadian-made jackets (there are none; it opened "No matches").
 *   E  image size: Jerico's Shopify originals are 2000x2500 to 4000x5000
 *      (56 MB for one Made in Canada page, measured 2026-11-11). The card,
 *      the swatches and the big view ask Shopify's CDN for ?width=, and so do
 *      the search dropdown, the gift builder and the quote page; other hosts
 *      are untouched.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import vm from 'node:vm'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(process.env['F_' + f.replace(/\W/g, '_')] || join(ROOT, f), 'utf8')
const require = createRequire(process.env.JSDOM_DIR ? join(process.env.JSDOM_DIR, 'x.js') : import.meta.url)
let JSDOM
try { ({ JSDOM } = require('jsdom')) } catch { console.log('jsdom not installed: npm i -D jsdom (or JSDOM_DIR=...)'); process.exit(2) }

let pass = 0, fail = 0
const ok = (n, c, d = '') => { if (c) { pass++; console.log('  ok  ' + n) } else { fail++; console.log('  FAIL ' + n + (d ? ' -- ' + d : '')) } }
const J = JSON.stringify
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms))

// ── A. the Algolia bridge ─────────────────────────────────────────────────
async function algoliaFilters(opts) {
  const sent = []
  const window = { SP_ALGOLIA_CONFIG: { appId: 'APP', searchKey: 'k', indexName: 'idx' } }
  const ctx = vm.createContext({
    window, console, URLSearchParams, encodeURIComponent, decodeURIComponent, Map, JSON, Object, Array, Math, String, Number, Promise,
    fetch: async (url, init) => { sent.push(JSON.parse(init.body)); return { ok: true, json: async () => ({ results: [{ hits: [], nbHits: 0, nbPages: 0, facets: {} }].concat(JSON.parse(init.body).requests.slice(1).map(() => ({ hits: [], facets: {} }))) }) } },
  })
  vm.runInContext(read('catalog-algolia.js'), ctx)
  await window.SPCatalog.search(opts)
  const main = sent[0]?.requests?.[0]?.params ?? ''
  const ff = new URLSearchParams(main).get('facetFilters')
  return ff ? JSON.parse(ff).flat() : []
}

// ── B. the catalog page ───────────────────────────────────────────────────
const SHOP = 'https://cdn.shopify.com/s/files/1/0738/5235/4810/files/15-Black-2000x2500.png?v=1749538216'
const P = (id, canadian, extra = {}) => ({ product_id: id, brand: 'Jerico', style_number: id, name: 'Tee ' + id, garment_type: 'tshirt', category_effective: 'tshirt',
  price_from: 12, in_stock: true, is_canadian_made: canadian, hero_image_url: canadian ? SHOP : 'https://cdn.ssactivewear.com/Images/Style/1_fm.jpg',
  colors: [{ color_id: id + 'c', color_name: 'Black', hex_code: '#000', sizes_in_stock: ['M'], mockup_front_url: canadian ? SHOP : 'https://cdn.ssactivewear.com/Images/Color/1_f_fm.jpg' }], ...extra })

async function page(query = '') {
  const html = read('catalog.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  const dom = new JSDOM(html, { url: 'https://www.singhsprint.com/catalog' + query, runScripts: 'outside-only', pretendToBeVisual: true })
  const w = dom.window
  const calls = [], fetched = []
  w.SPCatalog = { search: async (o) => { calls.push(JSON.parse(J(o))); return { products: [P('15', true), P('8000', false)], total: 2, totalPages: 1, facets: {} } } }
  w.fetch = async (u) => { fetched.push(String(u)); return { ok: true, json: async () => ({ products: [], total: 0 }) } }
  w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }
  w.scrollTo = () => {}
  w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }))
  try { w.eval(read('catalog.js')) } catch (e) { return { err: e } }
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'))
  await tick(150)
  const chip = () => [...w.document.querySelectorAll('#chipRow .chip')].find((c) => /Made in Canada/.test(c.textContent))
  return { w, calls, fetched, chip }
}

async function main() {
  const on = await algoliaFilters({ canadian: true, inStockOnly: true })
  const off = await algoliaFilters({ inStockOnly: true })
  ok('A1 canadian: true sends is_canadian_made:true', on.includes('is_canadian_made:true'), J(on))
  ok('A2 without it, no Canadian facet', !off.some((f) => /canadian/.test(f)), J(off))
  ok('A3 the Canadian facet names no supplier', !on.some((f) => /supplier_code/.test(f)), J(on))

  const a = await page()
  if (a.err) { ok('B0 catalog.js runs in a DOM', false, String(a.err && a.err.stack || a.err).slice(0, 300)) }
  else {
    const c0 = a.chip()
    ok('B1 the chip row has a Made in Canada chip, off by default', !!c0 && /\bpassive\b/.test(c0.className) && a.calls.at(-1)?.canadian === false, c0 ? c0.className + ' ' + J(a.calls.at(-1)) : 'no chip')
    const n = a.calls.length
    c0?.click(); await tick(250)
    ok('B2 clicking it re-searches with canadian: true and lights the chip', a.calls.length > n && a.calls.at(-1)?.canadian === true && /\bactive\b/.test(a.chip()?.className || ''), J(a.calls.at(-1)))
    const cards = [...a.w.document.querySelectorAll('#catGrid .card')]
    const badgeOf = (id) => cards.find((c) => c.innerHTML.includes('Tee ' + id))?.querySelector('.badge--canadian')
    ok('B3 the Canadian-made card wears the badge; the other does not', cards.length >= 2 && !!badgeOf('15') && !badgeOf('8000'), `cards ${cards.length}`)
    const clear = [...a.w.document.querySelectorAll('#chipRow .chip')].find((c) => /Clear filters/.test(c.textContent))
    ok('B4 the filter counts as active ("Clear filters" shows)', !!clear)
    clear?.click(); await tick(250)
    ok('B5 Clear filters turns it off', a.calls.at(-1)?.canadian === false && /\bpassive\b/.test(a.chip()?.className || ''), J(a.calls.at(-1)))
    a.chip()?.click(); await tick(250); a.chip()?.click(); await tick(250)
    ok('B6 a second click turns it back off', a.calls.at(-1)?.canadian === false, J(a.calls.at(-1)))
  }
  const b = await page('?canadian=1')
  ok('B7 ?canadian=1 lands with the tab on', !b.err && b.calls[0]?.canadian === true && /\bactive\b/.test(b.chip()?.className || ''), J(b.calls[0]))

  // legacy path: no Algolia
  const html = read('catalog.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  const dom = new JSDOM(html, { url: 'https://www.singhsprint.com/catalog?canadian=1', runScripts: 'outside-only', pretendToBeVisual: true })
  const fetched = []
  dom.window.fetch = async (u) => { fetched.push(String(u)); return { ok: true, json: async () => ({ products: [], total: 0 }) } }
  dom.window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }
  dom.window.scrollTo = () => {}
  try { dom.window.eval(read('catalog.js')); dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded')) } catch (e) {}
  await tick(150)
  const cat = fetched.find((u) => /\/api\/catalog\?/.test(u))
  ok('B8 without Algolia, /api/catalog is asked for canadian=1', !!cat && new URL(cat).searchParams.get('canadian') === '1', J(fetched.slice(0, 3)))

  // ── E. image size on the catalog page ──
  {
    const e = await page('?canadian=1')
    const card = [...e.w.document.querySelectorAll('#catGrid .card')].find((c) => c.innerHTML.includes('Tee 15'))
    const srcs = card ? [...card.querySelectorAll('img')].map((i) => i.getAttribute('src') || '') : []
    const shop = srcs.filter((u) => u.startsWith('https://cdn.shopify.com/'))
    ok('E1 a Jerico card asks Shopify for a sized picture, never the original', shop.length > 0 && shop.every((u) => /[?&]width=\d+$/.test(u) && Number(u.match(/width=(\d+)/)[1]) <= 640), J(srcs))
    const other = [...e.w.document.querySelectorAll('#catGrid .card')].find((c) => c.innerHTML.includes('Tee 8000'))
    const osrc = other ? [...other.querySelectorAll('img')].map((i) => i.getAttribute('src') || '') : []
    ok('E2 other suppliers still go through the image proxy, unchanged', osrc.length > 0 && osrc.every((u) => !/cdn\.shopify\.com/.test(u) && !/[?&]width=/.test(u)), J(osrc))
  }
  // the three other pictures-on-the-page helpers, run for real (extracted and evaluated)
  {
    const fn = (file, re) => { const m = read(file).match(re); return m ? m[0] : null }
    const run = (code, name, arg) => { const ctx = vm.createContext({ IMAGE_PROXY: 'P', IMAGE_PROXY_FOR_QUOTE: 'P', IMG_PROXY: 'P', PROXIED_HOSTS: ['ssactivewear.com', 'blanks.ca', 'sanmarcanada.com'], encodeURIComponent }); vm.runInContext(code, ctx); return ctx[name](arg) }
    const cases = [
      ['components.js', /function searchImgUrl\(raw\) \{[\s\S]*?\n            \}/, 'searchImgUrl', 200],
      ['gifts.js', /function imgUrl\(raw\) \{[\s\S]*?\n  \}/, 'imgUrl', 800],
      ['quote.js', /function \w+\(raw\) \{\s*if \(!raw\) return '';\s*if \(raw\.indexOf\('\/api\/image-proxy'\)[\s\S]*?\n    \}/, null, 900],
    ]
    for (const [file, re, name, w] of cases) {
      const code = fn(file, re)
      const nm = name || (code && code.match(/function (\w+)/)[1])
      let got = null, keep = null, twice = null
      try { got = run(code, nm, SHOP); keep = run(code, nm, 'https://cdn.ssactivewear.com/a.jpg'); twice = run(code, nm, SHOP + '&width=4000') } catch (err) { got = 'ERR ' + err.message }
      ok(`E3 ${file}: a Shopify original comes back at width=${w}; an S&S photo is not resized; an existing width is replaced, not doubled`,
        got === SHOP + '&width=' + w && !/width=/.test(String(keep)) && twice === SHOP + '&width=' + w, J([got, keep, twice]))
    }
  }

  // ── D. the menu bar ──
  for (const lang of ['en', 'fr']) {
    const base = lang === 'fr' ? '/fr' : ''
    const dom = new JSDOM('<!doctype html><html><body><div id="nav-placeholder"></div><div id="footer-placeholder"></div></body></html>', { url: 'https://www.singhsprint.com' + base + '/catalog', runScripts: 'outside-only', pretendToBeVisual: true })
    const w = dom.window
    w.fetch = async () => ({ ok: true, json: async () => ({}) })
    w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }))
    w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }
    let err = null
    try { w.eval(read('components.js')); w.document.dispatchEvent(new w.Event('DOMContentLoaded')) } catch (e) { err = e }
    await tick(100)
    const label = lang === 'fr' ? 'Fabriqué au Canada' : 'Made in Canada'
    const links = [...w.document.querySelectorAll('a')]
    const href = (a) => new URL(a.getAttribute('href'), 'https://www.singhsprint.com').pathname + new URL(a.getAttribute('href'), 'https://www.singhsprint.com').search
    const top = links.find((a) => a.classList.contains('sp-nav-item') && a.textContent.trim() === label)
    ok(`D1 [${lang}] the menu bar has "${label}" -> ${base}/catalog?canadian=1`, !err && !!top && href(top) === base + '/catalog?canadian=1', err ? String(err).slice(0, 200) : top ? href(top) : J(links.filter((a) => a.classList.contains('sp-nav-item')).map((a) => a.textContent.trim())))
    const subs = top ? [...top.closest('.sp-nav-parent').querySelectorAll('a')].filter((a) => a !== top) : []
    ok(`D2 [${lang}] its ${subs.length} sub-links all keep canadian=1 and stay in ${lang}`, subs.length >= 5 && subs.every((a) => /[?&]canadian=1/.test(href(a)) && href(a).startsWith(base + '/catalog')), J(subs.map(href)))
    const drawer = links.filter((a) => /[?&]canadian=1/.test(a.getAttribute('href') || '') && a.closest('.sp-drawer, [class*=drawer]'))
    const strip = [...w.document.querySelectorAll('.sp-mobile-cats a')].find((a) => href(a) === base + '/catalog?canadian=1')
    ok(`D3 [${lang}] it is in the phone drawer and the phone category strip`, drawer.length > 0 && !!strip && strip.textContent.includes(label), J({ drawer: drawer.length, strip: !!strip }))
    ok(`D4 [${lang}] no menu link asks for Canadian-made jackets`, !links.some((a) => /type=jacket/.test(a.getAttribute('href') || '') && /canadian=1/.test(a.getAttribute('href') || '')))
  }

  // ── C. strings ──
  const lang = read('lang.js')
  for (const k of ['cat.chip.madeincanada', 'cat.card.madeincanada', 'nav.madeincanada']) {
    const m = lang.match(new RegExp(`'${k.replace(/\./g, '\\.')}'\\s*:\\s*\\{\\s*en:\\s*'([^']+)',\\s*fr:\\s*'([^']+)'`))
    ok(`C1 ${k}: English and French`, !!m && /Made in Canada/.test(m[1]) && /Fabriqué au Canada/.test(m[2]), m ? J([m[1], m[2]]) : 'missing')
  }

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
