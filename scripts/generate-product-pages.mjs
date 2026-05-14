#!/usr/bin/env node
/**
 * generate-product-pages.mjs
 * ---------------------------------------------------------------
 * Reads the live catalog API and writes static, SEO-optimised
 * product pages to /singhsprint-site/p/<brand>-<style>/index.html.
 * Each page carries a full Product JSON-LD entity, hreflang
 * alternates, dedicated meta tags, and a single canonical URL —
 * so Google can index 25 individual blanks instead of just one
 * /catalog page.
 *
 * Run locally before deploy:
 *   node scripts/generate-product-pages.mjs
 *
 * Knobs:
 *   TOP_N      how many products to generate (default 25)
 *   API_URL    override the catalog endpoint
 *
 * Safe to re-run — overwrites existing files. Commit the generated
 * /p/ folder alongside other source so static hosting picks them up.
 */

import fs   from 'node:fs/promises';
import path from 'node:path';

const ROOT      = path.resolve(new URL('.', import.meta.url).pathname, '..');
const OUT_DIR   = path.join(ROOT, 'p');
const API_URL   = process.env.API_URL || 'https://singhsprint-crm.vercel.app/api/catalog?limit=500';
const IMG_PROXY = 'https://singhsprint-crm.vercel.app/api/image-proxy';
const SITE      = 'https://www.singhsprint.com';
const TOP_N     = parseInt(process.env.TOP_N || '25', 10);

