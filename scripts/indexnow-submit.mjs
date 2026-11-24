#!/usr/bin/env node
/**
 * indexnow-submit.mjs — tell Bing (and the other IndexNow engines) which
 * pages changed, so they re-read them the same day instead of whenever
 * their crawler next comes by.
 *
 * Only pages that are in sitemap.xml are ever submitted: the sitemap is the
 * list of pages the shop wants indexed, and 4,500 product pages are
 * deliberately noindex. A change to a shared file (components.js, lang.js)
 * touches every page and is NOT a reason to resubmit the whole site;
 * IndexNow asks for the URLs whose content changed.
 *
 * The key below is public by design: IndexNow proves ownership by finding
 * the same key in /<key>.txt on the site.
 *
 * Usage:
 *   node scripts/indexnow-submit.mjs --dry-run index.html p/gildan-18500/index.html
 *   git diff --name-only A B | node scripts/indexnow-submit.mjs --stdin
 *   node scripts/indexnow-submit.mjs --all          (every sitemap URL; first run only)
 * Runs from .github/workflows/indexnow.yml after each push to main.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const HOST = 'www.singhsprint.com'
const SITE = 'https://' + HOST
export const KEY = '9cfb1c6601ffa147c6ca72b460f31c96'

/** Repo file -> the URL it is served at, or null if it is not a page. */
export function urlForFile(file) {
  const f = String(file).trim().replace(/^\.\//, '')
  if (!f.endsWith('.html')) return null
  if (f === 'index.html') return SITE + '/'
  if (f.endsWith('/index.html')) return SITE + '/' + f.slice(0, -'/index.html'.length)
  return SITE + '/' + f.slice(0, -'.html'.length)
}

export function sitemapUrls() {
  const xml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8')
  return new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim()))
}

export function urlsToSubmit(files, listed = sitemapUrls()) {
  const out = new Set()
  for (const f of files) {
    const u = urlForFile(f)
    if (u && listed.has(u)) out.add(u)
  }
  return [...out].sort()
}

async function main() {
  const args = process.argv.slice(2)
  const dry = args.includes('--dry-run')
  let urls
  if (args.includes('--all')) urls = [...sitemapUrls()].sort()
  else {
    const files = args.includes('--stdin')
      ? fs.readFileSync(0, 'utf8').split('\n')
      : args.filter((a) => !a.startsWith('--'))
    urls = urlsToSubmit(files)
  }
  if (!urls.length) { console.log('indexnow: no indexed page changed, nothing to submit'); return }
  console.log(`indexnow: ${urls.length} URL(s)${dry ? ' (dry run, not sent)' : ''}`)
  for (const u of urls.slice(0, 20)) console.log('  ' + u)
  if (urls.length > 20) console.log(`  ... and ${urls.length - 20} more`)
  if (dry) return
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: urls.slice(0, 10000) }),
  })
  // 200 = accepted, 202 = accepted, key still being checked.
  console.log('indexnow: HTTP ' + res.status)
  if (res.status !== 200 && res.status !== 202) {
    console.error(await res.text().catch(() => ''))
    process.exit(1)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
