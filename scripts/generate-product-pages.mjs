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

// ---------------------------------------------------------------------------
// SEO structured-data constants. Used by every generated Product entity to
// satisfy Google's "Product snippet" + "Merchant listing" enrichment fields
// (aggregateRating, review, shippingDetails, hasMerchantReturnPolicy). Edit
// the values here when the live business policy changes — no per-product
// overrides are needed because these are brand-level facts.
// ---------------------------------------------------------------------------
const STAR_RATING = { ratingValue: '5.0', reviewCount: '21' }; // current Google Reviews
const REVIEWS = [
  { name: 'Coodin',      date: '2024-06-01', body: 'Printed tees for my band on extremely short notice. Literally on the same day of our gig at Singhs Arcade. If you want a print shop that actually values their customers and isn’t strictly for profit, this is the place. 10/10' },
  { name: 'Keerit Kaur', date: '2024-04-15', body: 'Really happy with my order, the prints came out perfect, quality was great, and they got everything done on time.' },
  { name: 'Ori Peer',    date: '2024-03-10', body: 'I love my shirt they supported my vision!!! Best spot in MTL!' }
];
// Free Canada-wide shipping (cost is bundled into the per-unit quote). 7-10
// day in-house production + 1-5 day Chit Chats / Canada Post transit. Adjust
// if shop ever charges an explicit shipping line item.
const SHIPPING = { country: 'CA', valueCAD: '0', handlingMin: 7, handlingMax: 10, transitMin: 1, transitMax: 5 };
// 14-day window covers reprints/replacements for print quality + garment
// defects — matches the satisfaction guarantee in the homepage FAQ.
const RETURNS  = { country: 'CA', windowDays: 14 };

function aggregateRatingNode() {
  return {
    '@type':       'AggregateRating',
    'ratingValue': STAR_RATING.ratingValue,
    'reviewCount': STAR_RATING.reviewCount,
    'bestRating':  '5',
    'worstRating': '1'
  };
}
function reviewNodes() {
  return REVIEWS.map(r => ({
    '@type':         'Review',
    'author':        { '@type': 'Person', 'name': r.name },
    'datePublished': r.date,
    'reviewRating':  { '@type': 'Rating', 'ratingValue': '5', 'bestRating': '5' },
    'reviewBody':    r.body
  }));
}
function shippingDetailsNode() {
  return {
    '@type': 'OfferShippingDetails',
    'shippingRate': { '@type': 'MonetaryAmount', 'value': SHIPPING.valueCAD, 'currency': 'CAD' },
    'shippingDestination': { '@type': 'DefinedRegion', 'addressCountry': SHIPPING.country },
    'deliveryTime': {
      '@type': 'ShippingDeliveryTime',
      'handlingTime': { '@type': 'QuantitativeValue', 'minValue': SHIPPING.handlingMin, 'maxValue': SHIPPING.handlingMax, 'unitCode': 'DAY' },
      'transitTime':  { '@type': 'QuantitativeValue', 'minValue': SHIPPING.transitMin,  'maxValue': SHIPPING.transitMax,  'unitCode': 'DAY' }
    }
  };
}
function returnPolicyNode() {
  return {
    '@type':                'MerchantReturnPolicy',
    'applicableCountry':    RETURNS.country,
    'returnPolicyCategory': 'https://schema.org/MerchantReturnFiniteReturnWindow',
    'merchantReturnDays':   RETURNS.windowDays,
    'returnMethod':         'https://schema.org/ReturnByMail',
    'returnFees':           'https://schema.org/FreeReturn'
  };
}

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

