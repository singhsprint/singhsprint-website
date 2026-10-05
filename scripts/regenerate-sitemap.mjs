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
import { execFileSync } from 'node:child_process'
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
  { path: '/why-us',                                    priority: 0.85, changefreq: 'monthly', hreflang: true },
  { path: '/youth-initiative',                          priority: 0.85, changefreq: 'monthly', hreflang: true },
  { path: '/industries/construction-workwear',          priority: 0.85, changefreq: 'monthly', hreflang: true },
  { path: '/industries/restaurant-hospitality-uniforms',priority: 0.85, changefreq: 'monthly', hreflang: true },
  { path: '/industries/corporate-tech-swag',            priority: 0.85, changefreq: 'monthly', hreflang: true },
  { path: '/industries/charity-events-fundraisers',     priority: 0.85, changefreq: 'monthly', hreflang: true },
  { path: '/industries/schools-sports-teams',           priority: 0.85, changefreq: 'monthly', hreflang: true },

  // ADDED 2026-10-05. This list had drifted badly behind the site: a
  // coverage check against the files on disk found 47 real pages with no
  // <url> entry, including EVERY method landing page and all 13 guides --
  // the pages the whole content effort exists to rank. Four of them
  // (brand-colour-matching, bulk-order-size-run, fabric-cotton-polyester-
  // blends, wash-care-printed-embroidered-apparel) were in the shipped
  // sitemap and would have been DROPPED by the first run of this script,
  // because the previous sitemap was written by generate-sitemap.mjs,
  // which globs, while this one works from the list below. Two generators
  // for one file, disagreeing -- the same one-rule-in-two-places shape as
  // the turnaround figure.
  //
  // Every entry below was checked to have both an EN file and an FR mirror
  // on disk before being given hreflang: true.
  //
  // DELIBERATELY ABSENT: /screen-printing-montreal. The shop does not run
  // screen printing (owner, 2026-10-05) and the page is staying up for now
  // pending a decision, but there is no case for actively submitting it to
  // Google in the meantime. Also absent: /account/* (gated), /debug-pixel,
  // /index (duplicate of /), and the legal pages.
  { path: '/custom-t-shirts-montreal',                  priority: 0.85, changefreq: 'monthly', hreflang: true },
  { path: '/custom-hoodies-montreal',                   priority: 0.85, changefreq: 'monthly', hreflang: true },
  { path: '/custom-hats-caps-montreal',                 priority: 0.8,  changefreq: 'monthly', hreflang: true },
  { path: '/bulk-apparel-printing-montreal',            priority: 0.85, changefreq: 'monthly', hreflang: true },
  { path: '/dtg-printing-montreal',                     priority: 0.85, changefreq: 'monthly', hreflang: true },
  { path: '/dtf-printing-montreal',                     priority: 0.85, changefreq: 'monthly', hreflang: true },
  { path: '/embroidery-montreal',                       priority: 0.85, changefreq: 'monthly', hreflang: true },
  { path: '/jerseys',                                   priority: 0.8,  changefreq: 'monthly', hreflang: true },
  { path: '/portfolio',                                 priority: 0.8,  changefreq: 'weekly',  hreflang: true },
  { path: '/inkwear',                                   priority: 0.7,  changefreq: 'monthly', hreflang: true },
  { path: '/shop',                                      priority: 0.7,  changefreq: 'weekly',  hreflang: true },
  { path: '/shop/policies',                             priority: 0.4,  changefreq: 'yearly',  hreflang: true },
  { path: '/order',                                     priority: 0.7,  changefreq: 'monthly', hreflang: true },
  { path: '/businesses/rfp',                            priority: 0.8,  changefreq: 'monthly', hreflang: true },
  { path: '/guides',                                    priority: 0.7,  changefreq: 'weekly',  hreflang: true },
  { path: '/guides/brand-colour-matching',              priority: 0.6,  changefreq: 'monthly', hreflang: true },
  { path: '/guides/branded-winter-outerwear',           priority: 0.6,  changefreq: 'monthly', hreflang: true },
  { path: '/guides/bulk-order-size-run',                priority: 0.6,  changefreq: 'monthly', hreflang: true },
  { path: '/guides/charity-run-timeline',               priority: 0.6,  changefreq: 'monthly', hreflang: true },
  { path: '/guides/construction-crew-cost',             priority: 0.6,  changefreq: 'monthly', hreflang: true },
  { path: '/guides/decoration-method-durability',       priority: 0.6,  changefreq: 'monthly', hreflang: true },
  { path: '/guides/fabric-cotton-polyester-blends',     priority: 0.6,  changefreq: 'monthly', hreflang: true },
  { path: '/guides/logo-file-requirements',             priority: 0.6,  changefreq: 'monthly', hreflang: true },
  { path: '/guides/logo-placement-print-sizes',         priority: 0.6,  changefreq: 'monthly', hreflang: true },
  { path: '/guides/minimum-order-price-breaks',         priority: 0.6,  changefreq: 'monthly', hreflang: true },
  { path: '/guides/procurement-checklist',              priority: 0.6,  changefreq: 'monthly', hreflang: true },
  { path: '/guides/team-jersey-ordering',               priority: 0.6,  changefreq: 'monthly', hreflang: true },
  { path: '/guides/wash-care-printed-embroidered-apparel', priority: 0.6, changefreq: 'monthly', hreflang: true },
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

