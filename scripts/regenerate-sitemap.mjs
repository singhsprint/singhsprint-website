#!/usr/bin/env node
/**
 * regenerate-sitemap.mjs
 *
 * Rebuilds /sitemap.xml so that:
 *   1. All marketing pages (home, /quote, /catalog, /businesses, /about,
 *      industry pages) stay in their existing priority order.
 *   2. Every generated product page under /p/<slug>/ gets its own <url>
 *      entry with EN + FR hreflang pairs.
 *   3. Every FR mirror page (`/fr/<marketing>` + `/fr/p/<slug>/`) gets
 *      its own <url> entry so French URLs are first-class in the index,
 *      not just hreflang alternates of EN. Previously ~1,036 FR pages
 *      were "discovered but not indexed" in GSC because they only
 *      existed as alternates.
 *
 * Run before each deploy (or daily via Vercel cron — see vercel.json):
 *   node scripts/regenerate-sitemap.mjs
 *   node scripts/regenerate-sitemap.mjs --dry-run
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.resolve(__dirname, '..')
const SITE      = 'https://www.singhsprint.com'
const DRY       = process.argv.includes('--dry-run')
const TODAY     = new Date().toISOString().slice(0, 10)

// Marketing pages — priority/changefreq curated so high-intent pages
// outrank the long tail of product pages.
const MARKETING = [
  { path: '/',                                          priority: 1.0,  changefreq: 'weekly',  hreflang: true },
  { path: '/quote',                                     priority: 0.95, changefreq: 'weekly',  hreflang: true },
  { path: '/catalog',                                   priority: 0.95, changefreq: 'daily',   hreflang: true },
  { path: '/businesses',                                priority: 0.9,  changefreq: 'weekly',  hreflang: true },
  { path: '/about',                                     priority: 0.8,  changefreq: 'monthly', hreflang: true },
  { path: '/youth-initiative',                          priority: 0.85, changefreq: 'monthly', hreflang: true },
  { path: '/industries/construction-workwear',          priority: 0.85, changefreq: 'monthly', hreflang: true },
  { path: '/industries/restaurant-hospitality-uniforms',priority: 0.85, changefreq: 'monthly', hreflang: true },
  { path: '/industries/corporate-tech-swag',            priority: 0.85, changefreq: 'monthly', hreflang: true },
  { path: '/industries/charity-events-fundraisers',     priority: 0.85, changefreq: 'monthly', hreflang: true },
  { path: '/industries/schools-sports-teams',           priority: 0.85, changefreq: 'monthly', hreflang: true },
]

// Given an EN URL like `/p/foo/`, returns `/fr/p/foo/`. Idempotent:
// passing in a /fr/ URL returns it unchanged. The "/" → "/fr/"
// replacement runs on the path portion only (the SITE prefix is
// stripped, swapped, and re-prepended) to avoid the historical bug
// where it would create `/fr/fr/...` when called twice.
function toFrUrl(enLoc) {
  const path = enLoc.replace(SITE, '')
  if (path === '/' || path === '') return `${SITE}/fr/`
  if (path.startsWith('/fr/') || path === '/fr') return enLoc
  return `${SITE}/fr${path}`
}
// Inverse: given a FR URL, return its EN sibling.
function toEnUrl(frLoc) {
  const path = frLoc.replace(SITE, '')
  if (path === '/fr' || path === '/fr/') return `${SITE}/`
  if (path.startsWith('/fr/')) return `${SITE}${path.slice(3)}`
  return frLoc
}

function urlNode({ loc, lastmod, changefreq, priority, hreflang, lang }) {
  const lines = [
    '  <url>',
    `    <loc>${loc}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
  ]
  if (hreflang) {
    // Build EN/FR URL pair regardless of which one is the primary `loc`
    // so the same hreflang block appears under both entries (Google
    // requires both directions, or neither side gets the cluster).
    const enLoc = lang === 'fr' ? toEnUrl(loc) : loc
    const frLoc = lang === 'fr' ? loc : toFrUrl(loc)
    lines.push(`    <xhtml:link rel="alternate" hreflang="en-CA" href="${enLoc}"/>`)
    lines.push(`    <xhtml:link rel="alternate" hreflang="fr-CA" href="${frLoc}"/>`)
    lines.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${enLoc}"/>`)
  }
  lines.push('  </url>')
  return lines.join('\n')
}

async function listProductSlugs() {
  const p = path.join(ROOT, 'p')
  let entries = []
  try { entries = await fs.readdir(p, { withFileTypes: true }) } catch { return [] }
  const slugs = []
  for (const e of entries) {
    if (!e.isDirectory()) continue
    // Sanity: only include slugs that actually have an index.html
    try {
      await fs.access(path.join(p, e.name, 'index.html'))
      slugs.push(e.name)
    } catch { /* skip dirs without index.html */ }
  }
  return slugs.sort()
}

