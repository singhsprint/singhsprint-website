#!/usr/bin/env node
/**
 * sync-google-reviews.mjs
 *
 * Fetches Singh's Print's current Google Maps rating + review count via the
 * CRM's /api/google-reviews endpoint and rewrites every hardcoded mention
 * across the static site so initial HTML + JSON-LD schema reflect the live
 * numbers. Lets us keep the site SEO-fresh without depending on JS to
 * patch the DOM at runtime.
 *
 * Run before deploy (and daily via cron once we wire one up):
 *   node scripts/sync-google-reviews.mjs
 *   node scripts/sync-google-reviews.mjs --dry-run
 *
 * Targets the recurring patterns we know about:
 *   "(21 reviews)"                          → "(N reviews)"
 *   "5.0★ (27 reviews)"                     → "X.X★ (N reviews)"
 *   "5.0/5 (27 reviews)"                    → "X.X/5 (N reviews)"
 *   '"ratingValue": "5.0"'                   → '"ratingValue":"X.X"'
 *   '"reviewCount": "27"'                    → '"reviewCount":"N"'
 *   ratingValue: '5.0', reviewCount: '27'   → ratingValue: 'X.X', reviewCount: 'N'
 *
 * Everything else (real customer review bodies, the "5 stars" in star
 * glyphs, etc.) stays untouched.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const ROOT       = path.resolve(__dirname, '..')
const DRY        = process.argv.includes('--dry-run')

// Pulled from .env.local or override on the CLI.
const ENDPOINT = process.env.REVIEWS_ENDPOINT ||
  'https://singhsprint-crm.vercel.app/api/google-reviews'

async function fetchLive() {
  const res = await fetch(ENDPOINT, { cache: 'no-store' })
  if (!res.ok) throw new Error(`reviews endpoint ${res.status}`)
  const data = await res.json()
  if (!data || typeof data.rating !== 'number' || typeof data.count !== 'number') {
    throw new Error('reviews endpoint returned bad shape: ' + JSON.stringify(data))
  }
  return { rating: data.rating, count: data.count, source: data.source }
}

// Format the rating like Google does: "5.0", "4.8", "5" → "5.0", "4.8".
function fmtRating(r) {
  return Number(r).toFixed(1)
}

async function walk(dir, hits = []) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(full, hits)
    } else if (/\.(html|js|mjs)$/.test(entry.name)) {
      hits.push(full)
    }
  }
  return hits
}

async function run() {
  console.log(`\n--- sync-google-reviews.mjs ---`)
  console.log(`mode: ${DRY ? 'DRY-RUN' : 'WRITE'}`)
  console.log(`endpoint: ${ENDPOINT}`)

  const { rating, count, source } = await fetchLive()
  const ratingStr = fmtRating(rating)
  const countStr  = String(count)
  console.log(`live: rating=${ratingStr}, count=${countStr} (source=${source})`)

  // Patterns are number-agnostic so subsequent runs work no matter what
  // the current hardcoded value is. Matches any rating like "5.0", "4.8",
  // "4" and any review count digit string.
  const replacements = [
    // Visible text patterns
    [/\(\d+\s*reviews\)/g,                           `(${countStr} reviews)`],
    [/\(\d+\s*Reviews\)/g,                           `(${countStr} Reviews)`],
    [/\(\d+\s*avis\)/g,                              `(${countStr} avis)`],
    [/\b\d(?:\.\d)?★ \(\d+ reviews\)/g,              `${ratingStr}★ (${countStr} reviews)`],
    [/\b\d(?:\.\d)?\/5 \(\d+ reviews\)/g,            `${ratingStr}/5 (${countStr} reviews)`],
    [/\b\d(?:\.\d)?\/5 \(\d+ avis\)/g,               `${ratingStr}/5 (${countStr} avis)`],

    // JSON-LD schema strings (in any quote style)
    [/"ratingValue":\s*"\d(?:\.\d)?"/g,              `"ratingValue": "${ratingStr}"`],
    [/"reviewCount":\s*"\d+"/g,                      `"reviewCount": "${countStr}"`],

    // JS object literal form used in the page generator
    [/ratingValue:\s*'\d(?:\.\d)?'/g,                `ratingValue: '${ratingStr}'`],
    [/reviewCount:\s*'\d+'/g,                        `reviewCount: '${countStr}'`],
  ]

  const files = await walk(ROOT)
  let filesChanged = 0
  let edits = 0

  for (const f of files) {
    const before = await fs.readFile(f, 'utf8')
    let after = before
    for (const [pat, rep] of replacements) {
      after = after.replace(pat, () => { edits++; return rep })
    }
    if (after !== before) {
      filesChanged++
      if (!DRY) await fs.writeFile(f, after)
      console.log(`  ${DRY ? 'would update' : 'updated'}: ${path.relative(ROOT, f)}`)
    }
  }

  console.log(`\nfiles ${DRY ? 'that would change' : 'changed'}: ${filesChanged}`)
  console.log(`total replacements: ${edits}`)
  if (DRY) console.log(`\nDRY-RUN: re-run without --dry-run to write the changes.`)
}

run().catch(e => { console.error('failed:', e); process.exit(1) })
