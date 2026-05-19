#!/usr/bin/env node
/**
 * regenerate-sitemap.mjs
 *
 * Rebuilds /sitemap.xml so that:
 *   1. All marketing pages (home, /quote, /catalog, /businesses, /about,
 *      industry pages) stay in their existing priority order.
 *   2. Every generated product page under /p/<slug>/ gets its own <url>
 *      entry with EN + FR hreflang pairs.
 *
 * Why this matters: ~1,000+ /p/ pages exist on disk but only ~5 URLs are
 * in the sitemap, which has parked them in Google Search Console's
 * "Discovered - currently not indexed" bucket. Listing them in the
 * sitemap signals Google to spend crawl budget on them.
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

function urlNode({ loc, lastmod, changefreq, priority, hreflang }) {
  const lines = [
    '  <url>',
    `    <loc>${loc}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
  ]
  if (hreflang) {
    const enLoc = loc
    const frLoc = loc.replace(`${SITE}/`, `${SITE}/fr/`).replace(`${SITE}/fr/fr/`, `${SITE}/fr/`)
    if (enLoc === `${SITE}/`) {
      lines.push(`    <xhtml:link rel="alternate" hreflang="en" href="${SITE}/"/>`)
      lines.push(`    <xhtml:link rel="alternate" hreflang="fr" href="${SITE}/fr/"/>`)
      lines.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/"/>`)
    } else {
      lines.push(`    <xhtml:link rel="alternate" hreflang="en" href="${enLoc}"/>`)
      lines.push(`    <xhtml:link rel="alternate" hreflang="fr" href="${frLoc}"/>`)
      lines.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${enLoc}"/>`)
    }
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

  for (const m of MARKETING) {
    blocks.push(urlNode({
      loc: `${SITE}${m.path}`,
      lastmod: TODAY,
      changefreq: m.changefreq,
      priority: m.priority,
      hreflang: m.hreflang,
    }))
    blocks.push('')
  }

  // Each product page — EN + FR hreflang.
  // Product pages get a lower priority (0.5) than marketing pages so
  // Google focuses crawl budget on the high-intent surfaces first.
  for (const slug of slugs) {
    blocks.push(urlNode({
      loc: `${SITE}/p/${slug}/`,
      lastmod: TODAY,
      changefreq: 'weekly',
      priority: 0.5,
      hreflang: true,
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
  console.log(`✓ wrote sitemap.xml (${MARKETING.length} marketing + ${slugs.length} product pages = ${MARKETING.length + slugs.length} URLs)`)
}

run().catch(e => { console.error('failed:', e); process.exit(1) })
