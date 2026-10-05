/**
 * check-home-client-proof — the home page leads with clients, not a count.
 *
 * WHAT CHANGED AND WHY
 * --------------------
 * The page used to carry the Google review count in three visible places and
 * the client names in one — an auto-scrolling ticker, 18 names at #ccc, every
 * one the same size. Measured on 2026-10-05, that was the weakest arrangement
 * available:
 *
 *   - the count was last synced 2026-06-11 and could not self-correct:
 *     /api/google-reviews was never allowlisted in the CRM middleware, so the
 *     runtime patcher got a 307 to /login and took its silent `return null`
 *     path. Four months stale with a repair mechanism that had never run.
 *   - nine of the ten strongest clients were not on the site at all.
 *   - #ccc on #fff is 1.61:1. The names were barely readable, and moving.
 *
 * So: ten named clients in large dark type, the rest kept smaller, and the
 * review count demoted to the one place it has supporting evidence — beside
 * the three named quotes in the reviews section.
 *
 * Section 2 COMPUTES the contrast ratios rather than eyeballing the hex. That
 * is not ceremony: the first draft of this block used #9a9a9a and #999, which
 * measure 2.81:1 and 2.85:1 — prettier than what shipped, and still failing
 * the thing the change was partly meant to fix.
 *
 * Run: node scripts/check-home-client-proof.mjs
 */
import { readFileSync } from 'node:fs';

let pass = 0;
const fails = [];
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fails.push(name + (detail ? ' — ' + detail : '')); console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
};
const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };

const EN = read('index.html');
const FR = read('fr/index.html');
const LANG = read('lang.js');

// The names that carry the page, stated here rather than derived from the
// file, so the checker fails loudly if one is dropped or quietly respelled.
//
// Every one of these was checked against the OS on 2026-10-05 (companies
// rollup + /api/companies?q=). Two were wrong as first committed and are
// corrected here:
//   - 'Place de Verre' does not exist. 'Place Tevere' does: 3 orders,
//     $2,138.54, $1,103.76 still open.
//   - 'Lamborghini Montreal' is 'Lamborghini Montréal' in the CRM.
// Four names have no OS record at all (ALDO, Cardinal Brewery, Île Perrot
// Yacht Club, and McGill as an institution rather than its clubs) and one has
// a company row with zero orders (Lamborghini Montréal). They are the owner's
// clients and he has confirmed them; the OS simply predates or missed the
// work. Recorded here because a future reader will otherwise re-derive this
// list from the database and quietly drop five of them.
const HERO = [
  'Lamborghini Montréal', 'ALDO', 'McGill University', 'Silk Laundry',
  'C4 Energy',
];
const LEAD = [
  'Artwood Construction', 'Place Tevere', 'Cafe GotSoul', 'Cardinal Brewery',
  'Evershield RV Roofs', 'Petinos', 'Asgard', 'Pizza Rosie',
  'Île Perrot Yacht Club',
];

/** Inner HTML of one <ul class="..."> by class, or '' if absent. */
function ulBody(html, cls) {
  const open = html.indexOf('<ul class="' + cls + '"');
  if (open < 0) return '';
  const gt = html.indexOf('>', open);
  const close = html.indexOf('</ul>', gt);
  return close < 0 ? '' : html.slice(gt + 1, close);
}
const names = (body) => [...body.matchAll(/<li>([^<]+)<\/li>/g)].map((m) => m[1].trim());

/** Everything outside <script> and <style>, i.e. what a reader actually sees.
 *  JSON-LD keeps its reviewCount for rich results; this is about the copy. */
function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}

console.log('1. clients lead, in the right tier');
{
  const hero = names(ulBody(EN, 'trust-clients__hero'));
  const lead = names(ulBody(EN, 'trust-clients__lead'));
  const rest = names(ulBody(EN, 'trust-clients__rest'));

  const heroMissing = HERO.filter((n) => !hero.includes(n));
  ok('1a every hero client is on the hero line', heroMissing.length === 0, heroMissing.join(', '));
  ok('1b the hero line holds nothing else', hero.length === HERO.length, `${hero.length} names`);
  const leadMissing = LEAD.filter((n) => !lead.includes(n));
  ok('1c every lead client is in the lead row', leadMissing.length === 0, leadMissing.join(', '));
  ok('1d the lead row holds nothing else', lead.length === LEAD.length, `${lead.length} names`);
  ok('1e the small row still carries the remaining clients', rest.length >= 10, `${rest.length} names`);

  // Duplication across tiers is the specific failure the rebuild script's
  // comment warns about: one name printed twice at two sizes reads as a
  // styling bug, not as the partial write it would be.
  const all = [...hero, ...lead, ...rest];
  const dupes = all.filter((n, i) => all.indexOf(n) !== i);
  ok('1f no client appears in more than one tier', dupes.length === 0, [...new Set(dupes)].join(', '));

  const frHero = names(ulBody(FR, 'trust-clients__hero'));
  const frLead = names(ulBody(FR, 'trust-clients__lead'));
  ok('1g the French mirror shows the same hero line and lead row',
    HERO.every((n) => frHero.includes(n)) && frHero.length === HERO.length
    && LEAD.every((n) => frLead.includes(n)) && frLead.length === LEAD.length,
    `fr hero ${frHero.length}, fr lead ${frLead.length}`);

  // Place de Verre was on the page for one commit. It is not a client; the
  // client is Place Tevere. Named explicitly so a revert cannot restore it
  // quietly, in either language.
  ok('1h the name that turned out not to be a client is gone',
    !/Place de Verre/i.test(EN) && !/Place de Verre/i.test(FR));
}