// All boilerplate strings the page template needs. Keep these in lock-step
// when you add new copy — every key must have an `en` and `fr` value.
const I18N = {
  // <head> + meta
  titleSuffix:     { en: 'Custom Printing in Montreal · Singhs Print',
                     fr: 'Impression personnalisée à Montréal · Singhs Print' },
  metaPrefix:      { en: 'Custom printed',                fr: 'Impression personnalisée sur' },
  metaCore:        { en: 'in Montreal. DTG, DTF, embroidery and screen printing from',
                     fr: 'à Montréal. DTG, DTF, broderie et sérigraphie à partir de' },
  metaPerUnit:     { en: '/unit',                         fr: '/unité' },
  metaTail:        { en: 'Sainte-Anne-de-Bellevue studio, Net-30 for repeat accounts. Get a quote in 1 hour.',
                     fr: 'Studio à Sainte-Anne-de-Bellevue, Net-30 pour comptes récurrents. Soumission en 1 heure.' },
  ogTitleSuffix:   { en: '· Singhs Print Montreal',       fr: '· Singhs Print Montréal' },

  // Crumbs
  home:            { en: 'Home',     fr: 'Accueil' },
  catalog:         { en: 'Catalog',  fr: 'Catalogue' },

  // Hero
  styleLabel:      { en: 'Style',          fr: 'Modèle' },
  oz:              { en: 'oz',             fr: 'oz' },
  coloursAvail:    { en: 'colours available', fr: 'couleurs disponibles' },
  from:            { en: 'From',           fr: 'À partir de' },
  perUnit:         { en: '/unit',          fr: '/unité' },
  hintEngine:      { en: 'Decorated, 1-side print, at 250+ qty. Smaller orders priced on your quote.',
                     fr: 'Décoré, impression 1 côté, à 250+ unités. Les petites commandes sont chiffrées dans votre soumission.' },
  hintFloor:       { en: 'Starting tier for this garment category, decorated 1-side at 250+ qty. We&rsquo;ll send your exact per-unit price with the quote.',
                     fr: 'Palier de départ pour cette catégorie, décoré 1 côté à 250+ unités. Le prix unitaire exact arrive avec votre soumission.' },
  ctaQuote:        { en: 'Get a quote →', fr: 'Demander une soumission →' },
  ctaInCatalog:    { en: 'See in catalog', fr: 'Voir dans le catalogue' },
  coloursAria:     { en: 'Available colours', fr: 'Couleurs disponibles' },
  moreColours:     { en: 'more',           fr: 'de plus' },

  // Fact bar
  fbFabricWeight:  { en: 'Fabric weight',  fr: 'Poids du tissu' },
  fbMaterial:      { en: 'Material',       fr: 'Matériau' },
  fbColours:       { en: 'Colours',        fr: 'Couleurs' },
  fbAvailability:  { en: 'Availability',   fr: 'Disponibilité' },
  outOfStock:      { en: 'Out of stock',   fr: 'En rupture' },
  inStock:         { en: 'In stock',       fr: 'En stock' },
  none:            { en: '—',              fr: '—' },

  // Body sections
  bodyH2Title:     { en: 'Custom printing on the',
                     fr: 'Impression personnalisée sur le' },
  bodyH2Suffix:    { en: 'in Montreal',    fr: 'à Montréal' },
  bodyP1Lead:      { en: 'The',            fr: 'Le' },
  bodyP1Mid:       { en: 'is one of the most-decorated styles out of our Sainte-Anne-de-Bellevue studio. We decorate it across all four of our methods:',
                     fr: 'est l\'un des modèles les plus décorés à notre studio de Sainte-Anne-de-Bellevue. Nous le décorons avec nos quatre méthodes :' },
  bodyP1Dtg:       { en: 'for soft-hand full-colour prints on cotton,',
                     fr: 'pour des impressions souples en couleurs sur coton,' },
  bodyP1Dtf:       { en: 'for vibrant prints on poly blends and dark fabrics,',
                     fr: 'pour des impressions éclatantes sur polyesters et tissus foncés,' },
  bodyP1Emb:       { en: 'for logos and corporate identity, and',
                     fr: 'pour les logos et l\'identité corporative, et' },
  bodyP1Screen:    { en: 'for high-volume single-colour runs.',
                     fr: 'pour les tirages mono-couleur en gros volume.' },
  bodyP2:          { en: 'Minimum order on this blank is 5 units for DTG/DTF, 12 units for embroidery. Standard turnaround is 7–10 business days from approved artwork; rush options (3–5 days) are available with a small surcharge. Local pickup in Sainte-Anne-de-Bellevue is free; Canada-wide shipping via Canpar or Purolator on request.',
                     fr: 'Minimums : 5 unités pour DTG/DTF, 12 unités pour la broderie. Délai standard : 7 à 10 jours ouvrables à partir de l\'approbation du visuel ; options urgentes (3 à 5 jours) moyennant un léger supplément. Ramassage gratuit à Sainte-Anne-de-Bellevue ; expédition pancanadienne via Canpar ou Purolator sur demande.' },

  specsH2:         { en: 'Specifications', fr: 'Spécifications' },
  specBrand:       { en: 'Brand:',         fr: 'Marque :' },
  specStyle:       { en: 'Style number:',  fr: 'Numéro de modèle :' },
  specFabric:      { en: 'Fabric:',        fr: 'Tissu :' },
  specFabricNA:    { en: 'Fabric: see product description', fr: 'Tissu : voir la description du produit' },
  specWeight:      { en: 'Weight:',        fr: 'Poids :' },
  specWeightNA:    { en: 'Weight: see product description', fr: 'Poids : voir la description du produit' },
  specColours:     { en: 'Colours available:', fr: 'Couleurs disponibles :' },
  specSizes:       { en: 'Sizes typically available: XS–4XL depending on colour (2XL+ adds $3/pc per industry standard)',
                     fr: 'Tailles habituellement disponibles : XS à 4XL selon la couleur (2XL et plus : supplément de 3 $/pièce, norme de l\'industrie)' },

  whoH2:           { en: 'Who orders this blank?', fr: 'Qui commande ce vêtement vierge ?' },
  whoP:            { en: 'Mostly West Island businesses, McGill student organisations, charity-run organisers, and corporate procurement teams running staff-uniform programs. Net-30 terms are available for approved repeat accounts.',
                     fr: 'Surtout des entreprises de l\'Ouest-de-l\'Île, des organisations étudiantes de McGill, des organisateurs de courses caritatives et des équipes d\'approvisionnement corporatives qui gèrent des programmes d\'uniformes. Modalités Net-30 disponibles pour les comptes récurrents approuvés.' },

  quoteH2:         { en: 'Get your quote', fr: 'Obtenez votre soumission' },
  quoteP:          { en: 'Pick a decoration method, send us your artwork (or use our free design help) and we\'ll come back with a firm quote, sample timeline and Net-30 paperwork, usually within the hour during business hours (9 AM to 9 PM, 7 days a week).',
                     fr: 'Choisissez une méthode de décoration, envoyez votre visuel (ou utilisez notre service de design gratuit) et on revient avec une soumission ferme, un échéancier d\'échantillon et la paperasse Net-30, généralement en moins d\'une heure pendant les heures d\'ouverture (9 h à 21 h, 7 jours sur 7).' },

  // Footer CTA
  ctaSecH2Prefix:  { en: 'Get a quote for', fr: 'Demandez une soumission pour' },
  ctaSecP:         { en: 'Firm pricing, real timeline, no commitment until you approve the sample.',
                     fr: 'Prix ferme, échéancier réel, aucun engagement avant l\'approbation de l\'échantillon.' },
  ctaSecBtn:       { en: 'Start your quote →', fr: 'Commencer ma soumission →' },

  // Alt text + breadcrumb item name in JSON-LD
  altPrefix:       { en: 'for custom printing in Montreal',
                     fr: 'pour impression personnalisée à Montréal' },
};

