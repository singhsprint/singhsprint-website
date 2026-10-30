#!/usr/bin/env node
/**
 * generate-fr-mirror.mjs
 * ---------------------------------------------------------------
 * Builds the static French mirror of the site at /fr/.
 *
 * Why static instead of a client-side swap: Googlebot indexes the initial
 * HTML of each URL. If /fr/x only became French after JavaScript ran, Google
 * would index English under a French URL.
 *
 * Run before deploy:
 *   node scripts/generate-fr-mirror.mjs            (writes /fr/)
 *   node scripts/generate-fr-mirror.mjs --report   (lists untranslated copy, writes nothing)
 *   node scripts/generate-fr-mirror.mjs --prune    (also removes FR files whose EN page is gone)
 *
 * Per page, in this order:
 *   1. data-i18n="key" elements get their lang.js French (the runtime toggle
 *      uses the same keys).
 *   2. Every remaining sentence, attribute (alt/title/placeholder/aria-label,
 *      meta description, og:/twitter: copy) and JSON-LD copy string is looked
 *      up in i18n/fr.json, the translation memory. Lookup is by the English
 *      sentence itself (whitespace-collapsed), see scripts/lib/html-segments.mjs.
 *   3. <html lang>, og:locale, canonical, hreflang, og:url, and same-origin
 *      links are rewritten to the /fr/ side.
 *
 * 2026-10-30 -- why step 2 exists. Until now step 1 was the only translation,
 * and only ~11 elements per service page carried a data-i18n key. The six
 * service pages, five industry pages and every guide shipped under /fr/ as
 * English with lang="fr": Search Console showed 22 French queries, 0 clicks,
 * positions 47-75. Step 2 translates the copy itself; when an English sentence
 * changes, its old translation stops matching and scripts/check-fr-coverage.mjs
 * names the sentence, instead of the French page quietly keeping old wording.
 *
 * What it does NOT touch:
 *   - /fr/p/ (product pages): written by generate-product-pages.mjs.
 *   - HAND_MAINTAINED pages below: their French is written directly.
 *
 * 2026-10-30 -- this script used to start with `rm -rf fr/`. Anywhere rm was
 * allowed that deleted all 4,603 French product pages (another script's
 * output) and the hand-written legal pages, and then regenerated neither.
 * It only ever "worked" on a mount that refuses deletes. It no longer deletes
 * anything unless asked with --prune, and --prune only removes generated
 * pages whose English source is gone.
 */

import fs   from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { applyTranslations, segments, norm } from './lib/html-segments.mjs';

const ROOT   = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FR_DIR = path.join(ROOT, 'fr');
const SITE   = 'https://www.singhsprint.com';
export const TM_PATH = path.join(ROOT, 'i18n', 'fr.json');

// French maintained by hand (or by its own generator). The mirror never
// writes these. Paths are relative to the site root, EN side.
//   legal pages: full hand translation (Bill 96), since 2026-06-05
//   gifts/*:     written by scripts/build_gifts.py in both languages
//   account/orders, account/quote: edited by hand after mirroring
//   guides/custom-hoodies-bulk-order-guide: written in both languages
export const HAND_MAINTAINED = new Set([
  'privacy.html', 'cookies.html', 'terms.html', 'accessibility.html',
  'gifts.html', 'gifts/build.html', 'gifts/order.html',
  'account/orders.html', 'account/quote.html',
  'guides/custom-hoodies-bulk-order-guide.html',
]);

