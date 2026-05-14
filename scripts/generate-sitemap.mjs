#!/usr/bin/env node
/**
 * generate-sitemap.mjs
 * Builds sitemap.xml from a hardcoded list of canonical paths PLUS
 * every product page in /p/ and every FR mirror under /fr/. Run after
 * generate-product-pages and generate-fr-mirror.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const SITE = 'https://www.singhsprint.com';
const TODAY = new Date().toISOString().slice(0, 10);

// Core EN pages with their priorities.
const CORE = [
  ['/',                                                 1.0,  'weekly'],
  ['/quote',                                            0.9,  'weekly'],
  ['/catalog',                                          0.95, 'daily'],
  ['/businesses',                                       0.9,  'weekly'],
  ['/businesses/rfp',                                   0.8,  'monthly'],
  ['/portfolio',                                        0.7,  'monthly'],
  ['/inkwear',                                          0.7,  'monthly'],
  ['/about',                                            0.6,  'monthly'],
  ['/industries/construction-workwear',                 0.9,  'monthly'],
  ['/industries/restaurant-hospitality-uniforms',       0.9,  'monthly'],
  ['/industries/corporate-tech-swag',                   0.9,  'monthly'],
  ['/industries/charity-events-fundraisers',            0.9,  'monthly'],
  ['/industries/schools-sports-teams',                  0.9,  'monthly'],
  ['/guides/decoration-method-durability',              0.8,  'monthly'],
  ['/guides/procurement-checklist',                     0.8,  'monthly'],
  ['/guides/charity-run-timeline',                      0.8,  'monthly'],
  ['/guides/construction-crew-cost',                    0.8,  'monthly'],
];

async function listProductSlugs() {
  try {
    const entries = await fs.readdir(path.join(ROOT, 'p'), { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => '/p/' + e.name + '/');
  } catch { return []; }
}

function entry(loc, prio, freq, opts = {}) {
  const enUrl = SITE + loc;
  const frUrl = SITE + '/fr' + loc;
  // The xhtml:link rels tell Google about the other-language version of
  // this URL. For pages without a French sibling (the /p/ product pages
  // today — template is hardcoded EN) we omit the FR alternate so Google
  // doesn't get told about a URL we don't serve.
  const langLinks = opts.frExists !== false
    ? `
    <xhtml:link rel="alternate" hreflang="en" href="${enUrl}"/>
    <xhtml:link rel="alternate" hreflang="fr" href="${frUrl}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${enUrl}"/>`
    : '';
  return `  <url>
    <loc>${opts.isFr ? frUrl : enUrl}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${freq}</changefreq>
    <priority>${prio}</priority>${langLinks}
  </url>`;
}

(async () => {
  const productPaths = await listProductSlugs();
  // Product pages NOW have FR siblings at /fr/p/<slug>/ (bilingual generator).
  const productEntries = productPaths.map(p => [p, 0.7, 'weekly', { frExists: true }]);
  const corePagesWithFr = CORE.map(([loc, prio, freq]) => [loc, prio, freq, { frExists: true }]);

  const urls = [];
  // EN core (with FR alternates declared)
  for (const [loc, prio, freq, opts] of corePagesWithFr) urls.push(entry(loc, prio, freq, opts));
  // FR core mirrors (loc points at /fr/, alternates declared the same way)
  for (const [loc, prio, freq, opts] of corePagesWithFr) urls.push(entry(loc, prio, freq, { ...opts, isFr: true }));
  // EN product pages (with FR alternates)
  for (const [loc, prio, freq, opts] of productEntries) urls.push(entry(loc, prio, freq, opts));
  // FR product pages
  for (const [loc, prio, freq, opts] of productEntries) urls.push(entry(loc, prio, freq, { ...opts, isFr: true }));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml">

${urls.join('\n\n')}

</urlset>
`;
  await fs.writeFile(path.join(ROOT, 'sitemap.xml'), xml, 'utf8');
  console.log(`wrote sitemap.xml — ${urls.length} URLs (${corePagesWithFr.length} EN core + ${corePagesWithFr.length} FR core + ${productEntries.length} product)`);
})();
