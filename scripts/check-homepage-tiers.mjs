#!/usr/bin/env node
/**
 * scripts/check-homepage-tiers.mjs
 *
 * The homepage "How much will yours cost?" slider renders whatever
 * /api/pricing/homepage-tiers returns, and falls back to the TIERS
 * constant in index.html only if that fetch fails. So the fallback is
 * the number we reviewed and the API is the number customers see.
 *
 * What went wrong: the endpoint called the engine without a decoration
 * method. compute() reads an omitted method as "not embroidery", so
 * headwear fell onto its DTG ladder and the slider published caps
 * $2-4/unit under the stitched price caps are actually sold at, on
 * every single band. Nothing failed. Both sides were "the engine".
 *
 * This check fetches the live endpoint and fails when any published
 * band comes back BELOW the fallback committed in index.html. Under is
 * the direction that costs money: a customer who reads a number we
 * cannot honour has a reasonable claim on it. Over is allowed and only
 * reported, because a conservative estimate is a quote conversation,
 * not a liability.
 *
 *   node scripts/check-homepage-tiers.mjs
 *   node scripts/check-homepage-tiers.mjs --url=http://localhost:3000/api/...
 *
 * Exit 1 on any band under. Exit 0 clean.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE  = dirname(fileURLToPath(import.meta.url))
const INDEX = join(HERE, '..', 'index.html')

const urlArg = process.argv.find(a => a.startsWith('--url='))
const ENDPOINT = urlArg
  ? urlArg.slice('--url='.length)
  : 'https://singhsprint-crm.vercel.app/api/pricing/homepage-tiers'

/**
 * Pull the fallback TIERS object out of index.html.
 *
 * Deliberately parsed out of the SHIPPED html rather than imported from
 * a shared module. A check that reads the same source the code reads is
 * measuring consistency, not correctness - the whole point here is that
 * two sources of truth drifted, so this one reads the artefact a
 * browser actually downloads.
 */
function readFallbackTiers() {
  const html = readFileSync(INDEX, 'utf8')
  const m = html.match(/var TIERS = \{([\s\S]*?)\n\s*\};/)
  if (!m) {
    console.error('FAIL  could not find `var TIERS = {` in index.html.')
    console.error('      If the slider was refactored, update this script - do')
    console.error('      not delete it. The bug it guards is silent by nature.')
    process.exit(1)
  }
  const out = {}
  for (const row of m[1].matchAll(/(\w+)\s*:\s*(\[\[[\d.,\[\]\s]*\]\])/g)) {
    out[row[1]] = JSON.parse(row[2])
  }
  return out
}

const fmt = n => '$' + Number(n).toFixed(2)

const fallback = readFallbackTiers()
const garments = Object.keys(fallback)
if (!garments.length) {
  console.error('FAIL  parsed zero garments out of index.html TIERS.')
  process.exit(1)
}

let live
try {
  const res = await fetch(ENDPOINT + '?check=' + Date.now())
  if (!res.ok) throw new Error('HTTP ' + res.status)
  live = (await res.json()).tiers
} catch (err) {
  // A dead endpoint is not a pricing failure - the homepage falls back
  // to the committed table, which is the table this script validates.
  // Say so and pass, rather than blocking a deploy on CRM uptime.
  console.log('SKIP  could not reach ' + ENDPOINT + ' (' + err.message + ').')
  console.log('      Homepage will serve the index.html fallback, which is')
  console.log('      what this check validates against. Not a failure.')
  process.exit(0)
}

if (!live) {
  console.error('FAIL  endpoint answered without a `tiers` key.')
  process.exit(1)
}

const under = []
const over  = []
let compared = 0

for (const g of garments) {
  const fb = fallback[g]
  const lv = live[g]
  if (!lv) {
    under.push({ g, band: '(all)', detail: 'endpoint returned no ladder for this garment' })
    continue
  }
  for (let i = 0; i < fb.length; i++) {
    const [min, max, fbPrice] = fb[i]
    const row = lv[i]
    if (!row) {
      under.push({ g, band: min + '-' + max, detail: 'endpoint returned no band here' })
      continue
    }
    const lvPrice = row[2]
    compared++
    if (!(lvPrice > 0)) {
      under.push({ g, band: min + '-' + max, detail: 'endpoint returned ' + lvPrice })
    } else if (lvPrice < fbPrice) {
      under.push({
        g, band: min + '-' + max,
        detail: 'live ' + fmt(lvPrice) + ' < published ' + fmt(fbPrice) +
                '  (' + fmt(fbPrice - lvPrice) + ' under)',
      })
    } else if (lvPrice > fbPrice) {
      over.push({ g, band: min + '-' + max, detail: 'live ' + fmt(lvPrice) + ' > published ' + fmt(fbPrice) })
    }
  }
}

console.log('Compared ' + compared + ' bands across ' + garments.length + ' garments against ' + ENDPOINT)

if (over.length) {
  console.log('')
  console.log(over.length + ' band(s) ABOVE the published fallback - allowed, listed so a')
  console.log('deliberate increase is visible and a surprise one is too:')
  for (const o of over) console.log('  ' + o.g.padEnd(12) + ' ' + o.band.padEnd(12) + ' ' + o.detail)
}

if (under.length) {
  console.log('')
  console.error('FAIL  ' + under.length + ' band(s) published BELOW the committed fallback:')
  for (const u of under) console.error('  ' + u.g.padEnd(12) + ' ' + u.band.padEnd(12) + ' ' + u.detail)
  console.error('')
  console.error('The slider is quoting a number the fallback says we do not offer.')
  console.error('Check the decoration method the endpoint passes to the engine before')
  console.error('assuming the fallback is the stale one - that is how caps broke.')
  process.exit(1)
}

console.log('')
console.log('OK    no band published below the committed fallback.')