// Pages that must come out 100% French: every sentence has a translation in
// i18n/fr.json. scripts/check-fr-coverage.mjs fails on any gap. These are the
// pages people find from Google; the rest (account/*, noindex utilities, pages
// that now redirect) still mirror, best effort.
export const FULLY_FRENCH = [
  'index.html', 'about.html', 'why-us.html', 'quote.html', 'catalog.html',
  'businesses.html', 'businesses/rfp.html', 'portfolio.html', 'inkwear.html',
  'jerseys.html', 'youth-initiative.html', 'order.html',
  'custom-t-shirts-montreal.html', 'custom-hoodies-montreal.html',
  'custom-hats-caps-montreal.html', 'dtg-printing-montreal.html',
  'dtf-printing-montreal.html', 'embroidery-montreal.html',
  'industries/construction-workwear.html', 'industries/restaurant-hospitality-uniforms.html',
  'industries/corporate-tech-swag.html', 'industries/charity-events-fundraisers.html',
  'industries/schools-sports-teams.html',
  'guides/brand-colour-matching.html', 'guides/branded-winter-outerwear.html',
  'guides/bulk-order-size-run.html', 'guides/cafe-restaurant-merch.html', 'guides/custom-embroidered-caps-ordering-guide.html',
  'guides/decoration-method-durability.html', 'guides/fabric-cotton-polyester-blends.html',
  'guides/logo-file-requirements.html', 'guides/logo-placement-print-sizes.html',
  'guides/minimum-order-price-breaks.html', 'guides/procurement-checklist.html',
  'guides/team-jersey-ordering.html', 'guides/wash-care-printed-embroidered-apparel.html',
  'shop/index.html', 'shop/policies.html',
];

// -- Load translations from lang.js ----------------------------------------
// lang.js is "var translations = { ... };" -- extract that object literal and
// evaluate it inside a Function so we don't parse JS by hand.
export async function loadTranslations() {
  const src = await fs.readFile(path.join(ROOT, 'lang.js'), 'utf8');
  const m = src.match(/translations\s*=\s*(\{[\s\S]*?\n  \})\s*;/);
  if (!m) throw new Error('Could not extract translations object from lang.js');
  const fn = new Function('return ' + m[1]);
  return fn();
}

export async function loadMemory() {
  try { return JSON.parse(await fs.readFile(TM_PATH, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return {}; throw e; }
}

// -- HTML files to mirror --------------------------------------------------
async function findHtmlFiles(dir, out = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      // /p/ is written by generate-product-pages.mjs (both languages).
      // '_to_delete' (2026-10-05): orphaned pages are parked there rather than
      // removed; mirroring them once produced 2,371 French pages for products
      // deliberately taken off the site.
      if (['fr', 'scripts', 'node_modules', '.git', 'images', 'downloads', 'p', '_to_delete', 'tmp', 'i18n'].includes(e.name)) continue;
      await findHtmlFiles(full, out);
    } else if (e.isFile() && e.name.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

// -- Step 1: data-i18n -------------------------------------------------------
// A regex pass for data-i18n="key">...</close. Elements whose inner content
// itself holds data-i18n children are left to the runtime.
export function translateHtml(html, T) {
  // 1. Replace data-i18n="key" inner content. The regex captures:
  //    [1] tag name, [2] attrs before data-i18n, [3] the key, [4] attrs after,
  //    [5] the inner content up to the matching close tag, [6] the close tag.
  // We use a *non-greedy* inner-content match scoped to the same tag name
  // and stop at the next </tagname>. Works for the vast majority of cases.
  html = html.replace(
    /<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*?)\bdata-i18n="([^"]+)"([^>]*?)>([\s\S]*?)<\/\1>/g,
    (whole, tag, attrsBefore, key, attrsAfter, inner) => {
      const entry = T[key];
      if (!entry || !entry.fr) return whole;
      // Avoid clobbering elements whose inner content is mostly markup
      // (e.g. a wrapper with several child <span>s — translating those is
      // the runtime SP_LANG's job, not the static pass).
      if (/<[a-zA-Z][^>]*data-i18n="/.test(inner)) return whole;
      return `<${tag}${attrsBefore} data-i18n="${key}"${attrsAfter}>${entry.fr}</${tag}>`;
    }
  );

  // An element keyed to a lang.js entry with no French would be put BACK to
  // English by the runtime (SP_LANG.t falls back to en), undoing step 2. Drop
  // the key on the French side so the static French stays.
  html = html.replace(/\sdata-i18n="([^"]+)"/g, (m, key) => (T[key] && T[key].fr ? m : ''));

  html = html.replace(/<html\s+lang="en"/i, '<html lang="fr"');
  html = html.replace(/(<meta\s+property="og:locale"\s+content=)"en_CA"/i, '$1"fr_CA"');
  if (!/og:locale:alternate/i.test(html)) {
    html = html.replace(
      /(<meta\s+property="og:locale"\s+content="fr_CA"\s*\/?>)/i,
      '$1\n  <meta property="og:locale:alternate" content="en_CA">'
    );
  }
  return html;
}

