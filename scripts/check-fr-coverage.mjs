#!/usr/bin/env node
/**
 * check-fr-coverage.mjs
 * ---------------------------------------------------------------
 * The French pages people find on Google must be French, and must say
 * exactly what the English says.
 *
 * Until 2026-10-30 the six service pages, five industry pages and every guide
 * under /fr/ were English with <html lang="fr">: the mirror only translated
 * elements carrying a data-i18n key, about 11 per page. Search Console had
 * 22 French queries, 0 clicks, positions 47-75.
 *
 * For every page in FULLY_FRENCH (scripts/generate-fr-mirror.mjs):
 *   A. every sentence has a translation in i18n/fr.json (or is lang.js French)
 *   B. /fr/<page> on disk is what the mirror produces now (not stale)
 *   C. the visible text reads as French (function-word ratio), <title> and
 *      meta description are not the English ones
 *   D. no relative asset paths: "../components.js" on /fr/guides/x resolves
 *      to /fr/components.js, a 404 -- the French guides and industry pages
 *      shipped without nav, footer or analytics because of it
 *   E. no data-i18n key without French (the runtime would put English back)
 * For every entry of i18n/fr.json used by those pages:
 *   F. the same numbers (digits, separators ignored) -- a translation may not
 *      change a price, a quantity or a lead time
 *   G. the same HTML tags with the same attributes -- no dropped or invented
 *      links
 *
 *   node scripts/check-fr-coverage.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from './generate-fr-mirror.mjs';
import { keysOf, norm } from './lib/html-segments.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const FR_WORDS = new Set('le la les des une un et pour vos votre nous avec sur dans est pas que qui à du au aux ou en par vous ce cette ces son sa ses'.split(' '));
const EN_WORDS = new Set('the and for your our with on in is not that who to of a we you this these by or are be from'.split(' '));

export function frenchRatio(html) {
  const body = (html.split(/<body[^>]*>/i)[1] || html)
    .replace(/<!--[\s\S]*?-->/g, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').toLowerCase();
  const w = body.match(/[a-zàâçéèêëîïôûùüÿœ']+/g) || [];
  let fr = 0, en = 0;
  for (const x of w) { if (FR_WORDS.has(x)) fr++; else if (EN_WORDS.has(x)) en++; }
  return fr + en ? fr / (fr + en) : 0;
}

/** Digit groups, separators (space, comma, dot, nbsp, entities, tags) ignored. */
export function numbers(s) {
  const t = String(s).replace(/<[^>]+>/g, ' ').replace(/&#?\w+;/g, ' ');
  const out = (t.match(/\d[\d,.   ]*\d|\d/g) || []).map((x) => x.replace(/\D/g, ''));
  return out.sort().join('|');
}
export function tags(s) {
  return (String(s).match(/<[^>]+>/g) || []).map((x) => x.replace(/\s+/g, ' ')).sort().join('');
}

export function entryProblems(en, fr) {
  const out = [];
  if (typeof fr !== 'string' || !fr.trim()) return ['empty translation'];
  if (numbers(en) !== numbers(fr)) out.push(`numbers differ: [${numbers(en)}] vs [${numbers(fr)}]`);
  if (tags(en) !== tags(fr)) out.push('HTML tags/attributes differ');
  return out;
}

export function pageProblems(rel, enHtml, frOnDisk, T, tm, frSet) {
  const out = [];
  const { html, missing } = M.buildFrPage(enHtml, rel, T, tm, frSet);
  for (const k of missing) out.push(`A untranslated: ${k.slice(0, 90)}`);
  if (frOnDisk !== html) out.push('B /fr file is stale -- run node scripts/generate-fr-mirror.mjs');
  const ratio = frenchRatio(html);
  if (ratio < 0.8) out.push(`C only ${(ratio * 100).toFixed(0)}% French`);
  const t = (s) => (/<title>([\s\S]*?)<\/title>/i.exec(s) || [])[1];
  const d = (s) => (/<meta\s+name="description"\s+content="([^"]*)"/i.exec(s) || [])[1];
  if (t(html) && t(html) === t(enHtml)) out.push('C <title> is the English one');
  if (d(html) && d(html) === d(enHtml)) out.push('C meta description is the English one');
  for (const m of html.matchAll(/\s(?:src|href)="((?:\.\.\/|\.\/)[^"]*|(?![a-z]+:|\/|#|\?)[^"]+\.(?:js|css|png|jpe?g|webp|svg|ico))"/gi)) {
    out.push(`D relative asset path ${m[1]} (resolves under /fr/)`);
  }
  for (const m of html.matchAll(/\sdata-i18n="([^"]+)"/g)) {
    if (!T[m[1]] || !T[m[1]].fr) out.push(`E data-i18n="${m[1]}" has no French; the runtime would restore English`);
  }
  return out;
}

async function main() {
  const T = await M.loadTranslations();
  const tm = await M.loadMemory();
  const frSet = M.frenchValues(T);
  const problems = [];
  const used = new Set();
  for (const rel of M.FULLY_FRENCH) {
    const en = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    let frDisk = '';
    try { frDisk = fs.readFileSync(path.join(ROOT, 'fr', rel), 'utf8'); } catch {}
    for (const p of pageProblems(rel, en, frDisk, T, tm, frSet)) problems.push(`/fr/${rel}: ${p}`);
    for (const k of keysOf(M.translateHtml(M.stripComments(en), T))) if (Object.prototype.hasOwnProperty.call(tm, norm(k))) used.add(norm(k));
  }
  for (const k of used) for (const p of entryProblems(k, tm[k])) problems.push(`i18n/fr.json "${k.slice(0, 70)}": ${p}`);
  console.log(`check-fr-coverage: ${M.FULLY_FRENCH.length} pages, ${used.size} translations checked, ${problems.length} problem(s)`);
  for (const p of problems.slice(0, 40)) console.log('  - ' + p);
  process.exit(problems.length ? 1 : 0);
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