// A SITEMAP MAY ONLY LIST PAGES THAT WILL ACTUALLY DEPLOY.
//
// Added 2026-10-05 after shipping a sitemap with 12 dead URLs. The MARKETING
// list above was expanded to cover the guides, every entry checked against a
// file ON DISK -- and six of those guide files had never been committed. They
// exist locally and do not exist on the deployed site, because Vercel builds
// from git, not from someone's working tree. Google was handed 6 EN + 6 FR
// URLs that 404.
//
// "The file exists" is the wrong test. "git will ship it" is the right one.
// hreflang: true also promises a French alternate, so both sides must be
// tracked or the entry is dropped rather than half-listed.
// HEAD, not the index. `git ls-files` reads .git/index, which in this repo is
// routinely stale -- commits here are built through a temporary index because
// .git/index.lock cannot be removed through the mount, so the real index never
// advances and ls-files reports thousands of files in states the working tree
// left behind. HEAD is what the last commit contains and therefore what the
// last deploy served. The rule this makes explicit is a good one anyway: a
// page must be COMMITTED before the sitemap may advertise it.
function trackedPaths() {
  try {
    return new Set(execFileSync('git', ['ls-tree', '-r', 'HEAD', '--name-only', '-z'],
      { cwd: ROOT, maxBuffer: 1 << 28 }).toString('utf8').split('\0').filter(Boolean))
  } catch (e) {
    console.error('git ls-tree HEAD failed, refusing to guess what deploys:', e.message)
    process.exit(1)
  }
}

/** Candidate repo-relative files for a site path, e.g. /guides -> guides.html,
 *  guides/index.html; / -> index.html. */
function filesFor(sitePath, prefix = '') {
  // Normalise BOTH ends: '/' with prefix '/fr' was building 'fr//index.html',
  // which is tracked by nothing, so the home page reported its own French
  // mirror as uncommitted and dropped /fr/ from the sitemap. A filter that
  // silently removes the French home page is worse than the bug it fixes.
  const rel = (prefix + sitePath).replace(/^\/+/, '').replace(/\/+$/, '')
  if (rel === '' || rel === 'fr') return [rel ? 'fr/index.html' : 'index.html']
  return [`${rel}.html`, `${rel}/index.html`]
}

function deployableMarketing(tracked) {
  const kept = [], dropped = []
  for (const m of MARKETING) {
    const en = filesFor(m.path).some((f) => tracked.has(f))
    const fr = !m.hreflang || filesFor(m.path, '/fr').some((f) => tracked.has(f))
    if (en && fr) kept.push(m)
    else dropped.push(`${m.path}${!en ? ' (EN not committed)' : ''}${!fr ? ' (FR not committed)' : ''}`)
  }
  if (dropped.length) {
    console.log(`  skipping ${dropped.length} page(s) not committed to git:`)
    for (const d of dropped) console.log(`    - ${d}`)
  }
  return kept
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

  const MARKETING_LIVE = deployableMarketing(trackedPaths())

  // EN marketing pages.
  for (const m of MARKETING_LIVE) {
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
  // MARKETING_LIVE, not MARKETING: the French side has to be filtered too,
  // and it is where most of the dead URLs were. Of the 12 broken entries
  // shipped on 2026-10-05, 7 were French.
  for (const m of MARKETING_LIVE) {
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
  const total = MARKETING_LIVE.length * 2 + slugs.length + frSlugs.length
  console.log(`✓ wrote sitemap.xml — EN: ${MARKETING_LIVE.length} marketing + ${slugs.length} products = ${MARKETING_LIVE.length + slugs.length}`)
  console.log(`                  FR: ${MARKETING_LIVE.length} marketing + ${frSlugs.length} products = ${MARKETING_LIVE.length + frSlugs.length}`)
  console.log(`                  Total URLs: ${total}`)
}

run().catch(e => { console.error('failed:', e); process.exit(1) })