// -- Step 2: translation memory ---------------------------------------------
// Copy that step 1 already made French (a lang.js fr value) counts as
// translated; everything else must be in the memory.
export function frenchValues(T) {
  const set = new Set();
  for (const v of Object.values(T)) if (v && typeof v.fr === 'string') set.add(norm(v.fr));
  return set;
}

export function translateCopy(html, tm, frSet) {
  const { html: out, missing } = applyTranslations(html, tm);
  return { html: out, missing: [...new Set(missing.filter((k) => !frSet.has(k)))] };
}

// Convert 'businesses/rfp.html' or 'guides/index.html' to the URL Vercel
// serves. trailingSlash is false in vercel.json, so '/guides/' 308s to
// '/guides': the canonical must be the slash-less form or it points at a
// redirect (2026-10-30, Search Console had /fr/ and /guides/ as redirects).
export function cleanPath(relPath) {
  let p = '/' + relPath.replace(/^\/+/, '').replace(/\\/g, '/');
  if (p.endsWith('/index.html')) p = p.slice(0, -'/index.html'.length);
  else if (p.endsWith('.html'))  p = p.slice(0, -'.html'.length);
  return p === '' ? '/' : p;
}
const enUrlOf = (rel) => SITE + cleanPath(rel);
const frUrlOf = (rel) => { const c = cleanPath(rel); return SITE + '/fr' + (c === '/' ? '' : c); };

// -- Step 3: URLs -------------------------------------------------------------
function hreflangBlock(enUrl, frUrl) {
  return `\n  <link rel="alternate" hreflang="en" href="${enUrl}">` +
         `\n  <link rel="alternate" hreflang="fr" href="${frUrl}">` +
         `\n  <link rel="alternate" hreflang="x-default" href="${enUrl}">`;
}

function rewriteUrls(html, relPath) {
  const enUrl = enUrlOf(relPath);
  const frUrl = frUrlOf(relPath);
  html = html.replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${frUrl}">`);
  if (!/<link\s+rel="canonical"/i.test(html)) {
    html = html.replace(/<head>/i, `<head>\n  <link rel="canonical" href="${frUrl}">`);
  }
  html = html.replace(/\s*<link\s+rel="alternate"\s+hreflang="[^"]+"[^>]*\/?>/gi, '');
  html = html.replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i, (m) => m + hreflangBlock(enUrl, frUrl));
  html = html
    .replace(/(<meta\s+property="og:url"\s+content=)"[^"]*"/i, `$1"${frUrl}"`)
    .replace(/(<meta\s+name="twitter:url"\s+content=)"[^"]*"/i, `$1"${frUrl}"`);

  // Same-origin links stay inside /fr/. Shared static assets keep pointing at
  // the one root copy.
  const SKIP = /^(https?:|mailto:|tel:|#|\/api|\/images|\/downloads|\/components\.js|\/lang\.js|\/ai-translate\.js|\/favicon|\/robots|\/sitemap)|\.(css|js|mjs|png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|pdf|xml|txt|zip)(\?|$)/i;
  html = html.replace(/\bhref="([^"#]+)"/g, (match, href) => {
    if (SKIP.test(href)) return match;
    if (href.startsWith('/')) {
      if (href.startsWith('/fr/') || href === '/fr') return match;
      return href === '/' ? 'href="/fr"' : `href="/fr${href}"`;
    }
    return match;
  });
  return html;
}

