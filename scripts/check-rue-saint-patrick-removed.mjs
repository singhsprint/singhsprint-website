/**
 * check-rue-saint-patrick-removed.mjs
 *
 * Rue Saint-Patrick is off the site. This asserts it stayed off, and that
 * nothing 404s on the way out.
 *
 * WHY THIS EXISTS. The line was already excluded from page generation on
 * 2026-08-16 — `EXCLUDED_SUPPLIERS` in generate-product-pages.mjs, with a
 * comment explaining the decision. A month later, on 2026-09-17:
 *
 *     https://www.singhsprint.com/p/rue-saint-patrick-60100     200
 *     https://www.singhsprint.com/designed-in-montreal          200
 *     36 rue-saint-patrick URLs in sitemap.xml
 *
 * Because the generator only stops CREATING pages. It has never deleted one,
 * so every page written before that decision stayed on disk, stayed committed,
 * stayed in the sitemap and stayed served. The decision was recorded in the
 * one place that could not carry it out.
 *
 * So the load-bearing assertion here is E: no page may exist on disk for an
 * excluded supplier. Not "the generator excludes it" — that was true the whole
 * time it was wrong.
 *
 * Exit 0 = pass, 1 = fail. Pure file reads, no network.
 */

import { readFileSync, readdirSync, existsSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const problems = [];
const ok  = (label, cond) => { if (!cond) problems.push(label); };
const eq  = (label, got, exp) => {
  const g = JSON.stringify(got), e = JSON.stringify(exp);
  if (g !== e) problems.push(`${label}\n      got:      ${g}\n      expected: ${e}`);
};

const BRAND = /Rue\s+Saint-Patrick/i;
const STORY = /designed-in-montreal/;
const FILTER = /canadian=1/;

/** Comments are not customer-facing, and a note saying WHY something was
 *  removed is worth keeping. Strip them before judging the copy.
 *
 *  ANCHORED AT LINE START, deliberately. The obvious version —
 *  `/\/\*[\s\S]*?\*\//g` plus a `//` rule — ate most of catalog.js: a regex
 *  literal or a string containing the comment punctuation opens a span that
 *  runs to the next `*&#47;` hundreds of lines away. Everything asserted on the
 *  stripped text then passed because the text was gone, which is the worst way
 *  for a check to succeed. This only removes a comment that OWNS its line,
 *  which is how this codebase writes them, and it cannot start inside a string.
 *
 *  selfTestStripper() below is not optional: a stripper with no test is how
 *  this went unnoticed in the first place. */
function stripComments(code, isHtml) {
  if (isHtml) return code.replace(/^[ \t]*<!--[\s\S]*?-->[ \t]*$/gm, '');
  return code
    .replace(/^[ \t]*\/\*[\s\S]*?\*\/[ \t]*$/gm, '')
    .replace(/^[ \t]*\/\/[^\n]*$/gm, '');
}

/** The stripper must remove comments and nothing else. Run against real files,
 *  because a synthetic fixture would not have caught what broke this. */
function selfTestStripper() {
  const cases = [
    ['catalog.js', false, ['state.filters.csa', 'params.set(', 'function fetchPage']],
    ['quote.js', false, ['var blankOptions', 'basePrice']],
    ['lang.js', false, ["'home.faq.a4'"]],
    ['index.html', true, ['brands-row__track', '<body']],
  ];
  for (const [f, isHtml, markers] of cases) {
    const raw = readFileSync(path.join(ROOT, f), 'utf8');
    const out = stripComments(raw, isHtml);
    ok(`Z1 stripping ${f} keeps most of the file`, out.length > raw.length * 0.5);
    for (const m of markers) {
      ok(`Z2 stripping ${f} keeps ${JSON.stringify(m)}`, out.includes(m));
    }
  }
  // And it must actually strip.
  ok('Z3 a whole-line // comment is removed',
    !stripComments('const a = 1;\n// secret\n', false).includes('secret'));
  ok('Z4 a whole-line block comment is removed',
    !stripComments('const a = 1;\n/* secret */\n', false).includes('secret'));
  ok('Z5 an html comment is removed',
    !stripComments('<p>x</p>\n  <!-- secret -->\n', true).includes('secret'));
  // Code that merely LOOKS like a comment must survive.
  ok('Z6 a url inside code survives',
    stripComments("const u = 'https://x.example/a';", false).includes('x.example'));
  ok('Z7 a regex literal survives',
    stripComments('const r = /a\\/*b/;', false).includes('a'));
}
selfTestStripper();

function walk(dir, out = [], skip = /(^|\/)(_to_delete|node_modules|\.git)(\/|$)/) {
  if (skip.test(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (skip.test(p)) continue;
    if (e.isDirectory()) walk(p, out, skip);
    else out.push(p);
  }
  return out;
}

const ALL = walk(ROOT);
const rel = (p) => path.relative(ROOT, p);

// ── A. the brand is not named anywhere a customer can read ────────────────
{
  const pages = ALL.filter((f) => f.endsWith('.html'));
  const scripts = ALL.filter((f) => /\.(js|mjs)$/.test(f) && !rel(f).startsWith('scripts/'));
  const named = [];
  for (const f of [...pages, ...scripts]) {
    const body = stripComments(readFileSync(f, 'utf8'), f.endsWith('.html'));
    if (BRAND.test(body)) named.push(rel(f));
  }
  eq('A1 the brand is named on no page and in no shipped script', named, []);

  const linked = [];
  for (const f of pages) {
    const body = stripComments(readFileSync(f, 'utf8'), true);
    if (STORY.test(body) || FILTER.test(body)) linked.push(rel(f));
  }
  eq('A2 nothing links to the story page or the Canadian filter', linked, []);
}

// ── B. the pages are gone from the served tree ────────────────────────────
{
  for (const p of ['designed-in-montreal.html', 'fr/designed-in-montreal.html']) {
    ok(`B1 ${p} is not served`, !existsSync(path.join(ROOT, p)));
  }
  for (const d of ['p', 'fr/p']) {
    const dir = path.join(ROOT, d);
    const hits = existsSync(dir)
      ? readdirSync(dir).filter((n) => /rue-saint-patrick/i.test(n))
      : [];
    eq(`B2 no ${d}/ directory for the brand`, hits, []);
  }
}

// ── C. the sitemap agrees ─────────────────────────────────────────────────
const sitemap = readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
{
  const locs = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  ok('C1 the sitemap still has its URLs', locs.length > 10000);
  eq('C2 no removed URL is still advertised to Google',
    locs.filter((u) => /rue-saint-patrick|designed-in-montreal/i.test(u)), []);
  eq('C3 no hreflang alternate points at one either',
    [...sitemap.matchAll(/href="([^"]*)"/g)].map((m) => m[1])
      .filter((u) => /rue-saint-patrick|designed-in-montreal/i.test(u)), []);
}

// ── D. every URL that WAS live now redirects ──────────────────────────────
//
// Read from the quarantine folder, so this tests the real set that went away
// rather than a list retyped here.
const vercel = JSON.parse(readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
{
  const q = path.join(ROOT, '_to_delete', 'rue-saint-patrick');
  const removed = [];
  if (existsSync(q)) {
    for (const [dir, prefix] of [[path.join(q, 'p'), '/p/'], [path.join(q, 'fr', 'p'), '/fr/p/']]) {
      if (!existsSync(dir)) continue;
      for (const n of readdirSync(dir)) removed.push(prefix + n);
    }
  }
  removed.push('/designed-in-montreal', '/fr/designed-in-montreal');
  ok('D1 the removed set was found', removed.length === 38);

  // Vercel source matching: ":param" captures one path segment.
  const toRe = (src) =>
    new RegExp('^' + src.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                        .replace(/:[A-Za-z_][\w]*/g, '[^/]+') + '$');
  const redirects = (vercel.redirects || []);
  const uncovered = removed.filter(
    (u) => !redirects.some((r) => r.permanent && toRe(r.source).test(u)));
  eq('D2 every removed URL has a permanent redirect', uncovered, []);

  // A redirect to a page that is itself gone is a 404 with extra steps.
  const ours = redirects.filter((r) => /rue-saint-patrick|designed-in-montreal/.test(r.source));
  const dests = [...new Set(ours.map((r) => r.destination))];
  eq('D3 they land on /catalog', dests.sort(), ['/catalog', '/fr/catalog']);
  // PER SOURCE, not as a set. The set was all this asserted, so pointing the
  // French story page at the English catalog satisfied it — a French visitor
  // silently switched languages and the check said nothing.
  const crossed = ours
    .filter((r) => (r.source.startsWith('/fr/')) !== (r.destination.startsWith('/fr/')))
    .map((r) => `${r.source} -> ${r.destination}`);
  eq('D3b no redirect changes the visitor\u2019s language', crossed, []);
  for (const d of dests) {
    const f = path.join(ROOT, d.replace(/^\//, '') + '.html');
    ok(`D4 ${d} is a page that exists`, existsSync(f));
  }
}

// ── E. a page may not exist for an excluded supplier ──────────────────────
//
// THE ONE THAT WOULD HAVE CAUGHT THIS A MONTH EARLY. The generator's exclusion
// list and the pages on disk are different facts, and only the second is
// served. Scans page CONTENT, so a differently-slugged directory cannot hide.
{
  const gen = readFileSync(path.join(ROOT, 'scripts', 'generate-product-pages.mjs'), 'utf8');
  const m = gen.match(/EXCLUDED_SUPPLIERS\s*=\s*new Set\(\[([^\]]*)\]\)/);
  ok('E1 the generator still has an exclusion list', !!m);
  const excluded = m ? [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]) : [];
  ok('E2 the delisted supplier is still excluded from regeneration',
    excluded.includes('rue_sainte_patrick'));

  // ~13,800 product pages, so read each page's HEAD rather than all of it.
  // HEAD_BYTES is self-tested below against the real pages that were pulled:
  // if the generator ever moves the brand name past that bound, E4 fails
  // loudly instead of E3 passing for the wrong reason.
  const HEAD_BYTES = 4096;
  const head = (f) => {
    const fd = openSync(f, 'r');
    try {
      const buf = Buffer.alloc(HEAD_BYTES);
      const n = readSync(fd, buf, 0, HEAD_BYTES, 0);
      return buf.subarray(0, n).toString('utf8');
    } finally { closeSync(fd); }
  };

  const q = path.join(ROOT, '_to_delete', 'rue-saint-patrick', 'p');
  const specimens = existsSync(q) ? readdirSync(q) : [];
  ok('E4a there are specimens to calibrate against', specimens.length > 0);
  const missed = specimens.filter((n) => {
    const f = path.join(q, n, 'index.html');
    return existsSync(f) && !BRAND.test(head(f));
  });
  eq(`E4 the brand appears within the first ${HEAD_BYTES} bytes of every pulled page`, missed, []);

  const stale = [];
  for (const d of ['p', 'fr/p']) {
    const dir = path.join(ROOT, d);
    if (!existsSync(dir)) continue;
    for (const n of readdirSync(dir)) {
      if (/rue-saint-patrick/i.test(n)) { stale.push(d + '/' + n); continue; }
      const f = path.join(dir, n, 'index.html');
      if (!existsSync(f) || !statSync(f).isFile()) continue;
      if (BRAND.test(head(f))) stale.push(d + '/' + n);
    }
  }
  eq('E3 no generated page survives for the excluded supplier', stale, []);
}

// ── F. the quote tool no longer offers it ─────────────────────────────────
{
  const q = readFileSync(path.join(ROOT, 'quote.js'), 'utf8');
  const code = stripComments(q, false);
  for (const id of ['canadianBlanks', 'stpat', 'canadian_addon', 'canadian_blanks']) {
    ok(`F1 quote.js carries no ${id}`, !new RegExp('\\b' + id + '\\b').test(code));
  }
  // Behavioural: run the real option table and check nothing offers the brand.
  const tbl = q.match(/var blankOptions = \{[\s\S]*?\n    \};/);
  ok('F2 the blank-brand table was found', !!tbl);
  if (tbl) {
    const opts = new Function(tbl[0].replace(/^var /, 'const ') + '\nreturn blankOptions;')();
    const offending = Object.entries(opts).flatMap(([g, list]) =>
      list.filter((o) => BRAND.test(o.v) || BRAND.test(o.t)).map((o) => `${g}: ${o.v}`));
    eq('F3 no garment offers the brand as a blank', offending, []);
    ok('F4 the table still offers other blanks', Object.values(opts).every((l) => l.length > 0));
  }
  // The +$2 branch read state.canadianBlanks; with the flag gone it cannot fire.
  ok('F5 no surviving "+ 2" price branch mentions Canadian',
    !/canadian[\s\S]{0,200}basePrice \+ 2/i.test(code));

  for (const p of ['quote.html', 'fr/quote.html']) {
    ok(`F6 ${p} has no canadian_blanks input`,
      !/name="canadian_blanks"/.test(readFileSync(path.join(ROOT, p), 'utf8')));
  }
}

// ── G. no page points at a translation key that no longer exists ──────────
{
  const lang = readFileSync(path.join(ROOT, 'lang.js'), 'utf8');
  const GONE = ['biz.pricing.canadian', 'cat.card.canadian', 'quote.canadian.sub'];
  for (const k of GONE) {
    ok(`G1 lang.js no longer defines ${k}`, !new RegExp(`'${k.replace(/\./g, '\\.')}'\\s*:`).test(lang));
  }
  const dangling = [];
  for (const f of ALL.filter((x) => x.endsWith('.html'))) {
    const body = readFileSync(f, 'utf8');
    for (const k of GONE) if (body.includes(`data-i18n="${k}"`)) dangling.push(`${rel(f)} → ${k}`);
  }
  eq('G2 nothing still asks for a removed string', dangling, []);
}

// ── H. the catalog's Canadian filter is gone, the rest of it is not ───────
{
  const cat = stripComments(readFileSync(path.join(ROOT, 'catalog.js'), 'utf8'), false);
  ok('H1 no canadian filter state', !/state\.filters\.canadian/.test(cat));
  ok('H2 no rspBanner toggle', !/rspBanner/.test(cat));
  // The neighbouring CSA filter must survive — this removal was surgical.
  // "the identifier appears somewhere" was all this asserted, and the search
  // call had its csa argument replaced with a literal `false` while three
  // other mentions kept the check green. Assert it reaches the QUERY.
  ok('H3 the CSA filter still works', /state\.filters\.csa/.test(cat));
  ok('H3b …and is still what search is asked for',
    /csa:\s*state\.filters\.csa/.test(cat));
  ok('H3c …and still reaches the URL', /params\.set\('csa'/.test(cat));
  ok('H4 the in-stock filter still works', /state\.filters\.inStockOnly/.test(cat));
  const alg = stripComments(readFileSync(path.join(ROOT, 'catalog-algolia.js'), 'utf8'), false);
  ok('H5 search sends no canadian facet', !/opts\.canadian/.test(alg));
  ok('H6 search still sends the CSA facet', /opts\.csa/.test(alg));
}

if (problems.length) {
  console.error(`\ncheck-rue-saint-patrick-removed: ${problems.length} problem(s)\n`);
  for (const p of problems) console.error('  * ' + p);
  process.exit(1);
}
console.log('check-rue-saint-patrick-removed: OK — gone from the site, and nothing that was live now 404s.');
