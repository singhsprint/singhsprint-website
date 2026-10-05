/**
 * check-product-page-claims — the 4,592 generated product pages state one
 * turnaround, offer only the methods the shop runs, and leave no orphans.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * generate-product-pages.mjs has carried, since 2026-08-16, a careful comment
 * describing an invariant and naming the checker that enforces it:
 *
 *     "THE INVARIANT, and the only thing check-turnaround-drift.mjs enforces:
 *          published.min <= engine.min AND published.max >= engine.max"
 *
 * There is no check-turnaround-drift.mjs. Not in this repo, not in the CRM.
 * The comment reads exactly like a live guarantee and has never run, which is
 * how the body copy came to publish "Standard turnaround is 3-5 business
 * days" on 6,899 pages while the table a hundred lines above it in the same
 * file said 3-10, 7-14 and 12-15 depending on supplier -- and while the home
 * page said 7-14 all along. The owner confirmed 2026-10-05 that 7-14 is the
 * standard and 3-5 is the rush path, so every one of those pages had been
 * advertising the rush window as the standard.
 *
 * WHAT THIS CAN AND CANNOT CHECK. The containment invariant above needs the
 * engine's live numbers from the CRM's /api/production/promise-windows. That
 * endpoint currently 307s to /login for anonymous callers -- it is not in the
 * CRM middleware allowlist, the same defect that kept /api/google-reviews
 * from ever self-correcting. So section 4 runs the real invariant when the
 * endpoint answers and SAYS SO LOUDLY when it cannot, rather than passing
 * silently and leaving another comment that reads like a guarantee.
 *
 * Run: node scripts/check-product-page-claims.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

let pass = 0;
const fails = [];
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fails.push(name + (detail ? ' — ' + detail : '')); console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
};
const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };
const dirs = (p) => { try { return readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return []; } };

const GEN = read('scripts/generate-product-pages.mjs');
const EN_SLUGS = dirs('p');
const FR_SLUGS = new Set(dirs('fr/p'));

/** The generated prose only — NOT the supplier's own garment description.
 *  Four blanks are described by their maker as "ideal for screen printing" or
 *  "a screen print is not recommended". Those are facts about the fabric and
 *  stay verbatim; a check that cannot tell a supplier's description from the
 *  shop's own offer would force us to rewrite the supplier. */
