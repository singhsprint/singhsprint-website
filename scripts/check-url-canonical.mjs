#!/usr/bin/env node
/**
 * check-url-canonical.mjs
 * ---------------------------------------------------------------
 * Every URL we hand Google must be the URL that answers 200.
 *
 * vercel.json serves clean URLs with trailingSlash: false, so
 *   /p/gildan-18500/   308 -> /p/gildan-18500
 *   /guides/           308 -> /guides
 *   /about.html        308 -> /about
 * A canonical, hreflang, og:url, JSON-LD url/@id/item or sitemap <loc> that
 * points at the left-hand form points at a redirect. On 2026-10-30, 111 of the
 * 184 sitemap URLs and every product page's canonical did, and Search Console
 * listed 4,764 pages as "Page with redirect".
 *
 * Also checked here, because it travels in the same JSON-LD:
 *   - no aggregateRating / review in structured data. The 4.7 from Google
 *     Maps was stamped onto 4,603 products, five industry "Products" and the
 *     business itself; /catalog injected a stale 5.0 from 23. Google's review
 *     snippet rules forbid ratings gathered from another site and ratings not
 *     about the item marked up. The visible "4.7 on Google" copy stays.
 *   - an indexable page's canonical is itself.
 *
 *   node scripts/check-url-canonical.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://www.singhsprint.com';
const SKIP_DIRS = new Set(['_to_delete', 'node_modules', '.git', 'tmp', 'scripts', 'images', 'downloads', 'api', 'ForBusinessesTab', '_foldsrc', 'i18n']);

export function cleanUrl(u) {
  const m = /^https:\/\/www\.singhsprint\.com(\/[^?#]*)?([?#].*)?$/.exec(u);
  if (!m || m[1] === undefined) return u; // bare origin is the home page
  let p = m[1];
  if (p.endsWith('/index.html')) p = p.slice(0, -'index.html'.length);
  else if (p.endsWith('.html')) p = p.slice(0, -'.html'.length);
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return SITE + p + (m[2] || '');
}
export const isClean = (u) => cleanUrl(u) === u;

export function urlForFile(rel) {
  let p = '/' + rel.replace(/\\/g, '/');
  if (p.endsWith('/index.html')) p = p.slice(0, -'/index.html'.length);
  else if (p.endsWith('.html')) p = p.slice(0, -'.html'.length);
  return SITE + (p || '/');
}

function* htmlFiles(dir, base = '') {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) yield* htmlFiles(path.join(dir, e.name), base + e.name + '/'); }
    else if (e.name.endsWith('.html')) yield base + e.name;
  }
}

const URL_KEYS = new Set(['url', 'item', '@id', 'mainEntityOfPage', 'sameAs']);

/** Problems for one page. Pure. */
export function pageProblems(rel, html) {
  const out = [];
  const head = html.split(/<\/head>/i)[0];
  const noindex = /<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(head);
  const canon = /<link\s+rel="canonical"\s+href="([^"]+)"/i.exec(head);
  const tags = [
    ...[...head.matchAll(/<link\s+rel="canonical"\s+href="([^"]+)"/gi)].map((m) => ['canonical', m[1]]),
    ...[...head.matchAll(/<link\s+rel="alternate"\s+hreflang="([^"]+)"\s+href="([^"]+)"/gi)].map((m) => ['hreflang ' + m[1], m[2]]),
    ...[...head.matchAll(/<meta\s+(?:property|name)="(og:url|twitter:url)"\s+content="([^"]+)"/gi)].map((m) => [m[1], m[2]]),
  ];
  for (const [what, u] of tags) if (u.startsWith(SITE) && !isClean(u)) out.push(`${what} ${u} redirects to ${cleanUrl(u)}`);
  if (!noindex && canon && canon[1] !== urlForFile(rel)) out.push(`canonical ${canon[1]} is not this page (${urlForFile(rel)})`);

  for (const m of html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data;
    try { data = JSON.parse(m[1]); } catch (e) { out.push(`JSON-LD does not parse: ${e.message}`); continue; }
    (function walk(v, k) {
      if (Array.isArray(v)) return v.forEach((x) => walk(x, k));
      if (v && typeof v === 'object') {
        for (const bad of ['aggregateRating', 'review']) if (bad in v) out.push(`JSON-LD ${v['@type'] || 'node'} carries ${bad}`);
        for (const [kk, vv] of Object.entries(v)) walk(vv, kk);
        return;
      }
      if (typeof v === 'string' && URL_KEYS.has(k) && v.startsWith(SITE)) {
        const bare = v.split('#')[0];
        if (!isClean(bare)) out.push(`JSON-LD ${k} ${v} redirects`);
      }
    })(data);
  }
  return out;
}

export function sitemapProblems(xml, exists) {
  const out = [];
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const u = m[1];
    if (!isClean(u)) out.push(`sitemap <loc> ${u} redirects`);
    else if (!exists(u)) out.push(`sitemap <loc> ${u} has no indexable page`);
  }
  for (const m of xml.matchAll(/<xhtml:link[^>]+href="([^"]+)"/g)) if (!isClean(m[1])) out.push(`sitemap hreflang ${m[1]} redirects`);
  return out;
}

export function scriptProblems(name, src) {
  return /["']aggregateRating["']\s*:|["']@type["']\s*:\s*["']AggregateRating/.test(src) ? [`${name} still builds an AggregateRating`] : [];
}

function main() {
  const problems = [];
  const indexable = new Set();
  let n = 0;
  for (const rel of htmlFiles(ROOT)) {
    const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    n++;
    if (!/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(html.split(/<\/head>/i)[0])) indexable.add(urlForFile(rel));
    for (const p of pageProblems(rel, html)) problems.push(`${rel}: ${p}`);
  }
  const xml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  problems.push(...sitemapProblems(xml, (u) => indexable.has(u)));
  for (const f of ['components.js', 'catalog.js', 'scripts/generate-product-pages.mjs']) {
    problems.push(...scriptProblems(f, fs.readFileSync(path.join(ROOT, f), 'utf8')));
  }
  const byKind = {};
  for (const p of problems) { const k = p.replace(/^[^:]+: /, '').replace(/https?:\S+/g, 'URL').replace(/\(.*?\)/g, '').slice(0, 70); byKind[k] = (byKind[k] || 0) + 1; }
  console.log(`check-url-canonical: ${n} pages, ${problems.length} problem(s)`);
  for (const [k, c] of Object.entries(byKind).sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`  ${String(c).padStart(6)}  ${k}`);
  for (const p of problems.slice(0, 15)) console.log('  - ' + p);
  process.exit(problems.length ? 1 : 0);
}
if (import.meta.url === `file://${process.argv[1]}`) main();