function imgUrl(raw) {
  if (!raw) return SITE + '/images/product-tshirt-white.jpg';
  if (raw.startsWith('/') || raw.includes('singhsprint.com')) return raw;
  if (raw.includes('ssactivewear.com')) return IMG_PROXY + '?url=' + encodeURIComponent(raw);
  return raw;
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Roughly score how "promotable" a product is so we surface the
// versatile, well-stocked items first when picking the top N.
function score(p) {
  let s = 0;
  if (p.in_stock !== false) s += 10;
  if (p.bestseller) s += 30;
  s += Math.min(20, (p.color_count || 0));
  if (p.price_from && p.price_from < 25) s += 8;      // bias to mass-market price-points
  if (p.garment_type === 'tshirt') s += 10;
  if (p.garment_type === 'hoodie') s += 8;
  if (p.garment_type === 'crewneck') s += 6;
  if (p.garment_type === 'hat') s += 5;
  if (p.garment_type === 'longsleeve') s += 5;
  if (p.garment_type === 'polo') s += 4;
  return s;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

// Garment-type "From $X" floor used when the live engine can't produce a
// price for a product (no wholesale_price stored, mostly older Rue Saint-
// Patrick + Adidas catalog rows). Mirrors the JSON-LD `makesOffer` block
// in components.js and the homepage calculator tiers so the whole site
// quotes the same starting numbers.
const GARMENT_FLOOR = {
  tshirt:            9.95,
  longsleeve:        13.95,
  polo:              19.95,
  performance_shirt: 14.95,
  workshirt:         16.95,
  hivis:             18.95,
  hoodie:            24.95,
  crewneck:          22.95,
  sweater:           28.95,
  cardigan:          32.95,
  pullover_jacket:   34.95,
  softshell:         44.95,
  chore_coat:        49.95,
  vest:              22.95,
  coverall:          59.95,
  hat:               15.95,
  tote:              12.95,
  joggers:           26.95,
  shorts:            18.95,
  chef_coat:         28.95,
  scrub_top:         18.95,
  scrub_pants:       18.95,
  lab_coat:          26.95,
  apron:             14.95,
  other:             14.95
};

// A small weight-aware bump so a Champion-grade premium tee doesn't show
// the same floor as a Gildan basic. We never bump BELOW the floor, only
// upward, so the customer can never be quoted less than what we'd
// actually run at smallest qty.
function floorFor(p) {
  const base = GARMENT_FLOOR[p.garment_type] || GARMENT_FLOOR.other;
  const w = Number(p.weight_oz) || 0;
  let bump = 0;
  if (w >= 7 && w < 9)        bump = 2;
  else if (w >= 9 && w < 11)  bump = 4;
  else if (w >= 11)           bump = 6;
  // .95 the result for consistency with the rest of the site's pricing.
  const total = base + bump;
  const ones = Math.floor(total);
  return Number((ones + 0.95).toFixed(2));
}

// Resolve a price for the page: the live engine first, else garment floor.
function resolvedPrice(p) {
  if (typeof p.price_from === 'number' && p.price_from > 0) return p.price_from;
  return floorFor(p);
}

function buildPage(p) {
  const brand = (p.brand || '').trim();
  const style = (p.style_number || '').trim();
  const name  = (p.name || '').trim();
  const slug  = slugify(brand + '-' + style);
  const url   = `${SITE}/p/${slug}/`;
  const heroColor = (p.colors || []).find(c => Array.isArray(c.sizes_in_stock) && c.sizes_in_stock.length) || (p.colors || [])[0] || {};
  const hero  = imgUrl(heroColor.mockup_front_url || p.hero_image_url || '');

  const priceFrom = resolvedPrice(p);
  const usingFloor = !(typeof p.price_from === 'number' && p.price_from > 0);
  const title = `${brand} ${style} ${name} — Custom Printing in Montreal · Singhs Print`;
  const meta  = `Custom printed ${brand} ${style} ${name} in Montreal. DTG, DTF, embroidery and screen printing from $${priceFrom.toFixed(2)}/unit. Sainte-Anne-de-Bellevue studio, Net-30 for repeat accounts. Get a quote in 1 hour.`;

  // Variant offers per color — drives "Available in N colours" rich-result variants
  const colors = (p.colors || []).slice(0, 24);
  const offers = {
    '@type': 'AggregateOffer',
    'lowPrice': priceFrom.toFixed(2),
    'highPrice': (priceFrom + 20).toFixed(2),
    'priceCurrency': 'CAD',
    'offerCount': colors.length || 1,
    'availability': p.in_stock === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
    'seller': { '@id': SITE + '/#business' }
  };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        '@id': url + '#product',
        'name': `${brand} ${style} ${name}`,
        'sku': style || p.product_id,
        'mpn': style || undefined,
        'brand': { '@type': 'Brand', 'name': brand },
        'description': (p.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600) || meta,
        'image': [hero],
        'category': p.garment_type || 'Custom Apparel',
        'url': url,
        'offers': offers,
        'isRelatedTo': { '@id': SITE + '/#business' }
      },
      {
        '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': SITE + '/' },
          { '@type': 'ListItem', 'position': 2, 'name': 'Catalog', 'item': SITE + '/catalog' },
          { '@type': 'ListItem', 'position': 3, 'name': `${brand} ${style}`, 'item': url }
        ]
      }
    ]
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="apple-touch-icon" href="/favicon-180.png">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(meta)}">
  <link rel="canonical" href="${url}">
  <link rel="alternate" hreflang="en" href="${url}">
  <link rel="alternate" hreflang="fr" href="${url.replace(SITE, SITE + '/fr')}">
  <link rel="alternate" hreflang="x-default" href="${url}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap" rel="stylesheet">
  <meta property="og:type" content="product">
  <meta property="og:title" content="${escapeHtml(brand + ' ' + style + ' · Singhs Print Montreal')}">
  <meta property="og:description" content="${escapeHtml(meta)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${hero}">
  <meta property="og:site_name" content="Singhs Print">
  <meta property="og:locale" content="en_CA">
  <meta property="og:locale:alternate" content="fr_CA">
  <meta name="theme-color" content="#1a1a1a">
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',-apple-system,sans-serif;color:#1a1a1a;background:#fafaf7;line-height:1.6;-webkit-font-smoothing:antialiased}
    a{text-decoration:none;color:inherit}
    h1,h2,h3{font-family:'Playfair Display',Georgia,serif;font-weight:800;line-height:1.18}
    .container{max-width:1100px;margin:0 auto;padding:0 24px}
    .promo-bar{background:#e8ff3c;text-align:center;padding:10px 24px;font-weight:600;font-size:.9rem}
    .product-hero{padding:48px 0 56px;background:#fff;border-bottom:1px solid #eee}
    .product-hero__grid{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start}
    .product-hero__photo{aspect-ratio:1/1;background:#f4f2eb;border-radius:18px;overflow:hidden;box-shadow:0 18px 44px -22px rgba(0,0,0,.18)}
    .product-hero__photo img{width:100%;height:100%;object-fit:cover}
    .product-hero__brand{font-size:.74rem;color:#888;text-transform:uppercase;letter-spacing:.08em;font-weight:700;margin-bottom:6px}
    .product-hero h1{font-size:clamp(2rem,4vw,2.8rem);margin-bottom:14px}
    .product-hero__meta{font-size:.92rem;color:#666;margin-bottom:18px}
    .product-hero__price{font-size:1.4rem;font-weight:700;margin-bottom:8px}
    .product-hero__price strong{font-family:'Playfair Display',serif}
    .product-hero__hint{font-size:.86rem;color:#777;margin-bottom:28px}
    .product-hero__ctas{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px}
    .btn{display:inline-flex;align-items:center;gap:8px;padding:14px 26px;border-radius:50px;font-size:.95rem;font-weight:600;cursor:pointer}
    .btn-primary{background:#1a1a1a;color:#fff}
    .btn-primary:hover{background:#333}
    .btn-outline{border:2px solid #1a1a1a;color:#1a1a1a}
    .btn-outline:hover{background:#1a1a1a;color:#fff}
    .colorbar{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
    .colorbar__dot{width:22px;height:22px;border-radius:50%;border:1.5px solid #ddd}
    .colorbar__more{font-size:.76rem;color:#666;align-self:center}
    .factbar{background:#fff;padding:30px 0;border-bottom:1px solid #eee}
    .factbar__grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
    .factbar__cell{padding:0 14px;border-right:1px solid #eee}
    .factbar__cell:last-child{border-right:none}
    .factbar__cell strong{display:block;font-family:'Playfair Display',serif;font-size:1.3rem;color:#1a1a1a}
    .factbar__cell span{font-size:.78rem;color:#888;text-transform:uppercase;letter-spacing:.06em;font-weight:600}
    .copy-section{padding:56px 0}
    .copy-section h2{font-size:1.6rem;margin-bottom:14px}
    .copy-section p{color:#444;margin-bottom:14px;max-width:760px}
    .copy-section ul{list-style:none;padding:0;max-width:760px}
    .copy-section li{padding-left:22px;position:relative;color:#444;margin-bottom:6px}
    .copy-section li::before{content:"";position:absolute;left:0;top:11px;width:6px;height:6px;background:#1a1a1a;border-radius:50%}
    .cta-section{background:#1a1a1a;color:#fff;padding:48px 24px;text-align:center}
    .cta-section h2{color:#fff;margin-bottom:8px;font-size:1.5rem}
    .cta-section p{color:#aaa;margin-bottom:18px}
    .cta-section .btn-accent{background:#e8ff3c;color:#1a1a1a;padding:14px 30px}
    .crumbs{font-size:.78rem;color:#888;padding:14px 0;border-bottom:1px solid #eee;background:#fff}
    .crumbs a{color:#888;text-decoration:underline}
    @media(max-width:720px){
      .product-hero{padding:24px 0 32px}
      .product-hero__grid{grid-template-columns:1fr;gap:24px}
      .factbar__grid{grid-template-columns:repeat(2,1fr);gap:14px}
      .factbar__cell{border-right:none;border-bottom:1px solid #eee;padding-bottom:14px}
      .factbar__cell:nth-child(2n){border-right:none}
    }
  </style>
</head>
<body>

  <div id="nav-placeholder"></div>

  <nav class="crumbs" aria-label="Breadcrumb"><div class="container">
    <a href="/">Home</a> · <a href="/catalog">Catalog</a> · ${escapeHtml(brand + ' ' + style)}
  </div></nav>

  <section class="product-hero"><div class="container"><div class="product-hero__grid">
    <div class="product-hero__photo"><img src="${escapeHtml(hero)}" alt="${escapeHtml(brand + ' ' + style + ' ' + name + ' for custom printing in Montreal')}" loading="eager" fetchpriority="high"></div>
    <div>
      <div class="product-hero__brand">${escapeHtml(brand)} · Style ${escapeHtml(style)}</div>
      <h1>${escapeHtml(name)}</h1>
      <div class="product-hero__meta">${[p.weight_oz ? p.weight_oz + ' oz' : '', p.fabric || '', p.gender || '', (p.colors || []).length + ' colours available'].filter(Boolean).join(' · ')}</div>
      <div class="product-hero__price">From <strong>$${priceFrom.toFixed(2)}</strong> /unit</div>
      <div class="product-hero__hint">${usingFloor
        ? 'Starting tier for this garment category, decorated 1-side at 250+ qty. We&rsquo;ll send your exact per-unit price with the quote.'
        : 'Decorated, 1-side print, at 250+ qty. Smaller orders priced on your quote.'}</div>
      <div class="product-hero__ctas">
        <a class="btn btn-primary" href="/quote.html?product=${encodeURIComponent(p.product_id || '')}">Get a quote →</a>
        <a class="btn btn-outline" href="/catalog#p=${encodeURIComponent(p.product_id || '')}">See in catalog</a>
      </div>
      ${colors.length ? `<div class="colorbar" aria-label="Available colours">
        ${colors.slice(0, 12).map(c => `<span class="colorbar__dot" style="background:${escapeHtml(c.hex_code || '#ccc')}" title="${escapeHtml((c.color_name || '').replace(/_\d+$/, ''))}"></span>`).join('')}
        ${colors.length > 12 ? `<span class="colorbar__more">+${colors.length - 12} more</span>` : ''}
      </div>` : ''}
    </div>
  </div></div></section>

  <section class="factbar"><div class="container"><div class="factbar__grid">
    <div class="factbar__cell"><strong>${escapeHtml(p.weight_oz ? p.weight_oz + ' oz' : '—')}</strong><span>Fabric weight</span></div>
    <div class="factbar__cell"><strong>${escapeHtml(p.fabric || '—')}</strong><span>Material</span></div>
    <div class="factbar__cell"><strong>${(p.colors || []).length}</strong><span>Colours</span></div>
    <div class="factbar__cell"><strong>${p.in_stock === false ? 'Out of stock' : 'In stock'}</strong><span>Availability</span></div>
  </div></div></section>

  <section class="copy-section"><div class="container">
    <h2>Custom printing on the ${escapeHtml(brand + ' ' + style)} in Montreal</h2>
    <p>The ${escapeHtml(brand + ' ' + style)} is one of the most-decorated styles out of our Sainte-Anne-de-Bellevue studio. We decorate it across all four of our methods: <strong>DTG</strong> for soft-hand full-colour prints on cotton, <strong>DTF</strong> for vibrant prints on poly blends and dark fabrics, <strong>embroidery</strong> for logos and corporate identity, and <strong>screen printing</strong> for high-volume single-colour runs.</p>
    <p>Minimum order on this blank is 5 units for DTG/DTF, 12 units for embroidery. Standard turnaround is 7–10 business days from approved artwork; rush options (3–5 days) are available with a small surcharge. Local pickup in Sainte-Anne-de-Bellevue is free; Canada-wide shipping via Canpar or Purolator on request.</p>

    <h2 style="margin-top:36px">Specifications</h2>
    <ul>
      <li>Brand: ${escapeHtml(brand)}</li>
      <li>Style number: ${escapeHtml(style)}</li>
      <li>${p.fabric ? 'Fabric: ' + escapeHtml(p.fabric) : 'Fabric: see product description'}</li>
      <li>${p.weight_oz ? 'Weight: ' + p.weight_oz + ' oz/yd²' : 'Weight: see product description'}</li>
      <li>Colours available: ${(p.colors || []).length}</li>
      <li>Sizes typically available: XS–4XL depending on colour (2XL+ adds $3/pc per industry standard)</li>
    </ul>

    <h2 style="margin-top:36px">Who orders this blank?</h2>
    <p>Mostly West Island businesses, McGill student organisations, charity-run organisers, and corporate procurement teams running staff-uniform programs. Net-30 terms are available for approved repeat accounts.</p>

    <h2 style="margin-top:36px">Get your quote</h2>
    <p>Pick a decoration method, send us your artwork (or use our free design help) and we'll come back with a firm quote, sample timeline and Net-30 paperwork — usually within the hour during business hours (9 AM to 9 PM, 7 days a week).</p>
  </div></section>

  <section class="cta-section">
    <div class="container">
      <h2>Get a quote for ${escapeHtml(brand + ' ' + style)}</h2>
      <p>Firm pricing, real timeline, no commitment until you approve the sample.</p>
      <a class="btn btn-accent" href="/quote.html?product=${encodeURIComponent(p.product_id || '')}">Start your quote →</a>
    </div>
  </section>

  <div id="footer-placeholder"></div>

  <script src="/components.js"></script>
  <script src="/lang.js"></script>
</body>
</html>
`;
}

async function main() {
  console.log(`fetching ${API_URL}`);
  const res = await fetch(API_URL);
  if (!res.ok) {
    console.error('catalog fetch failed:', res.status, await res.text());
    process.exit(1);
  }
  const data = await res.json();
  const products = (data.products || []).slice();
  console.log(`got ${products.length} products`);

  products.sort((a, b) => score(b) - score(a));
  // Filter first (must have a brand + style for a clean URL), then take TOP_N
  // so the cap doesn't accidentally include garbage rows.
  const valid = products.filter(p => p.brand && p.style_number);
  const top = valid.slice(0, TOP_N);

  await fs.mkdir(OUT_DIR, { recursive: true });
  const generated = [];
  for (const p of top) {
    const slug = slugify(p.brand + '-' + p.style_number);
    if (!slug) continue;
    const dir = path.join(OUT_DIR, slug);
    await fs.mkdir(dir, { recursive: true });
    const html = buildPage(p);
    await fs.writeFile(path.join(dir, 'index.html'), html, 'utf8');
    generated.push({ slug, brand: p.brand, style: p.style_number, name: p.name });
    console.log(`  /p/${slug}/`);
  }

  // Append the generated URLs to a separate sitemap fragment so the user
  // can paste them into the main sitemap.xml without a build step on the
  // host. Vercel auto-serves whatever's in the directory.
  const sitemapFragment = generated.map(g =>
    `  <url><loc>${SITE}/p/${g.slug}/</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`
  ).join('\n');
  await fs.writeFile(path.join(OUT_DIR, 'sitemap.xml.fragment'), sitemapFragment, 'utf8');

  console.log(`\ngenerated ${generated.length} product pages → ${OUT_DIR}`);
  console.log(`paste sitemap.xml.fragment into the main /sitemap.xml`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