async function listFrProductSlugs() {
  const p = path.join(ROOT, 'fr', 'p')
  let entries = []
  try { entries = await fs.readdir(p, { withFileTypes: true }) } catch { return [] }
  const slugs = []
  for (const e of entries) {
    if (!e.isDirectory()) continue
    try {
      await fs.access(path.join(p, e.name, 'index.html'))
      slugs.push(e.name)
    } catch { /* skip */ }
  }
  return slugs.sort()
}

async function run() {
  console.log(`--- regenerate-sitemap.mjs ${DRY ? '(dry-run)' : ''} ---`)
  const slugs = await listProductSlugs()
  console.log(`product pages found: ${slugs.length}`)

  const blocks = []
  blocks.push('<?xml version="1.0" encoding="UTF-8"?>')
  blocks.push('<urlset')
  blocks.push('  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
  blocks.push('  xmlns:xhtml="http://www.w3.org/1999/xhtml">')
  blocks.push('')

  // EN marketing pages.
  for (const m of MARKETING) {
    blocks.push(urlNode({
      loc: `${SITE}${m.path === '/' ? '/' : m.path}`,
      lastmod: TODAY,
      changefreq: m.changefreq,
      priority: m.priority,
      hreflang: m.hreflang,
      lang: 'en',
    }))
    blocks.push('')
  }

  // FR marketing pages — list each as its own primary entry so
  // /fr/quote etc. land in the index instead of just being an
  // hreflang alternate. Same priority as EN; same changefreq.
  for (const m of MARKETING) {
    const frPath = m.path === '/' ? '/fr/' : `/fr${m.path}`
    blocks.push(urlNode({
      loc: `${SITE}${frPath}`,
      lastmod: TODAY,
      changefreq: m.changefreq,
      priority: m.priority,
      hreflang: m.hreflang,
      lang: 'fr',
    }))
    blocks.push('')
  }

  // EN product pages — lower priority (0.5) than marketing so
  // Google focuses crawl budget on the high-intent surfaces first.
  for (const slug of slugs) {
    blocks.push(urlNode({
      loc: `${SITE}/p/${slug}/`,
      lastmod: TODAY,
      changefreq: 'weekly',
      priority: 0.5,
      hreflang: true,
      lang: 'en',
    }))
    blocks.push('')
  }

  // FR product pages — only include slugs that actually have a
  // /fr/p/<slug>/index.html on disk (the FR mirror generator may
  // skip some slugs, e.g. ones without translatable content).
  const frSlugs = await listFrProductSlugs()
  for (const slug of frSlugs) {
    blocks.push(urlNode({
      loc: `${SITE}/fr/p/${slug}/`,
      lastmod: TODAY,
      changefreq: 'weekly',
      priority: 0.5,
      hreflang: true,
      lang: 'fr',
    }))
    blocks.push('')
  }

  blocks.push('</urlset>')
  const xml = blocks.join('\n')

  if (DRY) {
    console.log(`would write ${(xml.length / 1024).toFixed(1)} KB`)
    console.log('first 600 chars:')
    console.log(xml.slice(0, 600))
    console.log('…')
    return
  }
  await fs.writeFile(path.join(ROOT, 'sitemap.xml'), xml + '\n')
  const total = MARKETING.length * 2 + slugs.length + frSlugs.length
  console.log(`✓ wrote sitemap.xml — EN: ${MARKETING.length} marketing + ${slugs.length} products = ${MARKETING.length + slugs.length}`)
  console.log(`                  FR: ${MARKETING.length} marketing + ${frSlugs.length} products = ${MARKETING.length + frSlugs.length}`)
  console.log(`                  Total URLs: ${total}`)
}

run().catch(e => { console.error('failed:', e); process.exit(1) })
