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

// The six, stated here rather than derived from the file, so the checker
// fails loudly if one is dropped or quietly respelled.
//
// Checked against the OS on 2026-10-05 (companies rollup + /api/companies?q=).
// Two were wrong as first committed and stay corrected here: "Place de Verre"
// is not a client (the client was PLACE TEVERE — 3 orders, $2,138.54), and
// "Lamborghini Montreal" is "Lamborghini Montréal".
//
// FOUR OF THESE FIVE CARRY NO ORDER RECORD, and that is a decision, not an
// oversight. ALDO has nothing in the CRM at all; neither do Cardinal Brewery
// or Île Perrot Yacht Club. There is no McGill institutional row, only
// Animal Science at $1,571 and the clubs. Lamborghini Montréal's only row
// came from a prospecting import, created in a batch with Aston Martin
// Montréal, Audi Anjou, BMW Canbec, BMW Laval and Bentley Montréal — two
// people's names in one field, no email, no phone, no message history.
// Silk Laundry ($1,178, one order) is the only one the database can vouch
// for.
//
// The owner has confirmed all five as genuine clients whose work predates or
// bypassed the CRM. Written down here because a future reader will otherwise
// re-derive this list from the orders table and be left with one name.
//
// The clients that ARE evidenced — Artwood Construction $4,568/2, Cafe
// GotSoul $2,723/2, Evershield RV Roofs $2,149/2, Place Tevere $2,139/3,
// Petinos $547/1 — were on the strip as a second row for one commit and were
// cut as less recognisable. They sit directly below the cut in
// portfolio_clients, one sort_index change from the page.
const SHOWN = [
  'Lamborghini Montréal', 'ALDO', 'McGill University', 'Silk Laundry', 'C4 Energy',
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

console.log('1. six names, and nothing that reads as a complete list');
{
  const shown = names(ulBody(EN, 'trust-clients__hero'));
  const missing = SHOWN.filter((n) => !shown.includes(n));
  ok('1a all six clients are on the strip', missing.length === 0, missing.join(', '));
  ok('1b the strip holds those ten and nothing else',
    shown.length === SHOWN.length, `${shown.length} names`);
  // The forced row break went with the second row. Its leftovers would be
  // invisible — a zero-height flex item renders as nothing — so assert it is
  // actually gone rather than trusting the eye.
  ok('1b2 no leftover row-break element or styling',
    !/trust-clients__brk/.test(EN) && !/ROW_ONE/.test(EN),
    'the forced row break survives the second row it existed for');

  // The long list is the thing being removed, not restyled. A list of 31
  // reads as THE list — it caps the impression at whatever is printed, when
  // the shop has printed for more businesses than fit on a home page.
  ok('1c the long roster rows are gone, not just hidden',
    !/trust-clients__lead/.test(EN) && !/trust-clients__rest/.test(EN)
    && !/trust-logo/.test(EN),
    'an old tier row is still in the markup');
  ok('1d the French mirror shows the same six',
    (() => { const f = names(ulBody(FR, 'trust-clients__hero'));
      return SHOWN.every((n) => f.includes(n)) && f.length === SHOWN.length; })(),
    `fr has ${names(ulBody(FR, 'trust-clients__hero')).length}`);

  // NO NUMBER ANYWHERE ON THE STRIP. A draft carried "a few of the 45+
  // businesses we print for" — true, measured, and the wrong instinct: a firm
  // that counts its clients is telling you it can count them, and the count
  // caps the impression at whatever is printed. This asserts the strip makes
  // no quantitative claim at all, which is also why there is nothing here
  // that can go stale, as the review count did for four months.
  // The COPY, not the names. "C4 Energy" is a client's own name and the
  // first version of this test flagged its digit — a check that cannot tell
  // a brand from a claim is not checking the claim.
  const stripHtml = EN.slice(EN.indexOf('<section class="trust-bar">'),
                             EN.indexOf('===== BROWSE PRODUCTS'));
  const copyOnly = stripHtml
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<ul[\s\S]*?<\/ul>/g, ' ')   // the client names are not a claim
    .replace(/<[^>]+>/g, ' ');
  ok('1e the strip\'s own copy makes no numeric claim',
    !/\d/.test(copyOnly), `found "${(copyOnly.match(/[^\s]*\d[^\s]*/) || [''])[0]}"`);
  const more = (EN.match(/<p class="trust-clients__more">([\s\S]*?)<\/p>/) || [])[1] || '';
  ok('1f a link out to the work follows the names',
    /<a href="portfolio"/.test(more), 'no link under the names');
  ok('1g that link is translated, not hardcoded English',
    /data-i18n="home\.trust\.seework"/.test(more) && /'home\.trust\.seework'/.test(LANG));

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
    ['2b', '.trust-clients__hero li', 'the client names'],
    ['2c', '.trust-clients__more a', 'the link under the names'],
    ['2d', '.trust-bar p.trust-label', 'the section label'],
  ]) {
    const c = colourOf(sel);
    const r = c ? ratio(c, '#ffffff') : 0;
    ok(`${id} ${label} clear WCAG AA on white`,
      c !== null && r >= 4.5,
      c ? `${c} = ${r.toFixed(2)}:1, needs 4.50:1` : 'no colour declared for ' + sel);
  }
}