// Pick a string by language with EN fallback if a key is missing.
function t(key, lang) {
  const entry = I18N[key];
  if (!entry) return '';
  return entry[lang] != null ? entry[lang] : entry.en;
}

function buildPage(p, lang = 'en') {
  const brand = (p.brand || '').trim();
  const style = (p.style_number || '').trim();
  const name  = (p.name || '').trim();
  const slug  = slugify(brand + '-' + style);
  const urlPath = (lang === 'fr' ? '/fr/p/' : '/p/') + slug + '/';
  const url   = SITE + urlPath;
  const urlEn = SITE + '/p/' + slug + '/';
  const urlFr = SITE + '/fr/p/' + slug + '/';
  const heroColor = (p.colors || []).find(c => Array.isArray(c.sizes_in_stock) && c.sizes_in_stock.length) || (p.colors || [])[0] || {};
  const hero  = imgUrl(heroColor.mockup_front_url || p.hero_image_url || '');

  const priceFrom = resolvedPrice(p);
  const usingFloor = !(typeof p.price_from === 'number' && p.price_from > 0);
  const title = `${brand} ${style} ${name} — ${t('titleSuffix', lang)}`;
  const meta  = `${t('metaPrefix', lang)} ${brand} ${style} ${name} ${t('metaCore', lang)} $${priceFrom.toFixed(2)}${t('metaPerUnit', lang)}. ${t('metaTail', lang)}`;

  // Variant offers per color — drives "Available in N colours" rich-result variants.
  // shippingDetails + hasMerchantReturnPolicy are required by Google's Merchant
  // Listing enrichment; aggregateRating + review unlock the Product-snippet
  // rich-result with stars.
  const colors = (p.colors || []).slice(0, 24);
  const offers = {
    '@type': 'AggregateOffer',
    'lowPrice': priceFrom.toFixed(2),
    'highPrice': (priceFrom + 20).toFixed(2),
    'priceCurrency': 'CAD',
    'offerCount': colors.length || 1,
    'availability': p.in_stock === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
    'seller': { '@id': SITE + '/#business' },
    'shippingDetails':         shippingDetailsNode(),
    'hasMerchantReturnPolicy': returnPolicyNode()
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
        'inLanguage': lang === 'fr' ? 'fr-CA' : 'en-CA',
        'offers': offers,
        'aggregateRating': aggregateRatingNode(),
        'review':          reviewNodes(),
        'isRelatedTo': { '@id': SITE + '/#business' }
      },
      {
        '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': t('home', lang),    'item': SITE + (lang === 'fr' ? '/fr/' : '/') },
          { '@type': 'ListItem', 'position': 2, 'name': t('catalog', lang), 'item': SITE + (lang === 'fr' ? '/fr/catalog' : '/catalog') },
          { '@type': 'ListItem', 'position': 3, 'name': `${brand} ${style}`, 'item': url }
        ]
      }
    ]
  };

  return `<!DOCTYPE html>
<html lang="${lang === 'fr' ? 'fr' : 'en'}">
<head>
  <meta charset="UTF-8">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="apple-touch-icon" href="/favicon-180.png">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(meta)}">
  <link rel="canonical" href="${url}">
  <link rel="alternate" hreflang="en" href="${urlEn}">
  <link rel="alternate" hreflang="fr" href="${urlFr}">
  <link rel="alternate" hreflang="x-default" href="${urlEn}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap" rel="stylesheet">
  <meta property="og:type" content="product">
  <meta property="og:title" content="${escapeHtml(brand + ' ' + style + ' ' + t('ogTitleSuffix', lang))}">
  <meta property="og:description" content="${escapeHtml(meta)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${hero}">
  <meta property="og:site_name" content="Singhs Print">
  <meta property="og:locale" content="${lang === 'fr' ? 'fr_CA' : 'en_CA'}">
  <meta property="og:locale:alternate" content="${lang === 'fr' ? 'en_CA' : 'fr_CA'}">
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
    <a href="${lang === 'fr' ? '/fr/' : '/'}">${t('home', lang)}</a> · <a href="${lang === 'fr' ? '/fr/catalog' : '/catalog'}">${t('catalog', lang)}</a> · ${escapeHtml(brand + ' ' + style)}
  </div></nav>

  <section class="product-hero"><div class="container"><div class="product-hero__grid">
    <div class="product-hero__photo"><img src="${escapeHtml(hero)}" alt="${escapeHtml(brand + ' ' + style + ' ' + name + ' ' + t('altPrefix', lang))}" loading="eager" fetchpriority="high"></div>
    <div>
      <div class="product-hero__brand">${escapeHtml(brand)} · ${t('styleLabel', lang)} ${escapeHtml(style)}</div>
      <h1>${escapeHtml(name)}</h1>
      <div class="product-hero__meta">${[p.weight_oz ? p.weight_oz + ' ' + t('oz', lang) : '', p.fabric || '', p.gender || '', (p.colors || []).length + ' ' + t('coloursAvail', lang)].filter(Boolean).join(' · ')}</div>
      <div class="product-hero__price">${t('from', lang)} <strong>$${priceFrom.toFixed(2)}</strong> ${t('perUnit', lang)}</div>
      <div class="product-hero__hint">${usingFloor ? t('hintFloor', lang) : t('hintEngine', lang)}</div>
      <div class="product-hero__ctas">
        <a class="btn btn-primary" href="${lang === 'fr' ? '/fr/quote' : '/quote.html'}?product=${encodeURIComponent(p.product_id || '')}">${t('ctaQuote', lang)}</a>
        <a class="btn btn-outline" href="${lang === 'fr' ? '/fr/catalog' : '/catalog'}#p=${encodeURIComponent(p.product_id || '')}">${t('ctaInCatalog', lang)}</a>
      </div>
      ${colors.length ? `<div class="colorbar" aria-label="${t('coloursAria', lang)}">
        ${colors.slice(0, 12).map(c => `<span class="colorbar__dot" style="background:${escapeHtml(c.hex_code || '#ccc')}" title="${escapeHtml((c.color_name || '').replace(/_\d+$/, ''))}"></span>`).join('')}
        ${colors.length > 12 ? `<span class="colorbar__more">+${colors.length - 12} ${t('moreColours', lang)}</span>` : ''}
      </div>` : ''}
    </div>
  </div></div></section>

  <section class="factbar"><div class="container"><div class="factbar__grid">
    <div class="factbar__cell"><strong>${escapeHtml(p.weight_oz ? p.weight_oz + ' ' + t('oz', lang) : t('none', lang))}</strong><span>${t('fbFabricWeight', lang)}</span></div>
    <div class="factbar__cell"><strong>${escapeHtml(p.fabric || t('none', lang))}</strong><span>${t('fbMaterial', lang)}</span></div>
    <div class="factbar__cell"><strong>${(p.colors || []).length}</strong><span>${t('fbColours', lang)}</span></div>
    <div class="factbar__cell"><strong>${p.in_stock === false ? t('outOfStock', lang) : t('inStock', lang)}</strong><span>${t('fbAvailability', lang)}</span></div>
  </div></div></section>

  <section class="copy-section"><div class="container">
    <h2>${t('bodyH2Title', lang)} ${escapeHtml(brand + ' ' + style)} ${t('bodyH2Suffix', lang)}</h2>
    <p>${t('bodyP1Lead', lang)} ${escapeHtml(brand + ' ' + style)} ${t('bodyP1Mid', lang)} <strong>DTG</strong> ${t('bodyP1Dtg', lang)} <strong>DTF</strong> ${t('bodyP1Dtf', lang)} <strong>${lang === 'fr' ? 'broderie' : 'embroidery'}</strong> ${t('bodyP1Emb', lang)} <strong>${lang === 'fr' ? 'sérigraphie' : 'screen printing'}</strong> ${t('bodyP1Screen', lang)}</p>
    <p>${t('bodyP2', lang)}</p>

    <h2 style="margin-top:36px">${t('specsH2', lang)}</h2>
    <ul>
      <li>${t('specBrand', lang)} ${escapeHtml(brand)}</li>
      <li>${t('specStyle', lang)} ${escapeHtml(style)}</li>
      <li>${p.fabric ? t('specFabric', lang) + ' ' + escapeHtml(p.fabric) : t('specFabricNA', lang)}</li>
      <li>${p.weight_oz ? t('specWeight', lang) + ' ' + p.weight_oz + ' oz/yd²' : t('specWeightNA', lang)}</li>
      <li>${t('specColours', lang)} ${(p.colors || []).length}</li>
      <li>${t('specSizes', lang)}</li>
    </ul>

    <h2 style="margin-top:36px">${t('whoH2', lang)}</h2>
    <p>${t('whoP', lang)}</p>

    <h2 style="margin-top:36px">${t('quoteH2', lang)}</h2>
    <p>${t('quoteP', lang)}</p>
  </div></section>

  <section class="cta-section">
    <div class="container">
      <h2>${t('ctaSecH2Prefix', lang)} ${escapeHtml(brand + ' ' + style)}</h2>
      <p>${t('ctaSecP', lang)}</p>
      <a class="btn btn-accent" href="${lang === 'fr' ? '/fr/quote' : '/quote.html'}?product=${encodeURIComponent(p.product_id || '')}">${t('ctaSecBtn', lang)}</a>
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

  const FR_OUT_DIR = path.join(ROOT, 'fr', 'p');
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(FR_OUT_DIR, { recursive: true });
  const generated = [];
  for (const p of top) {
    const slug = slugify(p.brand + '-' + p.style_number);
    if (!slug) continue;

    // EN
    const dirEn = path.join(OUT_DIR, slug);
    await fs.mkdir(dirEn, { recursive: true });
    await fs.writeFile(path.join(dirEn, 'index.html'), buildPage(p, 'en'), 'utf8');

    // FR
    const dirFr = path.join(FR_OUT_DIR, slug);
    await fs.mkdir(dirFr, { recursive: true });
    await fs.writeFile(path.join(dirFr, 'index.html'), buildPage(p, 'fr'), 'utf8');

    generated.push({ slug, brand: p.brand, style: p.style_number, name: p.name });
    console.log(`  /p/${slug}/  +  /fr/p/${slug}/`);
  }

  // Sitemap fragment — both languages, each with hreflang cross-link.
  const sitemapFragment = generated.map(g => {
    const en = `${SITE}/p/${g.slug}/`;
    const fr = `${SITE}/fr/p/${g.slug}/`;
    return `  <url><loc>${en}</loc><changefreq>weekly</changefreq><priority>0.7</priority>
    <xhtml:link rel="alternate" hreflang="en" href="${en}"/>
    <xhtml:link rel="alternate" hreflang="fr" href="${fr}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${en}"/>
  </url>
  <url><loc>${fr}</loc><changefreq>weekly</changefreq><priority>0.7</priority>
    <xhtml:link rel="alternate" hreflang="en" href="${en}"/>
    <xhtml:link rel="alternate" hreflang="fr" href="${fr}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${en}"/>
  </url>`;
  }).join('\n');
  await fs.writeFile(path.join(OUT_DIR, 'sitemap.xml.fragment'), sitemapFragment, 'utf8');

  console.log(`\ngenerated ${generated.length} EN + ${generated.length} FR product pages`);
  console.log(`  EN: ${OUT_DIR}`);
  console.log(`  FR: ${FR_OUT_DIR}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
