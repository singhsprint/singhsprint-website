/**
 * The storefront search reads category, colour and gender words out of what
 * the shopper typed (search-words.js) and applies them as filters.
 *
 * Every case below was a real miss measured against the live index on
 * 2026-11-23: "hoodie" did not return the Gildan 18500, "tee" led with
 * Q-Tees tote bags, "hoodies" returned 8 products against 195 for "hoodie",
 * "chandail" and "casquette" returned nothing, "black hoodie" returned 3.
 *
 * The second half guards the opposite failure: a style number or a brand
 * name being mistaken for a category or a colour.
 *
 * Run: node scripts/check-search-words.mjs
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const words = require('../search-words.js')

let pass = 0
const fails = []
const ok = (id, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok  ${id}`) }
  else { fails.push(id); console.log(`FAIL  ${id}${detail ? ' — ' + detail : ''}`) }
}
const read = (q) => {
  const r = words.interpret(q)
  return r.understood
    ? `${r.types.join('|')} / ${r.colors.join(',')} / ${r.genders.join('|')} / ${r.text}`
    : 'as typed'
}
const expect = (q, want) => ok(`"${q}" -> ${want}`, read(q) === want, `got ${read(q)}`)

// ── Words shoppers use for a category ──────────────────────────────────────
expect('hoodie',              'hoodie /  /  / ')
expect('hoodies',             'hoodie /  /  / ')
expect('Hoody',               'hoodie /  /  / ')
expect('hooded sweatshirt',   'hoodie /  /  / ')
expect('tee',                 'tshirt /  /  / ')
expect('t-shirt',             'tshirt /  /  / ')
expect('T Shirts',            'tshirt /  /  / ')
expect('tshirt',              'tshirt /  /  / ')
expect('cap',                 'hat /  /  / ')
expect('toque',               'beanie /  /  / ')
expect('sweater',             'crewneck|sweater /  /  / ')
expect('long sleeve tee',     'longsleeve /  /  / ')
expect('polo shirt',          'polo /  /  / ')
expect('short sleeve tee',    'tshirt /  /  / ')
// ── French ────────────────────────────────────────────────────────────────
expect('chandail',            'tshirt /  /  / ')
expect('casquette',           'hat /  /  / ')
expect('coton ouaté',         'hoodie /  /  / ')
expect('chandail à capuche noir', 'hoodie / black /  / ')
expect('tuque noire',         'beanie / black /  / ')
expect('manteau',             'jacket /  /  / ')
// ── The brand or detail stays as text ─────────────────────────────────────
expect('gildan hoodie',       'hoodie /  /  / gildan')
expect('champion hoodie grey','hoodie / grey /  / champion')
expect('heavy cotton tee',    'tshirt /  /  / heavy cotton')
expect('north face jacket',   'jacket /  /  / north face')
expect('trucker hat',         'hat /  /  / trucker')
expect('zip hoodie',          'hoodie /  /  / zip')
// ── Colour and gender ─────────────────────────────────────────────────────
expect('black hoodie',        'hoodie / black /  / ')
expect('navy',                ' / blue /  / ')
expect('royal blue polo',     'polo / blue /  / ')
expect('64000 black',         ' / black /  / 64000')
expect('kids tee',            'tshirt /  / youth / ')
expect('hoodie femme',        'hoodie /  / womens / ')
expect('mens black t-shirts', 'tshirt / black / mens|unisex / ')
// ── One typo on a long category word ──────────────────────────────────────
expect('hoddie',              'hoodie /  /  / ')
expect('jaket',               'jacket /  /  / ')
// ── Must be left exactly as typed ─────────────────────────────────────────
for (const q of ['18500', 'g185', 'bc3001', 'gildan 5000', 'bella canvas', 'champion', 'gilden',
  'comfort colors', 'carhartt', 'richardson 112', 'red kap', 'red kap shirt', 'Q-Tees',
  'q-tees tote', 'jerzees', 'port authority', 'hood', 'ho', 'zip up', 'backpack', '']) {
  expect(q, 'as typed')
}
ok('as typed keeps the original text', words.interpret('  Gildan 5000 ').text === 'Gildan 5000')
ok('"royal" inside a product name is not a colour', read('true royal') === 'as typed' || read('royal apparel') === 'as typed')

// ── Filters handed to Algolia ─────────────────────────────────────────────
const ff = words.facetFiltersFor(words.interpret('mens black sweater'))
ok('category is an OR group', JSON.stringify(ff[0]) === '["category_effective:crewneck","category_effective:sweater"]')
ok('colour is its own AND term', ff[1] === 'color_families:black')
ok('gender is an OR group', JSON.stringify(ff[2]) === '["gender:mens","gender:unisex"]')
ok('nothing understood, no filters', words.facetFiltersFor(words.interpret('18500')).length === 0)

// ── Both search boxes go through the same reader ──────────────────────────
const ROOT = new URL('../', import.meta.url).pathname
const header  = readFileSync(ROOT + 'components.js', 'utf8')
const catalog = readFileSync(ROOT + 'catalog-algolia.js', 'utf8')
ok('header suggestions use the reader', /SPSearchWords/.test(header) && /words\.interpret\(q\)/.test(header))
ok('catalogue page uses the reader', /words\.interpret\(opts\.q\)/.test(catalog))
ok('header suggestions search the catalogue index, not the CRM list',
  /algoliaSuggest\(it\.text, words\.facetFiltersFor\(it\)\)/.test(header))
ok('both fall back to the words as typed', /algoliaSuggest\(q, \[\]\)/.test(header) && /_asTyped: true/.test(catalog))
ok('a slow old answer cannot overwrite a newer one', /if \(mine !== seq\) return;/.test(header))
ok('typed text is escaped before it reaches the page', /spEsc\(q\)/.test(header) && /spEsc\(p\.name/.test(header))
ok('a suggestion opens the product itself', /'\/catalog\?product=' \+ encodeURIComponent\(p\.product_id\)/.test(header))
for (const f of ['catalog.html', 'fr/catalog.html']) {
  const h = readFileSync(ROOT + f, 'utf8')
  ok(`${f} loads search-words.js before catalog-algolia.js`,
    h.indexOf('/search-words.js') > 0 && h.indexOf('/search-words.js') < h.indexOf('/catalog-algolia.js'))
}

console.log(`\n${pass} passed, ${fails.length} failed`)
if (fails.length) { console.log('FAILED: ' + fails.join('; ')); process.exit(1) }