console.log('2e the brand yellow is decoration, never text');
{
  // #e8ff3c on white measures about 1.2:1. It is a fine dot, rule or
  // underline, and an unreadable word.
  //
  // SCOPED TO THE CLIENT STRIP'S OWN RULES. The first version of this test
  // scanned the whole file and failed on nine legitimate uses — the reviews
  // section sets the accent as a text colour on a near-black background,
  // where it measures about 17:1. A contrast rule that ignores the
  // background is not a contrast rule.
  const stripCss = EN.slice(EN.indexOf('/* ===== CLIENTS'), EN.indexOf('/* ===== PRODUCT BROWSE'));
  const asText = [...stripCss.matchAll(/(^|[;{\s])color:\s*#e8ff3c/gi)];
  ok('2e the accent is never a text colour on the strip, which is white',
    asText.length === 0, `${asText.length} color:#e8ff3c declarations in the strip`);
  // And it IS present, in BOTH places it is meant to be. "is the colour
  // mentioned anywhere in this block" was the first spelling, and a mutant
  // that greyed out the dots passed it on the strength of the link underline
  // alone — one of the two uses can disappear without the test noticing.
  ok('2f the accent marks the separators between names',
    /li::after\{[^}]*background:#e8ff3c/i.test(stripCss),
    'the dots between the names are not the brand colour');
  ok('2g the accent underlines the link',
    /__more a\{[^}]*border-bottom:[^;]*#e8ff3c/i.test(stripCss),
    'the link is not underlined in the brand colour');

  // A dot between names is drawn with ::after and dropped on :last-child.
  // That is right only while the row does NOT wrap — a wrapped row leaves a
  // dot dangling off the end of every line but the last, which shipped
  // visibly at 1000px before the container was widened. So at every
  // breakpoint where the names are meant to wrap, the dot must be off.
  //
  // Resolved through the cascade, not read block by block. max-width:760
  // still matches at 540, so a rule turning the dot off at 760 governs 540
  // as well; an earlier spelling of this demanded it be restated in each
  // block and failed on correct CSS. What has to be true is that from the
  // first wrapping breakpoint onward, nothing turns the dot back on.
  let dotOffFrom = null, dotBackOn = null;
  for (const w of [760, 540]) {
    const at = stripCss.indexOf(`@media (max-width:${w}px)`);
    if (at < 0) continue;
    const css = stripCss.slice(at, stripCss.indexOf('}\n    }', at) + 7);
    if (/li::after\{display:none\}/.test(css) && dotOffFrom === null) dotOffFrom = w;
    else if (dotOffFrom !== null && /li::after\{(?!display:none)/.test(css)) dotBackOn = w;
  }
  ok('2h the separator dot is off from the first wrapping breakpoint on',
    dotOffFrom !== null && dotBackOn === null,
    dotOffFrom === null ? 'never turned off' : `turned back on at ${dotBackOn}px`);
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

console.log('5. the CRM can repoint the six, and the claim stays put');
{
  const scriptAll = EN.slice(EN.indexOf('CRM-managed'));
  const cStart = scriptAll.indexOf('Client strip —');
  const script = scriptAll.slice(cStart, scriptAll.indexOf('mini-gallery', cStart));
  const shownCount = Number((script.match(/var SHOWN_COUNT = (\d+);/) || [])[1]);

  ok('5a the row is resolved before it is written',
    /var row = document\.querySelector\('\.trust-clients__hero'\)/.test(script)
    && /if \(!row\) return;/.test(script)
    && /\brow\.innerHTML\s*=/.test(script));
  ok('5b the slice comes off SHOWN_COUNT, not an inline number',
    /cs\.slice\(0, SHOWN_COUNT\)/.test(script));

  ok('5c the committed fallback and the script agree on how many show',
    shownCount === SHOWN.length,
    `SHOWN_COUNT=${shownCount}, markup has ${SHOWN.length}`);

  // The count line is a fact about the shop, not about the CMS. Rendering it
  // from cs.length would make it drift to however many rows are published and
  // start understating the moment the table was tidied.
  // ONE innerHTML write, to the names row. The earlier spelling of this also
  // banned `cs.length` anywhere in the script, which the empty-response guard
  // `if (!Array.isArray(cs) || !cs.length) return;` legitimately contains —
  // so it failed on correct code. What actually matters is that the count
  // line is never selected and never written.
  ok('5d the rebuild never rewrites the count line',
    !/trust-clients__more/.test(script)
    && (script.match(/\.innerHTML\s*=/g) || []).length === 1,
    'the script writes somewhere other than the names row');

  ok('5e an empty or failed CRM response keeps the committed names',
    /if \(!Array\.isArray\(cs\) \|\| !cs\.length\) return;/.test(script)
    && (() => { const c = (script.match(/\.catch\(function \(\) \{([\s\S]*?)\}\)/) || [])[1];
      return c !== undefined && !/=|throw/.test(c); })(),
    'a failed fetch does not fall back cleanly');
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
