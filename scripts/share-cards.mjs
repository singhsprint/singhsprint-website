#!/usr/bin/env node
/**
 * share-cards.mjs — the picture each page shows when its link is pasted into
 * iMessage, WhatsApp, Instagram, Slack or Facebook (og:image / twitter:image).
 *
 * Every card is a 1200x630 JPEG in /images/share, drawn by scripts/share-cards/
 * (card.py). English pages use <id>.jpg, French pages <id>-fr.jpg.
 *
 *   node scripts/share-cards.mjs            # check: every page points at its card, and the card is a real 1200x630 JPEG
 *   node scripts/share-cards.mjs --write    # point the English pages (and the hand-written French ones) at their cards
 *   node scripts/share-cards.mjs --live     # check the deployed site instead of this checkout
 *   node scripts/share-cards.mjs --stdin about.html < page.html   # print one page with its tags set (EN side)
 *
 * The French mirror (scripts/generate-fr-mirror.mjs) swaps <id>.jpg for
 * <id>-fr.jpg when it writes /fr, so after --write run the mirror.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const SITE = 'https://www.singhsprint.com'
export const W = 1200, H = 630

// EN page -> card id. Guides are matched by name below.
export const CARDS = {
  'index.html': 'site-home',
  'about.html': 'site-about',
  'why-us.html': 'site-why-us',
  'quote.html': 'site-quote',
  'get-a-price.html': 'site-get-a-price',
  'catalog.html': 'site-catalog',
  'catalog/all/index.html': 'site-catalog',
  'businesses.html': 'site-businesses',
  'businesses/rfp.html': 'site-rfp',
  'bulk-apparel-printing-montreal.html': 'site-bulk',
  'screen-printing-montreal.html': 'site-screen',
  'custom-t-shirts-montreal.html': 'site-tshirts',
  'custom-hoodies-montreal.html': 'site-hoodies',
  'custom-hats-caps-montreal.html': 'site-caps',
  'dtg-printing-montreal.html': 'site-dtg',
  'dtf-printing-montreal.html': 'site-dtf',
  'embroidery-montreal.html': 'site-embroidery',
  'portfolio.html': 'site-portfolio',
  'inkwear.html': 'site-inkwear',
  'jerseys.html': 'site-jerseys',
  'youth-initiative.html': 'site-youth',
  'order.html': 'site-order',
  'shop/index.html': 'site-drops',
  'shop/policies.html': 'site-drop-policies',
  'industries/charity-events-fundraisers.html': 'site-charity',
  'industries/construction-workwear.html': 'site-construction',
  'industries/corporate-tech-swag.html': 'site-corporate',
  'industries/restaurant-hospitality-uniforms.html': 'site-restaurant',
  'industries/schools-sports-teams.html': 'site-schools',
  'guides/index.html': 'site-guides',
  'gifts.html': 'site-gifts',
  'gifts/build.html': 'site-gifts-build',
  'gifts/order.html': 'site-gifts-order',
  // Legal pages: the shop's own card.
  'privacy.html': 'site-home',
  'cookies.html': 'site-home',
  'terms.html': 'site-home',
  'accessibility.html': 'site-home',
}

// Written by scripts/build_gifts.py, which owns their <head>. --write leaves
// them alone; the check reports them until that script sets the tags.
export const WRITTEN_ELSEWHERE = new Set(['gifts.html', 'gifts/build.html', 'gifts/order.html'])

// French written by hand: --write sets these directly. Every other /fr page
// comes from the mirror.
const FR_BY_HAND = new Set(['privacy.html', 'cookies.html', 'terms.html', 'accessibility.html', 'guides/custom-hoodies-bulk-order-guide.html'])

const cardFile = (id, fr) => path.join(ROOT, 'images', 'share', `${id}${fr ? '-fr' : ''}.jpg`)
export const shareUrl = (id, fr) => `${SITE}/images/share/${id}${fr ? '-fr' : ''}.jpg`

/** The card for an EN-side page path, or null when the page has none. */
export function cardFor(rel) {
  if (CARDS[rel]) return CARDS[rel]
  const g = rel.match(/^guides\/([a-z0-9-]+)\.html$/)
  if (g && fs.existsSync(cardFile(`guide-${g[1]}`))) return `guide-${g[1]}`
  return null
}

const tagRe = (attr, name) => new RegExp(`<meta\\s+${attr}="${name}"\\s+content="([^"]*)"\\s*/?>`, 'i')
const read = (html, attr, name) => (html.match(tagRe(attr, name)) || [])[1] ?? null

/** Set one meta tag, or add it after `afterRe` (falling back to </title>). */
function upsert(html, attr, name, value, afterRe) {
  const tag = `<meta ${attr}="${name}" content="${value}">`
  if (tagRe(attr, name).test(html)) return html.replace(tagRe(attr, name), tag)
  const after = (afterRe && html.match(afterRe)) || html.match(/<\/title>/i)
  if (!after) throw new Error(`no place for ${name}`)
  const at = after.index + after[0].length
  return html.slice(0, at) + '\n  ' + tag + html.slice(at)
}
const lastOg = /<meta\s+property="og:[^"]+"\s+content="[^"]*"\s*\/?>(?![\s\S]*<meta\s+property="og:)/i

/** One page's html with its link-preview picture set to `url`. Pure. */
export function setShareTags(html, url) {
  html = upsert(html, 'property', 'og:image', url, lastOg)
  html = upsert(html, 'property', 'og:image:width', String(W), tagRe('property', 'og:image'))
  html = upsert(html, 'property', 'og:image:height', String(H), tagRe('property', 'og:image:width'))
  html = upsert(html, 'name', 'twitter:card', 'summary_large_image', lastOg)
  html = upsert(html, 'name', 'twitter:image', url,
    new RegExp(`${tagRe('name', 'twitter:description').source}|${tagRe('name', 'twitter:title').source}|${tagRe('name', 'twitter:card').source}`, 'i'))
  return html
}

/** Mirror rule: a French page shows the French card. */
export const frShareCard = (html) => html.replace(/(\/images\/share\/[a-z0-9-]+?)(?:-fr)?\.jpg/g, '$1-fr.jpg')

/** Width and height of a JPEG, read from its frame header. */
export function jpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null
  let i = 2
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return null
    const m = buf[i + 1], len = buf.readUInt16BE(i + 2)
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }
    i += 2 + len
  }
  return null
}

function htmlFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { if (!/^(fr|p|images|scripts|api)$/.test(e.name) || dir !== ROOT) htmlFiles(p, out) } else if (e.name.endsWith('.html')) out.push(path.relative(ROOT, p).replace(/\\/g, '/'))
  }
  return out
}
export const pages = () => htmlFiles(ROOT).filter((rel) => cardFor(rel)).sort()

function write() {
  let n = 0
  for (const rel of pages()) {
    if (WRITTEN_ELSEWHERE.has(rel)) continue
    const id = cardFor(rel)
    for (const [file, fr] of [[rel, false], ...(FR_BY_HAND.has(rel) ? [['fr/' + rel, true]] : [])]) {
      const p = path.join(ROOT, file)
      if (!fs.existsSync(p)) continue
      const before = fs.readFileSync(p, 'utf8'), after = setShareTags(before, shareUrl(id, fr))
      if (after !== before) { fs.writeFileSync(p, after); n++; console.log('set  ' + file + '  ->  ' + id + (fr ? '-fr' : '')) }
    }
  }
  console.log(`\n${n} page(s) changed. Now run: node scripts/generate-fr-mirror.mjs`)
}

async function check(live) {
  let fails = 0, passes = 0, later = 0
  const ok = (id, cond, detail = '') => { if (cond) passes++; else { fails++; console.log(`FAIL  ${id}${detail ? '  —  ' + detail : ''}`) } }
  const get = async (rel) => {
    if (!live) { const p = path.join(ROOT, rel); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null }
    const clean = '/' + rel.replace(/(^|\/)index\.html$/, '').replace(/\.html$/, '').replace(/\/$/, '')
    const r = await fetch(SITE + clean, { redirect: 'follow' }); return r.ok ? await r.text() : null
  }
  const image = async (url) => {
    if (!live) { const p = path.join(ROOT, url.replace(SITE, '')); return fs.existsSync(p) ? fs.readFileSync(p) : null }
    const r = await fetch(url); return r.ok && /image\/jpeg/.test(r.headers.get('content-type') || '') ? Buffer.from(await r.arrayBuffer()) : null
  }
  const seen = new Map()
  for (const rel of pages()) {
    const id = cardFor(rel)
    for (const fr of [false, true]) {
      const file = (fr ? 'fr/' : '') + rel
      const html = await get(file)
      if (html == null) { if (!fr) ok(`${file}: page exists`, false); continue }   // not every page has a French sibling
      const want = shareUrl(id, fr)
      if (WRITTEN_ELSEWHERE.has(rel) && read(html, 'property', 'og:image') !== want) { later++; console.log(`later ${file}: set by scripts/build_gifts.py (wants ${id}${fr ? '-fr' : ''})`); continue }
      ok(`${file}: og:image is ${id}${fr ? '-fr' : ''}`, read(html, 'property', 'og:image') === want, String(read(html, 'property', 'og:image')))
      ok(`${file}: twitter:image is the same picture`, read(html, 'name', 'twitter:image') === want, String(read(html, 'name', 'twitter:image')))
      ok(`${file}: og:image:width x height is ${W}x${H}`, read(html, 'property', 'og:image:width') === String(W) && read(html, 'property', 'og:image:height') === String(H),
        `${read(html, 'property', 'og:image:width')}x${read(html, 'property', 'og:image:height')}`)
      ok(`${file}: twitter:card is summary_large_image`, read(html, 'name', 'twitter:card') === 'summary_large_image', String(read(html, 'name', 'twitter:card')))
      ok(`${file}: one og:image tag`, (html.match(/property="og:image"/g) || []).length === 1, String((html.match(/property="og:image"/g) || []).length))
      if (!seen.has(want)) {
        const buf = await image(want); const size = buf && jpegSize(buf)
        seen.set(want, true)
        ok(`${want.replace(SITE, '')}: is a ${W}x${H} JPEG`, !!size && size.w === W && size.h === H, size ? `${size.w}x${size.h}` : 'missing')
        ok(`${want.replace(SITE, '')}: under 300 KB`, !!buf && buf.length < 300 * 1024, buf ? `${Math.round(buf.length / 1024)} KB` : 'missing')
      }
    }
  }
  console.log(`\n${passes} passed, ${fails} failed${later ? `, ${later} waiting on build_gifts.py` : ''}  (${seen.size} pictures${live ? ', live' : ''})`)
  process.exit(fails ? 1 : 0)
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const a = process.argv.slice(2)
  if (a[0] === '--stdin') {
    const rel = a[1], id = cardFor(rel.replace(/^fr\//, ''))
    process.stdout.write(setShareTags(fs.readFileSync(0, 'utf8'), shareUrl(id, rel.startsWith('fr/'))))
  } else if (a.includes('--write')) write()
  else check(a.includes('--live'))
}