console.log('2. readable — ratios computed, not assumed');
{
  const relLum = (hex) => {
    let h = hex.replace('#', '');
    if (h.length === 3) h = [...h].map((c) => c + c).join('');
    const chan = [0, 1, 2].map((i) => {
      const c = parseInt(h.slice(i * 2, i * 2 + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
  };
  const ratio = (a, b) => {
    const [x, y] = [relLum(a), relLum(b)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };

  // A ratio function that always returned a big number would pass every
  // assertion below. Pin it against the colour this change removed.
  const oldGrey = ratio('#ccc', '#ffffff');
  ok('2a the ratio maths has teeth — the old #ccc still measures as failing',
    oldGrey > 1.5 && oldGrey < 2.0, `#ccc measured ${oldGrey.toFixed(2)}:1`);

  const colourOf = (selector) => {
    const re = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{[^}]*?color:\\s*(#[0-9a-fA-F]{3,6})');
    const m = EN.match(re);
    return m ? m[1] : null;
  };
  for (const [id, sel, label] of [
    ['2b', '.trust-clients__hero li', 'the hero line'],
    ['2c', '.trust-clients__lead li', 'the lead row'],
    ['2d', '.trust-clients__rest li', 'the small row'],
    ['2e', '.trust-bar p', 'the section label'],
  ]) {
    const c = colourOf(sel);
    const r = c ? ratio(c, '#ffffff') : 0;
    ok(`${id} ${label} clear WCAG AA on white`,
      c !== null && r >= 4.5,
      c ? `${c} = ${r.toFixed(2)}:1, needs 4.50:1` : 'no colour declared for ' + sel);
  }
}

console.log('2f the tiers are actually a hierarchy');
{
  const sizeOf = (sel) => {
    const m = EN.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{[^}]*?font-size:\\s*([\\d.]+)rem'));
    return m ? Number(m[1]) : null;
  };
  const [h, l, r] = ['.trust-clients__hero li', '.trust-clients__lead li', '.trust-clients__rest li'].map(sizeOf);
  // Three tiers that render at the same size are three tiers in the markup
  // and one flat list on the screen — which is the thing this replaced.
  ok('2f hero > lead > rest, by type size',
    h !== null && l !== null && r !== null && h > l && l > r,
    `hero ${h}rem, lead ${l}rem, rest ${r}rem`);
}

console.log('3. nothing moves');
{
  ok('3a the marquee keyframes are gone', !/@keyframes\s+trust-marquee/.test(EN));
  ok('3b no animation on the client rows',
    !/\.trust-(clients|bar)[^{]*\{[^}]*animation/.test(EN));
  ok('3c no orphaned ticker selectors or markup left behind',
    !/trust-logo/.test(EN) && !/trust-logo/.test(FR),
    'trust-logo* still referenced');
}

console.log('4. the review count appears once, where the quotes are');
{
  const vis = visibleText(EN);
  const claims = [...vis.matchAll(/\(\d+\s+reviews?\)|\d+\s+Google\s+reviews/gi)].map((m) => m[0]);
  ok('4a exactly one visible review-count claim on the page',
    claims.length === 1, `${claims.length}: ${claims.join(' | ')}`);
  // It has to be the one next to the three named quotes, not a stray.
  const revSection = EN.slice(EN.indexOf('reviews-section'), EN.indexOf('HOW IT WORKS'));
  ok('4b the surviving claim sits in the reviews section',
    /\(\d+ reviews\)/.test(visibleText(revSection)));
  ok('4c the hero line no longer carries a rating',
    !/\d(?:\.\d)?★/.test(visibleText(EN.slice(EN.indexOf('hero-proof'), EN.indexOf('hero-visual')))));
  const proofBar = EN.slice(EN.indexOf('class="proof-stats"'), EN.indexOf('</section>', EN.indexOf('class="proof-stats"')));
  ok('4d the proof bar no longer carries a rating stat',
    !/review/i.test(proofBar), 'proof bar still mentions reviews');
  ok('4e the three named quotes are still there',
    (EN.match(/class="review-author"/g) || []).length === 3);
}

console.log('5. the CRM can repoint the strip, and cannot half-apply it');
{
  // Narrowed to the CLIENT-STRIP fetch, not the whole inline block. The
  // "Recent Work" fetch below it has a byte-identical
  // `.catch(function () { /* keep hardcoded fallback */ });`, so a mutant
  // that broke the client strip's catch was matched by its neighbour's and
  // 5e passed on a page that would have blanked the client row on a failed
  // fetch.
  const scriptAll = EN.slice(EN.indexOf('CRM-managed'));
  // 'Client strip —' to the NEXT 'mini-gallery' is exactly the client fetch.
  // Both end anchors tried before this one also appear in the block's own
  // header comment, which sits ABOVE the client fetch — so an unanchored
  // search found them first, the slice came back nearly empty, and every
  // section-5 assertion failed at once. Hence the explicit start offset.
  const cStart = scriptAll.indexOf('Client strip —');
  const script = scriptAll.slice(cStart, scriptAll.indexOf('mini-gallery', cStart));
  const heroCount = Number((script.match(/var HERO_COUNT = (\d+);/) || [])[1]);
  const leadCount = Number((script.match(/var LEAD_COUNT = (\d+);/) || [])[1]);
  // Resolving both and then writing only one is the half-apply this guards.
  // The first version of this assertion checked only that the two
  // querySelectors and the guard existed, and a mutant that deleted the
  // `rest.innerHTML =` line passed it — every promoted client would then
  // print twice, once from the CRM and once from the untouched fallback row.
  ok('5a all three tiers are resolved, and all three are written',
    /var hero = document\.querySelector\('\.trust-clients__hero'\)/.test(script)
    && /var lead = document\.querySelector\('\.trust-clients__lead'\)/.test(script)
    && /var rest = document\.querySelector\('\.trust-clients__rest'\)/.test(script)
    && /if \(!hero \|\| !lead \|\| !rest\) return;/.test(script)
    && /\bhero\.innerHTML\s*=/.test(script)
    && /\blead\.innerHTML\s*=/.test(script)
    && /\brest\.innerHTML\s*=/.test(script),
    'the rebuild can write one tier and leave another hardcoded');
  // Every cut comes off the two constants. A literal written inline anywhere
  // here is how the tiers would silently start overlapping or skipping a
  // client — and an overlap prints a name twice while a gap drops one.
  ok('5b the slices come off HERO_COUNT and LEAD_COUNT, not inline numbers',
    /cs\.slice\(0, HERO_COUNT\)/.test(script)
    && /cs\.slice\(HERO_COUNT, LEAD_COUNT\)/.test(script)
    && /cs\.slice\(LEAD_COUNT\)/.test(script));
  ok('5c the committed fallback and the script agree on both tier sizes',
    heroCount === HERO.length && leadCount === HERO.length + LEAD.length,
    `HERO_COUNT=${heroCount} (markup ${HERO.length}), LEAD_COUNT=${leadCount} (markup ${HERO.length + LEAD.length})`);
  // LEAD_COUNT is cumulative. If it were ever set below HERO_COUNT the middle
  // slice would come back empty and the lead row would vanish silently.
  ok('5d LEAD_COUNT is cumulative and above HERO_COUNT',
    Number.isFinite(heroCount) && Number.isFinite(leadCount) && leadCount > heroCount,
    `HERO_COUNT=${heroCount}, LEAD_COUNT=${leadCount}`);
  ok('5e an empty row is hidden, not left holding its margin',
    /lead\.hidden = mid\.length === 0/.test(script)
    && /rest\.hidden = tail\.length === 0/.test(script));
  // A catch that writes anything is not a fallback. Assert the body holds no
  // assignment, rather than that one specific comment string is present.
  const catchBody = (script.match(/\.catch\(function \(\) \{([\s\S]*?)\}\)/) || [])[1];
  ok('5f an empty or failed CRM response keeps the committed names',
    /if \(!Array\.isArray\(cs\) \|\| !cs\.length\) return;/.test(script)
    && catchBody !== undefined && !/=|throw/.test(catchBody),
    catchBody === undefined ? 'no catch on the client fetch' : 'the catch body does something: ' + catchBody.trim());
}

console.log('6. the retired i18n keys are gone, not just unused');
{
  for (const k of ['home.heroproof.rating', 'home.proof.rating-num', 'home.proof.rating']) {
    ok(`6-${k} is undefined and unreferenced`,
      !LANG.includes(`'${k}'`) && !EN.includes(k) && !FR.includes(k));
  }
}

console.log('');
console.log(`${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach((f) => console.log(' - ' + f)); process.exit(1); }
