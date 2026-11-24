/**
 * What a reader that does not run JavaScript gets from the site (AI crawlers,
 * Bing, Google's first pass), and what we tell the search engines about it.
 *
 * Added 2026-11-24 after the GEO audit: /catalog arrived with zero product
 * links, four pages had no business data until a script ran, there was no
 * llms.txt, and nothing told Bing when a page changed.
 *
 * Run: node scripts/check-geo.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { KEY, urlForFile, urlsToSubmit, sitemapUrls } from './indexnow-submit.mjs'

let pass = 0
const fails = []
const ok = (id, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok  ${id}`) }
  else { fails.push(id); console.log(`FAIL  ${id}${detail ? ' — ' + detail : ''}`) }
}
const ROOT = new URL('../', import.meta.url).pathname
const read = (p) => readFileSync(ROOT + p, 'utf8')

// ── /catalog carries real product links in its own HTML ───────────────────
const indexable = new Set(JSON.parse(read('p/indexable.json')).slugs)
for (const [file, prefix] of [['catalog.html', '/p/'], ['fr/catalog.html', '/fr/p/']]) {
  const html = read(file)
  // By the section, not the generator's comment markers: the French mirror drops comments.
  const at = html.indexOf('id="catPopular"')
  const block = at < 0 ? '' : html.slice(at, html.indexOf('</section>', at))
  const links = [...block.matchAll(/href="([^"]+)"/g)].map((m) => m[1])
  const products = links.filter((h) => h.startsWith(prefix))
  ok(`${file}: the popular list is in the page`, products.length >= 40, `${products.length} product links`)
  const dead = products.filter((h) => !existsSync(ROOT + h.slice(1) + '/index.html'))
  ok(`${file}: every link has a page behind it`, dead.length === 0, dead.slice(0, 3).join(', '))
  const off = products.filter((h) => !indexable.has(h.slice(prefix.length)))
  ok(`${file}: it only lists pages we keep in Google`, off.length === 0, off.slice(0, 3).join(', '))
  ok(`${file}: it links the A-Z index`, links.some((h) => h.endsWith('/catalog/all')))
}
ok('the English catalogue source has no French translation notice', !/Traduction automatique/.test(read('catalog.html')))

// ── Business facts in the page itself ─────────────────────────────────────
for (const f of ['catalog.html', 'why-us.html', 'jerseys.html', 'shop/index.html']) {
  const m = read(f).match(/<script type="application\/ld\+json" id="sp-business-static">([\s\S]*?)<\/script>/)
  let biz = null
  try { biz = JSON.parse(m[1])['@graph'][0] } catch {}
  ok(`${f}: business data without JavaScript`, !!biz && biz.telephone === '+1-438-544-3800'
    && biz.address.streetAddress === '83 rue Sainte-Anne' && biz.priceRange === '$$'
    && biz.openingHoursSpecification.length === 2)
}

// ── llms.txt says what the site says ──────────────────────────────────────
const llms = read('llms.txt')
ok('llms.txt: minimum, turnaround and rush', /Minimum order: 5 pieces/.test(llms) && /5-10 business days/.test(llms) && /3 business days for 25% extra/.test(llms))
ok('llms.txt: hours, phone and address', /Monday to Friday 10am-4pm, Saturday and Sunday 12pm-4pm/.test(llms) && /438-544-3800/.test(llms) && /83 rue Sainte-Anne/.test(llms))
ok('llms.txt: does not claim screen printing or a carrier', /do not run screen printing/.test(llms) && !/Canpar|Purolator/.test(llms))
const linked = [...llms.matchAll(/\]\(https:\/\/www\.singhsprint\.com([^)]*)\)/g)].map((m) => m[1] || '/')
const missing = linked.filter((p) => p !== '/' && !['.html', '/index.html'].some((s) => existsSync(ROOT + p.slice(1) + s)))
ok('llms.txt: every link is a real page', missing.length === 0, missing.join(', '))

// ── IndexNow ──────────────────────────────────────────────────────────────
ok('the IndexNow key file is on the site and holds the key', existsSync(ROOT + KEY + '.txt') && read(KEY + '.txt').trim() === KEY)
ok('files map to the URLs they are served at',
  urlForFile('index.html') === 'https://www.singhsprint.com/' &&
  urlForFile('about.html') === 'https://www.singhsprint.com/about' &&
  urlForFile('p/gildan-18500/index.html') === 'https://www.singhsprint.com/p/gildan-18500' &&
  urlForFile('components.js') === null)
const listed = sitemapUrls()
const noindexPage = 'p/stormtech-gph-1w/index.html'
ok('a noindex product page is never submitted', /noindex/.test(read(noindexPage)) && urlsToSubmit([noindexPage], listed).length === 0)
ok('an indexed page is', urlsToSubmit(['p/gildan-18500/index.html', 'catalog.html'], listed).length === 2)
ok('a shared script changing submits nothing', urlsToSubmit(['components.js', 'lang.js', 'catalog.css'], listed).length === 0)
ok('/catalog/all is in the sitemap', listed.has('https://www.singhsprint.com/catalog/all'))

console.log(`\n${pass} passed, ${fails.length} failed`)
if (fails.length) { console.log('FAILED: ' + fails.join('; ')); process.exit(1) }
