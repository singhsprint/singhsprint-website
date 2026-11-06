#!/usr/bin/env node
/**
 * The catalog's default order: page-one picks, then in-stock, then
 * cotton-faced blanks (owner, 2026-11-06), then the old keys.
 *
 *   node scripts/check-catalog-cotton-order.mjs
 *
 * S1-S4  sortProducts('bestseller') -- the API fallback path -- run for real
 *        on sample cards: picks first, stock next, cotton_rank next.
 * R1     the Algolia path keeps the index's order on the default sort instead
 *        of re-sorting the page on keys Algolia hits do not carry (that
 *        re-sort is what reshuffled page one: measured 2026-11-06, Gildan
 *        2000 at #4 and the CVC 6210 above the ATC ring-spun picks).
 * R2     an explicit sort (price, name, brand) still re-sorts.
 */
import { readFileSync } from 'node:fs'

const FILE = process.env.CATALOG_JS || new URL('../catalog.js', import.meta.url).pathname
const src = readFileSync(FILE, 'utf8')
let pass = 0, fail = 0
const ok = (n, c, d = '') => { if (c) { pass++; console.log(`  ok  ${n}`) } else { fail++; console.log(`  FAIL ${n}${d ? ' -- ' + d : ''}`) } }

function extract(name) {
  const i = src.indexOf(`function ${name}(`)
  if (i < 0) throw new Error(`${name} not found`)
  let d = 0, j = src.indexOf('{', i)
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++
    else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1)
  }
  throw new Error('unbalanced')
}
// eslint-disable-next-line no-new-func
const sortProducts = new Function(`${extract('sortProducts')}; return sortProducts;`)()
const card = (id, o) => ({ product_id: id, brand: 'B', in_stock: true, supplier_code: 'sanmar', color_count: 5, pick_rank: 0, cotton_rank: 0, ...o })
const order = (list) => sortProducts(list.map((x) => ({ ...x })), 'bestseller').map((p) => p.product_id).join(' ')

ok('S1 picks first, in pick order', order([card('poly-ss', { supplier_code: 'ss_activewear', color_count: 90 }), card('pick2', { pick_rank: 24 }), card('pick1', { pick_rank: 25 })]).startsWith('pick1 pick2'))
ok('S2 after the picks, a cotton blank beats a polyester one with more colours at the preferred supplier',
  order([card('poly-ss', { supplier_code: 'ss_activewear', color_count: 90 }), card('cotton', { cotton_rank: 1, color_count: 3 })]) === 'cotton poly-ss')
ok('S3 stock still comes before cotton', order([card('cotton-oos', { cotton_rank: 1, in_stock: false }), card('poly', {})]) === 'poly cotton-oos')
ok('S4 among equals the old keys still decide (S&S, then colours)',
  order([card('a', { cotton_rank: 1, color_count: 2 }), card('b', { cotton_rank: 1, supplier_code: 'ss_activewear', color_count: 1 }), card('c', { cotton_rank: 1, color_count: 9 })]) === 'b c a')

const render = src.slice(src.indexOf('let visible = state.filters.inStockOnly'), src.indexOf('let visible = state.filters.inStockOnly') + 1500)
ok('R1 the Algolia path keeps the index order on the default sort',
  /const serverOrdered = state\.serverPaged && \(state\.sort \|\| 'bestseller'\) === 'bestseller';/.test(render) &&
  /if \(!POPULAR && !serverOrdered\) visible = sortProducts\(visible, state\.sort\);/.test(render))
ok('R2 explicit sorts still run (the guard is only for bestseller)', !/if \(!POPULAR && !state\.serverPaged\)/.test(render))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
