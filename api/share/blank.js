/* =========================================================================
 * GET /b/<brand-style>[/<colour>[/<qty>]]          (and /fr/b/... )
 *   → reached via the vercel.json rewrites onto /api/share/blank
 *
 * The share link for a single blank. Server-rendered for exactly one
 * reason: link previews. A raw /catalog?product=<uuid> deep link already
 * opens the right modal, but when it is pasted into iMessage, WhatsApp,
 * Slack or LinkedIn the unfurl shows catalog.html's static Open Graph tags
 * — the generic stock photo and "Apparel Catalog — Singhs Print" — no
 * matter which blank was shared. This route emits per-product, per-colour
 * OG tags so the preview shows the actual garment in the actual colour with
 * its actual price, then hands the human off to the catalog.
 *
 * Same trick, same reason as /shop/:slug → api/shop/page.js.
 *
 * Crawlers do not run scripts, so they stop at the <head> and read the
 * meta. Humans get location.replace()'d to the catalog deep link (and a
 * <noscript> meta-refresh covers the rest).
 *
 *   /b/gildan-5000                                → product only
 *   /b/gildan-5000/antique-cherry-red             → + colour
 *   /b/gildan-5000/antique-cherry-red/100         → + qty (50 is the
 *                                                    default and is omitted,
 *                                                    matching setQty()'s
 *                                                    "delete the default from
 *                                                    the URL" convention)
 *
 * Resolution goes through the CRM's /api/catalog?q=… rather than Supabase
 * directly: it is the same authoritative source catalog.js already reads,
 * it returns the colours array we need for the OG image, and it is CDN
 * cached for 15 minutes — which matters while the Supabase project is
 * close to its egress ceiling.
 *
 * Returns:
 *   200 → HTML with per-product OG tags + client redirect
 *   302 → /catalog when the slug resolves to nothing (bad or stale link)
 * ========================================================================= */

const CRM = 'https://singhsprint-crm.vercel.app';
const DEFAULT_QTY = 50;

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Must stay byte-identical to spSlug() in catalog.js — the client builds the
// URL, this route takes it apart again. Any drift silently 302s every link.
function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // café → cafe
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function resolveProduct(slug, qty) {
  // The slug's own words are the search terms. /api/catalog?q= tokenizes and
  // ANDs each word across brand / style_number / name, so "gildan-5000"
  // becomes (brand|style|name ~ gildan) AND (brand|style|name ~ 5000).
  const terms = slug.replace(/-/g, ' ').trim();
  if (!terms) return null;
  const url = `${CRM}/api/catalog?q=${encodeURIComponent(terms)}&limit=60&qty=${qty}`;

  let data;
  try {
    const r = await fetch(url, { headers: { accept: 'application/json' } });
    if (!r.ok) return null;
    data = await r.json();
  } catch (e) {
    console.error('[/b] catalog lookup failed:', e && e.message);
    return null;
  }

  const products = Array.isArray(data && data.products) ? data.products : [];
  // Exact slug equality, never "close enough" — the top text-search hit is
  // routinely the wrong record (searching "gildan 5000" surfaces a Blanks.ca
  // row whose brand field is the whole product name), so a fuzzy match here
  // would confidently show the customer someone else's garment.
  const exact = products.filter(
    (p) => `${slugify(p.brand)}-${slugify(p.style_number)}` === slug
  );
  if (!exact.length) return null;
  // ~28 of 6,572 products share a brand+style pair (duplicate supplier
  // imports of the same garment). Pick deterministically so a given link
  // always lands on the same record: in stock first, then most colours,
  // then lowest id.
  exact.sort((a, b) => {
    if ((b.in_stock === true) - (a.in_stock === true)) return (b.in_stock === true) - (a.in_stock === true);
    if ((b.color_count || 0) !== (a.color_count || 0)) return (b.color_count || 0) - (a.color_count || 0);
    return String(a.product_id).localeCompare(String(b.product_id));
  });
  return exact[0];
}