export const stripComments = (html) => html.replace(/<!--(?!\[if)[\s\S]*?-->/g, '');

/** The whole French page for one EN file. Pure: no I/O. */
export function buildFrPage(enHtml, relPath, T, tm, frSet) {
  // Developer comments are English notes about the English page; they are not
  // copied to /fr/ (one named a delisted supplier on /fr/catalog). Conditional
  // comments (<!--[if ...]>) stay.
  let html = translateHtml(stripComments(enHtml), T);
  const r = translateCopy(html, tm, frSet);
  html = rewriteUrls(r.html, relPath);
  return { html, missing: r.missing };
}

/** EN side: hreflang alternates pointing at the French sibling. */
export function patchEnHreflang(html, relPath) {
  const enUrl = enUrlOf(relPath);
  html = html.replace(/\s*<link\s+rel="alternate"\s+hreflang="[^"]+"[^>]*\/?>/gi, '');
  html = html.replace(/(<link\s+rel="canonical"\s+href=")[^"]*("\s*\/?>)/i, `$1${enUrl}$2`);
  if (/<link\s+rel="canonical"/i.test(html)) {
    return html.replace(/(<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>)/i, (m) => m + hreflangBlock(enUrl, frUrlOf(relPath)));
  }
  return html.replace(/<head>/i, `<head>\n  <link rel="canonical" href="${enUrl}">${hreflangBlock(enUrl, frUrlOf(relPath))}`);
}

export async function mirrorTargets() {
  const files = await findHtmlFiles(ROOT);
  return files.map((f) => path.relative(ROOT, f).replace(/\\/g, '/')).filter((r) => !HAND_MAINTAINED.has(r)).sort();
}

async function main() {
  const REPORT = process.argv.includes('--report');
  const PRUNE  = process.argv.includes('--prune');
  const T = await loadTranslations();
  const tm = await loadMemory();
  const frSet = frenchValues(T);
  console.log(`lang.js: ${Object.keys(T).length} keys; i18n/fr.json: ${Object.keys(tm).length} sentences`);

  const rels = await mirrorTargets();
  const gaps = {};
  for (const rel of rels) {
    const src = await fs.readFile(path.join(ROOT, rel), 'utf8');
    const { html, missing } = buildFrPage(src, rel, T, tm, frSet);
    if (missing.length) gaps[rel] = missing;
    if (REPORT) continue;
    const outPath = path.join(FR_DIR, rel);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, html, 'utf8');
    await fs.writeFile(path.join(ROOT, rel), patchEnHreflang(src, rel), 'utf8');
  }

  const strict = new Set(FULLY_FRENCH);
  for (const [rel, miss] of Object.entries(gaps)) {
    if (REPORT || strict.has(rel)) console.log(`${strict.has(rel) ? 'UNTRANSLATED' : 'partial'}  /fr/${rel}: ${miss.length} sentence(s)`);
    if (REPORT && process.argv.includes('--verbose')) for (const k of miss) console.log('    ' + k.slice(0, 160));
  }

  if (PRUNE && !REPORT) {
    const keep = new Set(rels);
    const frFiles = (await findHtmlFiles(FR_DIR).catch(() => []))
      .map((f) => path.relative(FR_DIR, f).replace(/\\/g, '/'));
    for (const rel of frFiles) {
      if (keep.has(rel) || HAND_MAINTAINED.has(rel)) continue;
      await fs.rm(path.join(FR_DIR, rel));
      console.log(`pruned /fr/${rel} (no English page)`);
    }
  }
  if (!REPORT) console.log(`\nmirrored ${rels.length} pages -> /fr/ (hand-maintained, untouched: ${HAND_MAINTAINED.size})`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
