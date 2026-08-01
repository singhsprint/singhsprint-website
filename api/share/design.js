/* =========================================================================
 * GET /d/<token>                                   (and /fr/d/<token>)
 *   → reached via the vercel.json rewrites onto /api/share/design
 *
 * The share link for a CUSTOMIZED garment — the sibling of /b/, which only
 * ever carries product + colour + qty. Someone who had uploaded artwork and
 * positioned it in the catalog customizer was sharing the naked blank: the
 * least interesting version of what they were looking at.
 *
 * The unfurl image here is the composed mockup — the actual garment with the
 * actual artwork on it. No new compositing: /api/shop/compose already baked it
 * and returned a permanent public customer-mockups URL, catalog.js already had
 * it in _dmczPreviewUrl, and POST /api/shop/design-share recorded it. This
 * route just reads it back.
 *
 * Because that URL is already public and already a real image, og:image points
 * at it directly — no image-proxy hop, unlike /b/ where the supplier 403s
 * external referrers.
 *
 * Humans LAND here — this is a page, not a redirect. It used to
 * location.replace() to the catalog on load, so the mockup someone had gone
 * to the trouble of sharing flashed up for a frame and vanished. The whole
 * point of the link is that garment with that artwork on it, so it now gets
 * its own screen and the customer chooses to continue.
 *
 * Returns:
 *   200 → HTML with the mockup's OG tags + client redirect
 *   302 → /catalog when the token is unknown (dead or mistyped link)
 * ========================================================================= */

const CRM = 'https://singhsprint-crm.vercel.app';
const DEFAULT_QTY = 50;
const TOKEN_RE = /^[A-Za-z0-9_-]{12,64}$/;

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Ids copied from DMCZ_placementPresets in catalog.js — the ONLY source of
// truth for what a placement is called. An earlier version of this map
// invented ids ('top-back', 'across-back', 'full-back', 'oversized-front')
// that the customizer has never used; the real ones are 'back-top',
// 'back-across', 'back-full' and 'oversized'. Every back and oversized share
// was therefore unfurling with the raw slug ("top back") instead of the
// label, and with no French at all. Missed at first because the test fixture
// used the invented ids too, so the fallback made it look right.
const PLACEMENT_LABELS = {
  'left-chest':        { en: 'Left Chest', fr: 'Poitrine gauche' },
  'center-chest':      { en: 'Center Chest', fr: 'Poitrine centre' },
  'full-front':        { en: 'Full Front', fr: 'Devant complet' },
  'oversized':         { en: 'Oversized Front', fr: 'Devant surdimensionné' },
  'back-top':          { en: 'Top Back', fr: 'Haut du dos' },
  'back-across':       { en: 'Across Back', fr: 'Travers du dos' },
  'back-full':         { en: 'Full Back', fr: 'Dos complet' },
  'left-sleeve':       { en: 'Left Sleeve', fr: 'Manche gauche' },
  'right-sleeve':      { en: 'Right Sleeve', fr: 'Manche droite' },
  'hood':              { en: 'Hood', fr: 'Capuchon' },
  'neck-tag':          { en: 'Inside Neck Tag', fr: 'Étiquette intérieure' },
  'cap-front':         { en: 'Cap Front', fr: 'Devant de la casquette' },
  'cap-left-side':     { en: 'Left Side Panel', fr: 'Panneau gauche' },
  'cap-right-side':    { en: 'Right Side Panel', fr: 'Panneau droit' },
  'cap-back':          { en: 'Back Panel', fr: 'Panneau arrière' },
  'cap-brim':          { en: 'Brim', fr: 'Visière' },
  'bag-front':         { en: 'Front of Bag', fr: 'Devant du sac' },
  'bag-back':          { en: 'Back of Bag', fr: 'Arrière du sac' },
  'bag-pocket':        { en: 'Front Pocket', fr: 'Poche avant' },
  'leg-left-hip':      { en: 'Left Hip', fr: 'Hanche gauche' },
  'leg-right-hip':     { en: 'Right Hip', fr: 'Hanche droite' },
  'leg-back-pocket':   { en: 'Back Pocket', fr: 'Poche arrière' },
  'leg-side':          { en: 'Leg Side', fr: 'Côté de la jambe' },
  'apron-chest':       { en: 'Chest', fr: 'Poitrine' },
  'apron-pocket':      { en: 'Pocket', fr: 'Poche' },
  'apron-full':        { en: 'Full Front', fr: 'Devant complet' },
};