function ownCopy(html) {
  const i = html.indexOf('<section class="copy-section">');
  const j = html.indexOf('</section>', i);
  return i < 0 ? '' : html.slice(i, j);
}
const metaDesc = (html) => (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';

console.log('1. the generator states one turnaround, and it is the owner-confirmed one');
{
  const body = (GEN.match(/bodyP2:\s*\{\s*en:\s*'([^']*)'/) || [])[1] || '';
  ok('1a the generator says the standard is 7-14 business days',
    /Standard turnaround is 7–14 business days/.test(body), body.slice(0, 90));
  ok('1b and that 3-5 is the rush path, not the standard',
    /rush to 3–5 days/.test(body) && !/Standard turnaround is 3/.test(body));
  // The figure it replaced, and the one that came with it. 2-3 days was a
  // rush floor faster than the fastest supplier handling window in this
  // file's own table (3 days), so it could not be met even in principle.
  ok('1c the old 3-5 standard and 2-3 rush are gone from the generator',
    !/3–5 business days from approved/.test(GEN) && !/2–3 days/.test(GEN));
  ok('1d no separate embroidery window that undercuts the standard',
    !/embroidery takes 7–11/.test(GEN),
    'a second figure inside the standard window reads as embroidery being faster');
}

console.log('2. only the methods the shop runs');
{
  ok('2a the generator offers three methods, not four',
    /all three of our methods/.test(GEN) && !/all four of our methods/.test(GEN));
  ok('2b no screen-printing clause left in the generator template',
    !/bodyP1Screen/.test(GEN) && !/sérigraphie/.test(GEN) && !/screen printing/i.test(GEN.replace(/\/\/[^\n]*/g, '')),
    'the template still composes a screen-printing sentence');
}

console.log('3. every generated page agrees, and there are no orphans');
{
  ok('3a there are product pages to check at all', EN_SLUGS.length > 1000, `${EN_SLUGS.length} pages`);

  let badTurn = [], badMethod = [], badMeta = [], noFr = [];
  for (const slug of EN_SLUGS) {
    const html = read(`p/${slug}/index.html`);
    if (!html) continue;
    const copy = ownCopy(html);
    if (!/Standard turnaround is 7–14 business days/.test(copy)) badTurn.push(slug);
    if (/Standard turnaround is 3/.test(copy) || /2–3 days/.test(copy)) badTurn.push(slug);
    if (/all four of our methods/.test(copy) || /<strong>screen printing<\/strong>/.test(copy)) badMethod.push(slug);
    if (/screen printing/i.test(metaDesc(html))) badMeta.push(slug);
    if (!FR_SLUGS.has(slug)) noFr.push(slug);
  }
  ok('3b every page states the 7-14 standard in its own copy',
    badTurn.length === 0, `${badTurn.length} pages, e.g. ${badTurn.slice(0, 3).join(', ')}`);
  ok('3c no page offers screen printing in its own copy',
    badMethod.length === 0, `${badMethod.length} pages, e.g. ${badMethod.slice(0, 3).join(', ')}`);
  ok('3d no page lists screen printing in its meta description',
    badMeta.length === 0, `${badMeta.length} pages, e.g. ${badMeta.slice(0, 3).join(', ')}`);
  ok('3e every EN page has its FR mirror',
    noFr.length === 0, `${noFr.length} missing, e.g. ${noFr.slice(0, 3).join(', ')}`);

  // ORPHANS. A regen writes the current catalogue and silently leaves behind
  // pages for products that no longer exist -- 2,368 of them on 2026-10-05,
  // a third of everything under /p/, still live, still in the sitemap, still
  // carrying the copy and prices of the previous regen. The sitemap is the
  // cheap proxy: if it lists exactly what is on disk, nothing was stranded.
  const sitemap = read('sitemap.xml');
  const listed = new Set([...sitemap.matchAll(/<loc>https:\/\/www\.singhsprint\.com\/p\/([^/]+)\/<\/loc>/g)].map((m) => m[1]));
  const onDiskNotListed = EN_SLUGS.filter((s) => !listed.has(s));
  const listedNotOnDisk = [...listed].filter((s) => !EN_SLUGS.includes(s));
  ok('3f the sitemap lists every page on disk',
    onDiskNotListed.length === 0, `${onDiskNotListed.length} unlisted, e.g. ${onDiskNotListed.slice(0, 3).join(', ')}`);
  ok('3g the sitemap lists nothing that is not on disk',
    listedNotOnDisk.length === 0, `${listedNotOnDisk.length} would 404, e.g. ${listedNotOnDisk.slice(0, 3).join(', ')}`);
}

console.log('4. the invariant the generator claims is enforced');
{
  const table = (GEN.match(/const PUBLISHED_HANDLING = \{([\s\S]*?)\};/) || [])[1] || '';
  const published = {};
  for (const m of table.matchAll(/(\w+):\s*\{\s*min:\s*(\d+),\s*max:\s*(\d+)\s*\}/g)) {
    published[m[1]] = { min: Number(m[2]), max: Number(m[3]) };
  }
  ok('4a the generator still has a per-supplier handling table',
    Object.keys(published).length >= 3, Object.keys(published).join(', '));

  // What the pages actually publish must be a value that table can produce.
  const allowed = new Set([...Object.values(published), { min: 12, max: 15 }].map((h) => `${h.min}-${h.max}`));
  const seen = new Map();
  for (const slug of EN_SLUGS) {
    const m = read(`p/${slug}/index.html`).match(/"handlingTime":\{"@type":"QuantitativeValue","minValue":(\d+),"maxValue":(\d+)/);
    if (m) seen.set(`${m[1]}-${m[2]}`, (seen.get(`${m[1]}-${m[2]}`) || 0) + 1);
  }
  const strays = [...seen.keys()].filter((k) => !allowed.has(k));
  ok('4b every published handlingTime is one the supplier table can produce',
    strays.length === 0,
    `${strays.join(', ')} appear on pages but are not in PUBLISHED_HANDLING (${[...allowed].join(', ')})`);
  // AND THE OTHER DIRECTION, which the first spelling missed. ss_activewear
  // and sanmar both publish 3-10, so a mutation that broke ss_activewear
  // alone still produced a window sanmar explained, and 4b passed. Set
  // membership is not the property; the table and the pages agreeing is.
  // Every supplier entry must be visible on some page -- an entry nothing
  // uses means the table changed and nobody re-ran this generator, which is
  // exactly the state this repo was in from 2026-08-16 to 2026-10-05.
  const unused = Object.entries(published).filter(([, h]) => !seen.has(`${h.min}-${h.max}`)).map(([k]) => k);
  ok('4b2 every supplier in the table is visible on a page, so neither has drifted',
    unused.length === 0,
    `${unused.join(', ')} in PUBLISHED_HANDLING but no page publishes that window — regenerate`);
  // Before the 2026-10-05 regen this failed: all 6,899 pages published 3-5,
  // a window the table has not produced since 7a7d06c71 changed it on
  // 2026-08-16. Seven weeks of a committed fix that nobody had run.
  console.log('      published windows in use: ' + [...seen.entries()].map(([k, v]) => `${k} (${v})`).join(', '));

  // A comment naming a checker is a promise that something runs. For seven
  // weeks this file named one that had never been written, and a reader had
  // no way to tell that from a real one. So: every checker filename the
  // generator names must exist, and it must name the one that does.
  const named = [...GEN.matchAll(/(?:scripts\/)?(check-[a-z0-9-]+\.mjs)/g)].map((m) => m[1]);
  const ghosts = [...new Set(named)].filter((f) => !existsSync('scripts/' + f));
  ok('4c every checker the generator names actually exists',
    ghosts.length === 0, `names ${ghosts.join(', ')}, which does not exist`);
  ok('4d the generator points at the checker that does enforce this',
    named.includes('check-product-page-claims.mjs'),
    'nothing tells a reader of this file what guards it');
}

console.log('5. the sitemap only lists pages that will actually deploy');
{
  // SHIPPED BROKEN ON 2026-10-05. The marketing list in regenerate-sitemap.mjs
  // was expanded to cover the guides, every entry checked against a file ON
  // DISK -- and six of those guide files had never been committed. Vercel
  // builds from git, not from a working tree, so Google was handed 6 EN + 6 FR
  // URLs that 404. "The file exists" was the wrong test; "git will ship it" is
  // the right one. Caught only because the owner questioned the guide count in
  // a summary, which was itself wrong -- it reported 104 matching LINES as
  // though they were entries, when a <url> block contributes about four.
  // HEAD, not the index: .git/index is stale in this repo (commits are built
  // through a temp index because .git/index.lock cannot be removed through the
  // mount), so `git ls-files` reports 14,072 paths against HEAD's 9,430 and
  // would wave through pages that were never committed. The first spelling of
  // 5c used ls-files and failed on two product pages that are in fact fine.
  const tracked = new Set(
    execFileSync('git', ['ls-tree', '-r', 'HEAD', '--name-only', '-z'], { maxBuffer: 1 << 28 })
      .toString('utf8').split('\0').filter(Boolean));
  const sm = read('sitemap.xml');
  const locs = [...sm.matchAll(/<loc>https:\/\/www\.singhsprint\.com(\/[^<]*)<\/loc>/g)].map((m) => m[1]);
  ok('5a the sitemap has marketing URLs to check', locs.length > 100, `${locs.length} urls`);

  const candidates = (u) => {
    const rel = u.replace(/^\/+/, '').replace(/\/+$/, '');
    if (rel === '') return ['index.html'];
    if (rel === 'fr') return ['fr/index.html'];
    return [rel + '.html', rel + '/index.html'];
  };
  const marketing = locs.filter((u) => !u.startsWith('/p/') && !u.startsWith('/fr/p/'));
  const dead = marketing.filter((u) => !candidates(u).some((c) => tracked.has(c)));
  ok('5b every non-product URL maps to a file git will deploy',
    dead.length === 0, `${dead.length} would 404: ${dead.slice(0, 6).join(', ')}`);

  // Product pages are covered by 3f/3g against the directory listing, but they
  // must be committed too -- the same regen that writes them can leave them
  // untracked if .gitignore ever grows a /p rule.
  //
  // ALL of them, not a sample. The first spelling checked the first 50 and a
  // mutation pointing a late-alphabet slug at a page that was never committed
  // walked straight past it. 4,592 set lookups cost nothing; a sampled
  // assertion that passes on a broken sitemap costs a lot.
  const productLocs = locs.filter((u) => u.startsWith('/p/') || u.startsWith('/fr/p/'));
  const deadProducts = productLocs.filter((u) => !tracked.has(u.replace(/^\//, '').replace(/\/$/, '') + '/index.html'));
  ok('5c every product URL is committed, not just present on disk',
    deadProducts.length === 0,
    `${deadProducts.length} of ${productLocs.length} untracked, e.g. ${deadProducts.slice(0, 3).join(', ')}`);

  // Both halves of an hreflang pair, or neither. Seven of the twelve dead URLs
  // were French: the English guide was committed and its mirror was not.
  const en = new Set(marketing.filter((u) => !u.startsWith('/fr')));
  const fr = new Set(marketing.filter((u) => u.startsWith('/fr')).map((u) => u.replace(/^\/fr/, '') || '/'));
  const lonely = [...en].filter((u) => !fr.has(u)).concat([...fr].filter((u) => !en.has(u)));
  ok('5d every listed page is listed in both languages',
    lonely.length === 0, `unpaired: ${lonely.slice(0, 6).join(', ')}`);
}

console.log('');
console.log(`${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach((f) => console.log(' - ' + f)); process.exit(1); }