// S&S Activewear, Blanks.ca and SanMar all 403 direct hotlinks from external
// referrers — which is exactly what a Facebook / iMessage / Slack unfurl
// crawler is. A raw supplier URL in og:image renders the preview with no
// picture at all, i.e. it silently defeats this whole route. Same proxy, same
// reason as imgUrl() in catalog.js.
const PROXIED_HOSTS = ['ssactivewear.com', 'blanks.ca', 'sanmarcanada.com'];

function imgUrl(raw, w) {
  if (!raw) return '';
  if (raw.startsWith('/') || raw.indexOf('singhsprint.com') >= 0) return raw;
  if (PROXIED_HOSTS.some((h) => raw.indexOf(h) >= 0)) {
    return `${CRM}/api/image-proxy?url=${encodeURIComponent(raw)}` + (w ? `&w=${w}` : '');
  }
  return raw;
}

function pickColor(product, colorParam) {
  const colors = Array.isArray(product.colors) ? product.colors : [];
  if (!colors.length) return null;
  if (colorParam) {
    const want = slugify(colorParam);
    const hit = colors.find(
      (c) => slugify(c.color_name) === want || String(c.color_id) === colorParam
    );
    if (hit) return hit;
  }
  // No colour asked for (or it no longer exists): first one that has stock,
  // same priority the product card uses for its hero swatch.
  const inStock = colors.find(
    (c) => Array.isArray(c.sizes_in_stock) && c.sizes_in_stock.length > 0
  );
  return inStock || colors[0];
}

function pageHtml({ product, color, qty, lang, canonical, target }) {
  const fr = lang === 'fr';
  const brandLine = [product.brand, product.style_number].filter(Boolean).join(' ');
  const title = [brandLine, product.name].filter(Boolean).join(' · ');
  const colorName = (color && color.color_name ? String(color.color_name) : '').replace(/_\d+$/, '');
  const price =
    typeof product.price_from === 'number' && product.price_from > 0
      ? product.price_from.toFixed(2)
      : null;

  const descBits = fr
    ? [
        colorName || null,
        // Currency stays $13.95, not 13,95 $ — the storefront's own price
        // lockups render it that way on /fr too, and the preview popover
        // quotes the same string. Consistency with the page beats idiom.
        price ? `à partir de $${price}/unité pour ${qty}` : null,
        'Personnalisé par Singhs Print, Montréal.',
      ]
    : [
        colorName || null,
        price ? `from $${price}/unit at ${qty}` : null,
        'Decorated by Singhs Print, Montreal.',
      ];
  const description = descBits.filter(Boolean).join(' · ');

  const image = imgUrl(
    (color && (color.mockup_front_url || color.swatch_image_url)) ||
      product.hero_image_url ||
      'https://www.singhsprint.com/images/product-tshirt-modavie.jpg'
    // No `w`: the proxy re-encodes to WebP whenever a width is passed, and
    // JPEG is the safer bet across every unfurl crawler. Supplier stills are
    // ~500px anyway, so a width would only ever downscale.
  );

  const opening = fr ? 'Ouverture du catalogue…' : 'Opening the catalog…';
  const manual = fr ? 'Continuer' : 'Continue';

  return `<!doctype html>
<html lang="${fr ? 'fr' : 'en'}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} · Singhs Print</title>
  <meta name="description" content="${esc(description)}">
  <link rel="icon" href="/favicon.ico">
  <link rel="apple-touch-icon" href="/images/favicon-180.png">
  <link rel="canonical" href="${esc(canonical)}">

  <!-- The whole point of this route. -->
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="Singhs Print">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:image" content="${esc(image)}">
  <meta property="og:image:alt" content="${esc([brandLine, colorName].filter(Boolean).join(' — '))}">
  <meta property="og:locale" content="${fr ? 'fr_CA' : 'en_CA'}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(image)}">
${price ? `  <meta property="product:price:amount" content="${esc(price)}">
  <meta property="product:price:currency" content="CAD">` : ''}

  <noscript><meta http-equiv="refresh" content="0;url=${esc(target)}"></noscript>
  <style>
    body{font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f7f4;color:#1a1a1a;
      margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    .w{text-align:center;max-width:420px}
    .w img{width:180px;height:180px;object-fit:contain;margin-bottom:18px}
    .b{font-size:.7rem;letter-spacing:.06em;text-transform:uppercase;font-weight:700;color:#888}
    .t{font-size:1.15rem;font-weight:700;margin-top:2px;line-height:1.25}
    .s{font-size:.85rem;color:#666;margin-top:10px}
    .a{display:inline-block;margin-top:18px;background:#1a1a1a;color:#fff;text-decoration:none;
      padding:11px 22px;border-radius:50px;font-weight:600;font-size:.92rem}
  </style>
</head>
<body>
  <div class="w">
    <img src="${esc(image)}" alt="${esc(title)}">
    <div class="b">${esc(brandLine)}</div>
    <div class="t">${esc(product.name || '')}</div>
    <div class="s">${esc(opening)}</div>
    <a class="a" href="${esc(target)}">${esc(manual)}</a>
  </div>
  <script>location.replace(${JSON.stringify(target)});</script>
</body>
</html>`;
}

