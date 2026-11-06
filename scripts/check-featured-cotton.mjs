#!/usr/bin/env node
/**
 * Featured blanks lead with cotton-faced ones (owner, 2026-11-06).
 *
 *   node scripts/check-featured-cotton.mjs
 *
 * F1  no industry page (EN or FR) features a 50/50-face hoodie or crew
 *     (Gildan 18500 / 18000, Champion S700 / S600) on a card or offer line.
 * F2  the hoodie cards open Gildan SF500 (brand + style, so the modal cannot
 *     land on the youth SF500B).
 * F3  every offer adds up: the line items sum to the stated total, in English
 *     and in French. The numbers themselves came from price_configuration on
 *     2026-11-06 (black SF500, left chest; see the commit); this keeps a later
 *     edit from changing one line and not the total.
 * F4  the quote form's hoodie, crewneck and jogger blank lists carry no 50/50
 *     face, and the bring-your-own example does not name one.
 * F5  the quote page sends SanMar / S&S / blanks.ca photos through the image
 *     proxy (SanMar's CDN 403s our Referer: the blank Nike polo card).
 */
import { readFileSync } from 'node:fs'

const ROOT = new URL('..', import.meta.url).pathname
const PAGES = ['corporate-tech-swag', 'construction-workwear', 'schools-sports-teams', 'charity-events-fundraisers']
const BAD = ['18500', '18000', 'S700', 'S600', '18200', 'RW10', '975MPR']
let pass = 0, fail = 0
const ok = (n, c, d = '') => { if (c) { pass++; console.log(`  ok  ${n}`) } else { fail++; console.log(`  FAIL ${n}${d ? ' -- ' + d : ''}`) } }
const file = (rel) => readFileSync(process.env[`F_${rel.replace(/\W/g, '_')}`] || ROOT + rel, 'utf8')
const money = (s) => Number(s.replace(/[\s $]|&nbsp;|&#36;/g, '').replace(/,(\d\d)$/, '.$1').replace(/,/g, ''))

for (const lang of ['', 'fr/']) {
  for (const pg of PAGES) {
    const rel = `${lang}industries/${pg}.html`
    const html = file(rel)
    const featured = [...html.matchAll(/data-modal-style="([^"]+)"/g)].map((m) => m[1])
    const lines = [...html.matchAll(/<div class="price-line"><span class="qty">([^<]*(?:<em>[^<]*<\/em>)?)<\/span><span class="val">([^<]+)<\/span><\/div>/g)]
    ok(`F1 ${rel}: no 50/50-face blank featured`, !featured.some((s) => BAD.includes(s)) && !BAD.some((s) => lines.some((l) => new RegExp(`Gildan ${s}\\b|Champion ${s}\\b`).test(l[1]))),
      featured.join(','))
    if (/type=hoodie/.test(html)) {
      ok(`F2 ${rel}: the hoodie card opens Gildan SF500`, /href="\/(?:fr\/)?catalog\?type=hoodie"[^>]*data-modal-style="SF500" data-modal-brand="Gildan"/.test(html))
    }
    const priced = lines.filter((l) => /\d/.test(l[2]))
    if (priced.length) {
      const sum = priced.reduce((a, l) => a + money(l[2]), 0)
      const total = html.match(/<div class="price-total"><span>[^<]*<\/span><span>([^<]+)<\/span>/)
      ok(`F3 ${rel}: ${priced.length} lines add up to the total`, !!total && Math.abs(sum - money(total[1])) < 0.005, `${sum.toFixed(2)} vs ${total && money(total[1])}`)
      // The construction hero repeats the offer total above the fold.
      const hero = html.match(/line-height:1\.1">([^<&]+(?:&nbsp;&#36;)?) &middot;/)
      if (hero) ok(`F3 ${rel}: the hero shows the same total`, Math.abs(money(hero[1]) - money(total[1])) < 0.005, `${hero[1]} vs ${total[1]}`)
    }
  }
}
{
  const q = file('quote.js')
  const block = (g) => q.slice(q.indexOf(`      ${g}: [`), q.indexOf('],', q.indexOf(`      ${g}: [`)))
  for (const g of ['hoodie', 'crewneck', 'joggers']) {
    const b = block(g).replace(/\/\/[^\n]*/g, '')
    ok(`F4 quote form ${g} blanks carry no 50/50 face`, b.length > 50 && !BAD.some((s) => new RegExp(`'[^']*\\b${s}\\b`).test(b)), b.match(/v:'[^']+'/g)?.join(' '))
  }
}
for (const rel of ['quote.html', 'fr/quote.html']) {
  const ph = (file(rel).match(/id="byoDesc"[^>]*placeholder="([^"]+)"/) || [])[1] || ''
  ok(`F4 ${rel}: the bring-your-own example names a cotton-faced hoodie`, /SF500/.test(ph) && !BAD.some((s) => ph.includes(s)), ph)
}
{
  // F5 supplier photos on the quote page go through the proxy (SanMar 403s our Referer).
  const q = file('quote.js')
  const i = q.indexOf('function imgUrl(raw)'), j = q.indexOf('\n    }\n', i) + 6
  const PROXY = q.match(/var IMAGE_PROXY_FOR_QUOTE\s*=\s*'([^']+)'/)?.[1] || ''
  // eslint-disable-next-line no-new-func
  const imgUrl = new Function('IMAGE_PROXY_FOR_QUOTE', `${q.slice(i, j)}; return imgUrl;`)(PROXY || '/proxy')
  const via = (u) => imgUrl(u).startsWith((PROXY || '/proxy') + '?url=')
  ok('F5 quote page proxies SanMar photos', via('https://media.sanmarcanada.com/catalog/product/n/k/nkdc1963_flat-front.jpg'))
  ok('F5 quote page proxies S&S and blanks.ca photos', via('https://www.ssactivewear.com/Images/Style/11190_fl.jpg') && via('https://www.blanks.ca/media/catalog/product/a/3/a3000-001-f.png'))
  ok('F5 our own images are left alone', imgUrl('/images/x.jpg') === '/images/x.jpg')
}
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