function placementLabel(pid, lang) {
  const e = PLACEMENT_LABELS[pid];
  if (e) return lang === 'fr' ? e.fr : e.en;
  // A placement added to the customizer after this map was written: title-case
  // the slug so it still reads as a label rather than a raw id.
  return String(pid || '')
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const METHOD_LABELS = {
  DTG:        { en: 'DTG print',   fr: 'Impression DTG' },
  DTF:        { en: 'DTF print',   fr: 'Impression DTF' },
  Embroidery: { en: 'Embroidery',  fr: 'Broderie' },
};

// A link-preview crawler gives a page a couple of seconds, so neither of
// these lookups may hang. /api/catalog is force-dynamic and runs the pricing
// engine, so an uncached qty on a cold lambda genuinely can take longer than
// that — this is what made og:title intermittently render as " — customized".
async function getJson(url, ms) {
  const ac = new AbortController();
  const timer = setTimeout(function () { ac.abort(); }, ms || 2500);
  try {
    const r = await fetch(url, { headers: { accept: 'application/json' }, signal: ac.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    console.error('[/d] fetch failed:', url, e && e.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function pageHtml({ share, product, color, lang, canonical, target, image }) {
  const fr = lang === 'fr';
  // From the share row, not the catalog. These were denormalised at creation
  // time precisely so the unfurl cannot degrade when /api/catalog is cold —
  // the product lookup below is enrichment for the price alone.
  const brandLine = [
    share.brand || (product && product.brand),
    share.style_number || (product && product.style_number),
  ].filter(Boolean).join(' ');
  const name = share.product_name || (product && product.name) || '';
  const garment = [brandLine, name].filter(Boolean).join(' · ')
    || (fr ? 'Vêtement personnalisé' : 'Custom apparel');
  const title = fr ? `${garment} — personnalisé` : `${garment} — customized`;

  const colorName = String(share.color_name || (color && color.color_name) || '').replace(/_\d+$/, '');
  const method = METHOD_LABELS[share.decoration_method];
  const methodLabel = method ? (fr ? method.fr : method.en) : null;
  const spots = (share.placements || []).map((p) => placementLabel(p, lang)).filter(Boolean);

  const price =
    product && typeof product.price_from === 'number' && product.price_from > 0
      ? product.price_from.toFixed(2)
      : null;

  const descBits = fr
    ? [
        colorName || null,
        methodLabel,
        spots.length ? spots.join(' + ') : null,
        price ? `à partir de $${price}/unité pour ${share.qty}` : null,
      ]
    : [
        colorName || null,
        methodLabel,
        spots.length ? spots.join(' + ') : null,
        price ? `from $${price}/unit at ${share.qty}` : null,
      ];
  const description = descBits.filter(Boolean).join(' · ');

  const eyebrow  = fr ? 'Partagé avec vous' : 'Shared with you';
  const cta      = fr ? 'Personnaliser ce design' : 'Customize this design';
  const ctaSub   = fr ? 'Changez la couleur, l\u2019emplacement ou la quantité — le visuel reste tel quel.'
                      : 'Change the colour, placement or quantity — the artwork stays as it is.';
  const browse   = fr ? 'Voir tous les vêtements' : 'Browse all blanks';

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

  <!-- A shared design is somebody's artwork on somebody's garment. It is not
       catalog content and must never be indexed or crawled into search. -->
  <meta name="robots" content="noindex, nofollow">

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

  <style>
    *{box-sizing:border-box}
    body{font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f7f4;color:#1a1a1a;
      margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:28px 20px}
    .w{text-align:center;max-width:460px;width:100%}
    .eyebrow{display:inline-block;font-size:.66rem;letter-spacing:.1em;text-transform:uppercase;font-weight:700;
      color:#7a7a6a;background:#f1eed9;border:1px solid #e6e2cd;padding:5px 12px;border-radius:50px;margin-bottom:18px}
    .shot{width:100%;border-radius:16px;background:#fff;border:1px solid #e8e6df;display:block;margin-bottom:20px}
    .b{font-size:.68rem;letter-spacing:.07em;text-transform:uppercase;font-weight:700;color:#999}
    .t{font-size:1.28rem;font-weight:700;margin-top:3px;line-height:1.25}
    .s{font-size:.87rem;color:#666;margin-top:9px;line-height:1.45}
    .a{display:block;margin-top:22px;background:#1a1a1a;color:#fff;text-decoration:none;
      padding:14px 22px;border-radius:50px;font-weight:600;font-size:.95rem}
    .a:hover{background:#000}
    .hint{font-size:.74rem;color:#8a8a80;margin-top:10px;line-height:1.4}
    .alt{display:inline-block;margin-top:16px;font-size:.8rem;color:#7a7a70;text-decoration:underline}
    @media (max-width:420px){ .t{font-size:1.12rem} }
  </style>
</head>
<body>
  <div class="w">
    <span class="eyebrow">${esc(eyebrow)}</span>
    <img class="shot" src="${esc(image)}" alt="${esc(title)}">
    <div class="b">${esc(brandLine)}</div>
    <div class="t">${esc(name)}</div>
    <div class="s">${esc(description)}</div>
    <a class="a" href="${esc(target)}">${esc(cta)}</a>
    <div class="hint">${esc(ctaSub)}</div>
    <a class="alt" href="${fr ? '/fr/catalog' : '/catalog'}">${esc(browse)}</a>
  </div>
</body>
</html>`;
}

module.exports = async (req, res) => {
  const q = req.query || {};
  const token = String(q.token || '');
  const lang = q.lang === 'fr' ? 'fr' : 'en';
  const catalogPath = lang === 'fr' ? '/fr/catalog' : '/catalog';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!TOKEN_RE.test(token)) return res.redirect(302, catalogPath);

  const share = await getJson(`${CRM}/api/shop/design-share/${encodeURIComponent(token)}`, 4000);
  // Dead or mistyped link: the catalog, not a 404. They came here to look at a
  // garment.
  if (!share || !share.product_id) return res.redirect(302, catalogPath);

  // Product is for the title and the price only — a share with no resolvable
  // product still has its mockup, so this failing must not lose the link.
  // Enrichment only: supplies price_from, and a colour fallback for older
  // rows created before the display fields were denormalised. Short leash.
  const cat = await getJson(
    `${CRM}/api/catalog?product_id=${encodeURIComponent(share.product_id)}&qty=${encodeURIComponent(share.qty || DEFAULT_QTY)}&limit=1`,
    2500,
  );
  const product = (cat && cat.products && cat.products[0]) || null;
  const color =
    product && share.color_id
      ? (product.colors || []).find((c) => String(c.color_id) === String(share.color_id)) || null
      : null;

  const designs = Array.isArray(share.designs) ? share.designs : [];
  // Front placements read best as a preview, so prefer one if we have it —
  // otherwise the first mockup recorded.
  const preferred =
    designs.find((d) => /front|chest/.test(String(d.placement || ''))) || designs[0] || null;
  const image =
    (preferred && preferred.mockup_url) ||
    (color && color.mockup_front_url) ||
    (product && product.hero_image_url) ||
    'https://www.singhsprint.com/images/product-tshirt-modavie.jpg';

  const params = new URLSearchParams({ design: token });
  const target = `${catalogPath}?${params.toString()}`;

  const host = req.headers['x-forwarded-host'] || req.headers.host || 'www.singhsprint.com';
  const canonical = `https://${String(host)}${lang === 'fr' ? '/fr' : ''}/d/${encodeURIComponent(token)}`;

  // A design share is immutable once created — the token maps to one fixed
  // set of mockups forever. The only thing that drifts is price_from, hence
  // the same 15-minute window /api/pricing promises.
  res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=86400');
  return res.status(200).send(pageHtml({ share, product, color, lang, canonical, target, image }));
};
