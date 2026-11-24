#!/usr/bin/env node
/**
 * generate-catalog-popular.mjs
 *
 * /catalog is drawn by JavaScript: the page arrives with an empty grid and
 * not one product link, so a reader that does not run scripts (most AI
 * crawlers, and Google's first pass) sees a catalogue with nothing in it.
 *
 * This writes a plain list of the shop's most-ordered blanks into
 * catalog.html itself, between the popular:start / popular:end markers:
 * real names, real links to the product pages, and a link to /catalog/all
 * (every style, A to Z). The list is p/indexable.json, the same list that
 * decides which product pages stay in Google, read back out of the generated
 * pages so the names here cannot drift from the pages they link to.
 *
 * It also keeps i18n/fr.json covering the block: product names are not
 * translated anywhere on the French side (the /fr/p/ pages keep the maker's
 * name too), so each one is recorded as "same in French", which is what
 * stops check-fr-coverage reading them as forgotten English.
 *
 * Run after generate-product-pages.mjs, before generate-fr-mirror.mjs:
 *   node scripts/generate-catalog-popular.mjs
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const START = '<!-- popular:start (written by scripts/generate-catalog-popular.mjs; do not edit by hand) -->'
const END   = '<!-- popular:end -->'

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const unesc = (s) => String(s).replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&reg;/g, '®').replace(/&rsquo;/g, '’')

const slugs = JSON.parse(await fs.readFile(path.join(ROOT, 'p', 'indexable.json'), 'utf8')).slugs
const items = []
for (const slug of slugs) {
  let html
  try { html = await fs.readFile(path.join(ROOT, 'p', slug, 'index.html'), 'utf8') } catch { continue }
  const brandStyle = (html.match(/<nav class="crumbs"[\s\S]*?· ([^<·]+)\s*<\/div>/) || [])[1]
  const name = (html.match(/<h1>([^<]*)<\/h1>/) || [])[1]
  if (!brandStyle || !name) continue
  const bs = unesc(brandStyle.trim()), nm = unesc(name.trim())
  // Some feeds repeat "Brand Style - " at the front of the name.
  const tail = nm.toLowerCase().startsWith(bs.toLowerCase()) ? nm.slice(bs.length).replace(/^[\s\-–—:]+/, '') : nm
  items.push({ slug, label: tail ? `${bs}: ${tail}` : bs })
}
items.sort((a, b) => a.label.localeCompare(b.label))

const HEAD  = 'Popular blanks'
const INTRO = 'The styles our customers order most. Each one has its own page with colours, sizes and pricing.'
const ALL   = 'See every style, A to Z'
// The translation memory is keyed by the sentence as it sits in the HTML,
// link markup included (scripts/lib/html-segments.mjs).
const linkOf = (i) => `<a href="/p/${i.slug}">${esc(i.label)}</a>`
const ALL_LINK = `<a class="cat-popular__all" href="/catalog/all">${ALL}</a>`
const block = `${START}
  <section class="cat-popular" id="catPopular" aria-labelledby="catPopularH">
    <h2 id="catPopularH">${HEAD}</h2>
    <p>${INTRO}</p>
    <ul>
${items.map((i) => `      <li>${linkOf(i)}</li>`).join('\n')}
    </ul>
    <p>${ALL_LINK}</p>
  </section>
  ${END}`

const file = path.join(ROOT, 'catalog.html')
let page = await fs.readFile(file, 'utf8')
if (page.includes(START)) {
  page = page.slice(0, page.indexOf(START)) + block + page.slice(page.indexOf(END) + END.length)
} else {
  const anchor = '  <!-- Floating cart bar'
  if (!page.includes(anchor)) { console.error('catalog.html: anchor not found'); process.exit(1) }
  page = page.replace(anchor, block + '\n\n' + anchor)
}
await fs.writeFile(file, page, 'utf8')

// French: headings translated, product names recorded as unchanged.
const tmFile = path.join(ROOT, 'i18n', 'fr.json')
const tm = JSON.parse(await fs.readFile(tmFile, 'utf8'))
tm[HEAD]  = 'Vêtements populaires'
tm[INTRO] = 'Les modèles que nos clients commandent le plus. Chacun a sa page avec couleurs, tailles et prix.'
tm[ALL_LINK] = ALL_LINK.replace(ALL, 'Voir tous les modèles, de A à Z')
for (const i of items) if (!(linkOf(i) in tm)) tm[linkOf(i)] = linkOf(i)
// Existing order is kept (new sentences go at the end) so the diff is only
// what this run added.
await fs.writeFile(tmFile, JSON.stringify(tm, null, 1), 'utf8')

console.log(`catalog.html: ${items.length} popular blanks written`)
