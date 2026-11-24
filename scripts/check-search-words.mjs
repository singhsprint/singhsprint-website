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

// ── Did you mean ──────────────────────────────────────────────────────────
ok('no brand list yet: brand spelling is left alone', words.interpret('gilden').corrected === null)
words.setBrands(['Gildan', 'Champion', 'Comfort Colors', 'Under Armour', 'Carhartt', 'Bella + Canvas®',
  'Stormtech', 'Port Authority', 'Sportsman', 'Adidas', 'Nike', 'Hanes', 'Red Kap', 'Q-Tees', 'Leather Co'])
const dym = (q) => words.interpret(q).corrected
ok('gilden -> gildan', dym('gilden') === 'gildan' && words.interpret('gilden').text === 'gildan')
ok('gilden hoddie -> gildan hoodie', dym('gilden hoddie') === 'gildan hoodie')
ok('champoin hoodie -> champion hoodie', dym('champoin hoodie') === 'champion hoodie')
ok('comfort colours -> comfort colors', dym('comfort colours') === 'comfort colors')
ok('under armor -> under armour', dym('under armor') === 'under armour')
ok('a word still being typed is not a mistake', dym('carhart beanie') === null && dym('gilda') === null && dym('hoodi') === null)
ok('"hoodi" is still read as a hoodie', words.interpret('hoodi').types[0] === 'hoodie')
ok('black gilden tee keeps every word', dym('black gilden tee') === 'black gildan tee')
ok('hoddie -> hoodie', dym('hoddie') === 'hoodie')
for (const q of ['gildan', 'gildan hoodie', '18500', 'heavy cotton tee', 'nike', 'niek', 'hoodie', 'black hoodie', 'bc3001']) {
  ok(`"${q}" is spelled right: no suggestion`, dym(q) === null, `got ${dym(q)}`)
}
ok('a style number is never "corrected"', dym('g18500') === null && dym('64000l') === null)

// A respelling is only kept when the word as typed is not in the catalogue.
// Found on the preview 2026-11-23: "heather grey tee" became "leather grey tee".
{
  const inCatalogue = (list) => Promise.resolve(list.map((w) => (w === 'heather' ? 500 : 0)))
  const a = await words.interpretChecked('heather grey tee', inCatalogue)
  ok('"heather" is a real catalogue word: left alone', a.corrected === null && a.text === 'heather' && a.types[0] === 'tshirt')
  const b = await words.interpretChecked('gilden hoddie', inCatalogue)
  ok('"gilden" is on no product: corrected', b.corrected === 'gildan hoodie' && b.text === 'gildan')
  const c = await words.interpretChecked('gilden', () => Promise.reject(new Error('down')))
  ok('lookup fails: nothing is respelled', c.corrected === null && c.text === 'gilden')
  const d = await words.interpretChecked('hoodie', () => { throw new Error('must not be called') })
  ok('no respelling, no lookup', d.types[0] === 'hoodie')
}

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
ok('then to the brand/detail words without filters', /algoliaSuggest\(it\.text, \[\]\)/.test(header) && /_textOnly: read\.text/.test(catalog))
ok('both check a respelling against the catalogue', /interpretChecked\(q, countExactWords\)/.test(header) && /interpretChecked\(opts\.q, window\.SPSearchCountExact\)/.test(catalog))
ok('a slow old answer cannot overwrite a newer one', /if \(mine !== seq\) return;/.test(header))
ok('typed text is escaped before it reaches the page', /spEsc\(q\)/.test(header) && /spEsc\(p\.name/.test(header))
ok('a suggestion opens the product itself', /'\/catalog\?product=' \+ encodeURIComponent\(p\.product_id\)/.test(header))
const page = readFileSync(ROOT + 'catalog.js', 'utf8')
ok('header shows "Did you mean"', /sp-search-dym/.test(header) && /spEsc\(res\.corrected\)/.test(header))
ok('catalogue page says what it searched for', /corrected:\s+\(read && read\.corrected\)/.test(catalog) && /spRenderDidYouMean\(\);/.test(page))
ok('"search instead" turns the reader off for that query', /_asTyped:\s+!!state\.filters\.q && state\._asTypedQ === state\.filters\.q/.test(page))
ok('the page never waits long for the brand list', /setTimeout\(r, 400\)/.test(catalog))
// ── "Tell us what you need" on a dead-end search ──────────────────────────
ok('header dead end shows the form', /'<\/div>' \+ needFormHtml\(q\)/.test(header))
ok('catalogue dead end shows the form, only for a search', /spRenderNeedForm\(empty\);/.test(page) && /if \(!q \|\| !window\.SPNeed\)/.test(page))
ok('it posts to the OS inbound with what they searched', /api\/inbound/.test(header) && /search_request: true/.test(header) && /search_query: searched/.test(header))
ok('it needs a way to reach them', /if \(!contact\) \{ say\(NEED_T\.errContact\)/.test(header))
ok('it carries the honeypot and reports failures', /website: form\.elements\.website\.value/.test(header) && /form: 'search_request', status_code/.test(header))
ok('a flagged-spam send fires no conversion', /if \(!\(j && j\.spam === true\)\)/.test(header))
for (const f of ['catalog.html', 'fr/catalog.html']) {
  const h = readFileSync(ROOT + f, 'utf8')
  ok(`${f} loads search-words.js before catalog-algolia.js`,
    h.indexOf('/search-words.js') > 0 && h.indexOf('/search-words.js') < h.indexOf('/catalog-algolia.js'))
}

console.log(`\n${pass} passed, ${fails.length} failed`)
if (fails.length) { console.log('FAILED: ' + fails.join('; ')); process.exit(1) }