module.exports = async (req, res) => {
  const q = (req.query || {});
  const slug = slugify(q.slug || '');
  const lang = q.lang === 'fr' ? 'fr' : 'en';
  const catalogPath = lang === 'fr' ? '/fr/catalog' : '/catalog';

  // parseInt('1e9', 10) is 1 — it stops at the 'e' and hands back the
  // mantissa, so the range check below used to PASS and /b/…/1e9 rendered as a
  // one-piece share priced at the most expensive tier. Every other bad value
  // ('0', '-5', '999999999', 'abc') fell back correctly, which is exactly why
  // it went unnoticed. Read the whole string or refuse it: a qty that arrives
  // as a float, a hex literal, or with a sign is a client bug worth
  // defaulting on. (CRM twin: src/lib/http/int-param.ts.)
  const qtyStr = String(q.qty == null ? '' : q.qty).trim();
  const qtyNum = /^\d+$/.test(qtyStr) ? Number(qtyStr) : NaN;
  const qty = Number.isSafeInteger(qtyNum) && qtyNum >= 1 && qtyNum <= 10000 ? qtyNum : DEFAULT_QTY;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!slug) return res.redirect(302, catalogPath);

  let product = null;
  try {
    product = await resolveProduct(slug, qty);
  } catch (e) {
    console.error('[/b]', e);
  }
  // Dead or mistyped link: send them to the catalog rather than a 404. They
  // came here wanting to look at blanks.
  if (!product) return res.redirect(302, catalogPath);

  const color = pickColor(product, q.color ? String(q.color) : '');

  // Deep link the catalog already understands. ?color= is resolved by
  // openProductFromUrl() against color_id first, then the colour-name slug.
  const params = new URLSearchParams({ product: String(product.product_id) });
  if (color && color.color_id) params.set('color', String(color.color_id));
  if (qty !== DEFAULT_QTY) params.set('qty', String(qty));
  const target = `${catalogPath}?${params.toString()}`;

  const host = req.headers['x-forwarded-host'] || req.headers.host || 'www.singhsprint.com';
  const base = `https://${String(host).replace(/^http?s:\/\//, '')}`;
  const canonicalBits = [slug];
  if (color && color.color_name) canonicalBits.push(slugify(color.color_name));
  if (qty !== DEFAULT_QTY) canonicalBits.push(String(qty));
  const canonical = `${base}${lang === 'fr' ? '/fr' : ''}/b/${canonicalBits.map(encodeURIComponent).join('/')}`;

  // Matches /api/pricing's "edits are live within ~15 min" contract, so a
  // price change flows into freshly-unfurled previews on the same clock.
  res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=86400');
  return res
    .status(200)
    .send(pageHtml({ product, color, qty, lang, canonical, target }));
};
