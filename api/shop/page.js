/* =========================================================================
 * GET /api/shop/page?slug=<slug>
 *
 * Server-rendered HTML for /shop/{slug}. Reached via the vercel.json
 * rewrite { "/shop/:slug" → "/api/shop/page?slug=:slug" }.
 *
 * Server-rendered (not static or client-fetch) so that Meta link previews
 * pick up the correct Open Graph image and title when the URL is shared
 * or used in an ad. The page itself is intentionally simple — one image,
 * one title, one price, one "Buy now" button that POSTs to /api/shop/checkout.
 *
 * Returns:
 *   200 → full HTML page
 *   404 → drop not found / not live
 * ========================================================================= */

const { adminClient } = require('../_lib/supabase');

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPrice(cents, currency) {
  const major = (cents / 100).toFixed(2);
  return `$${major} ${currency || 'CAD'}`;
}

// Parse a supplier description into spec bullets. Handles HTML <li> lists and
// plain-text (split on bullets / newlines / sentence boundaries).
function parseSpecBullets(desc) {
  if (!desc) return [];
  const s = String(desc);
  const li = s.match(/<li[^>]*>([\s\S]*?)<\/li>/gi);
  if (li && li.length) {
    return li.map((x) => x.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()).filter(Boolean);
  }
  const text = s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return [];
  const parts = text.split(/\s*[••\n;]\s*|\.\s+(?=[A-Z0-9])/).map((x) => x.trim()).filter(Boolean);
  return parts.length > 1 ? parts.slice(0, 12) : [text];
}

function notFoundHtml() {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><title>Drop not found · Singhs Print</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:Inter,system-ui,sans-serif;max-width:560px;margin:120px auto;padding:0 24px;color:#1a1a1a;text-align:center}
a{color:#1a1a1a}</style></head><body>
<h1>Drop not found</h1>
<p>This drop isn't live, or the link is wrong. <a href="/shop">See active drops →</a></p>
</body></html>`;
}

function pageHtml(drop, siteUrl, images, specs, remaining, soldOut) {
  const url   = `${siteUrl}/shop/${encodeURIComponent(drop.slug)}`;
  const price = formatPrice(drop.retail_price_cents, drop.currency);
  const stockLabel = soldOut ? 'Sold out'
    : (remaining != null && remaining <= 10 ? `Only ${remaining} left` : '');
  const imgs  = (images && images.length) ? images : (drop.mockup_url ? [drop.mockup_url] : []);
  const hero  = imgs[0] || '';
  const specBullets = specs ? parseSpecBullets(specs.description) : [];
  const blankLine = specs
    ? [specs.brand, specs.style_number].filter(Boolean).join(' ') + (specs.color_name ? ' — ' + specs.color_name : '')
    : (drop.blank_label || '');
  const metaBits = specs
    ? [specs.weight_oz ? specs.weight_oz + ' oz' : null, specs.fabric, specs.gender, specs.garment_type].filter(Boolean)
    : [];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(drop.title)} · Singhs Print</title>
  <meta name="description" content="${esc(drop.description || drop.title + ' — limited drop from Singhs Print.')}">
  <link rel="icon" href="/favicon.ico">
  <link rel="apple-touch-icon" href="/images/favicon-180.png">

  <!-- Open Graph / Meta link preview -->
  <meta property="og:type" content="product">
  <meta property="og:title" content="${esc(drop.title)}">
  <meta property="og:description" content="${esc(drop.description || drop.title + ' — limited drop from Singhs Print.')}">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:image" content="${esc(drop.mockup_url)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(drop.title)}">
  <meta name="twitter:image" content="${esc(drop.mockup_url)}">

  <!-- Product structured data -->
  <script type="application/ld+json">${JSON.stringify({
    "@context":   "https://schema.org",
    "@type":      "Product",
    name:         drop.title,
    image:        drop.mockup_url,
    description:  drop.description || `${drop.title} — limited drop from Singhs Print.`,
    sku:          drop.slug,
    brand:        { "@type": "Brand", name: "Singhs Print" },
    offers: {
      "@type":         "Offer",
      url,
      priceCurrency:   drop.currency || "CAD",
      price:           (drop.retail_price_cents / 100).toFixed(2),
      availability:    soldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      itemCondition:   "https://schema.org/NewCondition",
    },
  })}</script>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@700;800;900&display=swap" rel="stylesheet">

  <!-- Meta Pixel base — same pattern as /industries/*.html and /businesses/rfp.html.
       Pixel ID is the production "Singhs Print Quote" dataset. Server-side CAPI
       Purchase events fire from api/account/stripe-webhook.js with deterministic
       event_id derived from the Stripe session, so dedup works even if the
       customer never returns to /shop/{slug}?paid=1. -->
  <script>
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '1198620955711122');
    fbq('track', 'PageView');
    fbq('track', 'ViewContent', { content_ids: ['${esc(drop.slug)}'], content_type: 'product', content_name: ${JSON.stringify(drop.title)}, value: ${(drop.retail_price_cents / 100).toFixed(2)}, currency: '${esc(drop.currency || 'CAD')}' });
  </script>

  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    html{scroll-behavior:smooth}
    body{font-family:'Inter',-apple-system,sans-serif;color:#1a1a1a;background:#fafafa;line-height:1.6;-webkit-font-smoothing:antialiased;min-height:100vh}
    img{max-width:100%;height:auto;display:block}
    a{text-decoration:none;color:inherit}

    .topbar{background:#0a0a0a;color:#fff;padding:16px 24px;display:flex;justify-content:space-between;align-items:center}
    .topbar a{font-weight:600;font-size:.95rem}
    .topbar .left{display:flex;gap:24px;align-items:center}
    .topbar .brand{font-family:'Playfair Display',serif;font-size:1.25rem;font-weight:800;letter-spacing:-.5px}
    .topbar .pill{background:#e8ff3c;color:#0a0a0a;padding:4px 10px;border-radius:999px;font-size:.75rem;font-weight:700;letter-spacing:1px}

    .wrap{max-width:1100px;margin:0 auto;padding:48px 24px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start}
    @media (max-width:780px){.grid{grid-template-columns:1fr;gap:32px}.wrap{padding:24px}}

    .media{background:transparent}
    .media>#mainImg{width:100%;aspect-ratio:1/1;object-fit:cover;background:#f0f0f0;border-radius:18px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
    .thumbs{display:flex;gap:10px;margin-top:12px;flex-wrap:wrap}
    .thumb{padding:0;border:2px solid transparent;border-radius:12px;overflow:hidden;cursor:pointer;background:#fff;width:72px;height:72px;flex:0 0 auto}
    .thumb img{width:100%;height:100%;object-fit:cover;background:#f0f0f0}
    .thumb.active{border-color:#1a1a1a}

    .info h1{font-family:'Playfair Display',serif;font-size:clamp(2rem,4vw,2.75rem);font-weight:800;line-height:1.1;margin-bottom:16px}
    .info .price{font-size:1.5rem;font-weight:700;margin-bottom:16px}
    .info .specmeta{font-size:.95rem;color:#555;margin-bottom:24px}
    .info .stock{display:inline-block;font-size:.85rem;font-weight:700;margin-bottom:16px;padding:4px 12px;border-radius:999px;background:#fff3cd;color:#8a6d00}
    .info .stock.soldout{background:#fde2e1;color:#b00020}
    .buy:disabled{opacity:.55;cursor:not-allowed;transform:none;box-shadow:none}
    .info .desc{font-size:1.05rem;color:#444;margin-bottom:32px;white-space:pre-wrap}
    .info .blank{font-size:.85rem;color:#888;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;font-weight:700}

    .specs{margin-top:32px;border-top:1px solid #eee;padding-top:24px}
    .specs-head{font-size:.8rem;letter-spacing:1.5px;text-transform:uppercase;color:#888;font-weight:700;margin-bottom:12px}
    .specs ul{list-style:none;display:flex;flex-direction:column;gap:8px}
    .specs li{position:relative;padding-left:18px;font-size:.95rem;color:#444;line-height:1.5}
    .specs li::before{content:"•";position:absolute;left:2px;color:#999}

    .buy{background:#1a1a1a;color:#fff;border:0;padding:18px 36px;border-radius:50px;font-size:1.05rem;font-weight:600;cursor:pointer;transition:all .25s;width:100%;max-width:320px;font-family:inherit}
    .buy:hover:not(:disabled){background:#333;transform:translateY(-2px);box-shadow:0 8px 25px rgba(0,0,0,.15)}
    .buy:disabled{opacity:.6;cursor:wait}

    .meta{margin-top:32px;font-size:.85rem;color:#666;display:flex;flex-wrap:wrap;gap:16px}
    .meta span::before{content:"✓ ";color:#0a7f3f;font-weight:700}

    .paid-banner{background:#e6f7ed;border:1px solid #0a7f3f;color:#0a4720;padding:20px 24px;border-radius:14px;margin-bottom:32px}
    .paid-banner strong{display:block;margin-bottom:4px;font-size:1.1rem}
    .cancel-banner{background:#fff7e0;border:1px solid #b88a00;color:#5a4400;padding:16px 20px;border-radius:14px;margin-bottom:32px;font-size:.95rem}

    .err{color:#b00020;font-size:.9rem;margin-top:12px;min-height:1.2em}
  </style>
</head>
<body>
  <div class="topbar">
    <div class="left">
      <a class="brand" href="/">Singhs Print</a>
      <a href="/shop">Drops</a>
    </div>
    <a href="/">Back to site →</a>
  </div>

  <main class="wrap">
    <div id="paidBanner" class="paid-banner" style="display:none">
      <strong>Thanks — your order is in.</strong>
      We'll email you a confirmation and a tracking number once it ships.
    </div>
    <div id="cancelBanner" class="cancel-banner" style="display:none">
      Checkout was cancelled. No charge was made.
    </div>

    <div class="grid">
      <div class="media">
        <img id="mainImg" src="${esc(hero)}" alt="${esc(drop.title)}">
        ${imgs.length > 1 ? `<div class="thumbs">${imgs.map((u, i) => `<button class="thumb${i === 0 ? ' active' : ''}" data-src="${esc(u)}" aria-label="View ${i + 1}"><img src="${esc(u)}" alt=""></button>`).join('')}</div>` : ''}
      </div>
      <div class="info">
        ${blankLine ? `<div class="blank">${esc(blankLine)}</div>` : ''}
        <h1>${esc(drop.title)}</h1>
        <div class="price">${esc(price)}</div>
        ${stockLabel ? `<div class="stock${soldOut ? ' soldout' : ''}">${esc(stockLabel)}</div>` : ''}
        ${metaBits.length ? `<div class="specmeta">${metaBits.map((b) => esc(b)).join('  ·  ')}</div>` : ''}
        ${drop.description ? `<div class="desc">${esc(drop.description)}</div>` : ''}
        <button id="buyBtn" class="buy" data-drop-id="${esc(drop.id)}"${soldOut ? ' disabled' : ''}>${soldOut ? 'Sold out' : 'Buy now'}</button>
        <div id="err" class="err"></div>
        <div class="meta">
          <span>Ships from Montréal</span>
          <span>3–7 business days</span>
          <span>Secure checkout</span>
        </div>
        <div style="margin-top:18px;font-size:.85rem;color:#888">
          Final sale. Defects reprinted at no charge — see <a href="/shop/policies" style="color:#1a1a1a;text-decoration:underline">shipping &amp; refund policy</a>.
        </div>
        ${specBullets.length ? `
        <div class="specs">
          <div class="specs-head">Tech specs${specs && specs.name ? ' · ' + esc(specs.name) : ''}</div>
          <ul>${specBullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
        </div>` : ''}
      </div>
    </div>
  </main>

  <script>
    (function() {
      const url = new URL(window.location.href);
      if (url.searchParams.get('paid') === '1') {
        document.getElementById('paidBanner').style.display = 'block';
        // NOTE: client-side Purchase fire intentionally omitted. The server
        // fires Purchase via /api/meta-capi from the Stripe webhook with a
        // deterministic event_id derived from the Stripe session. That fires
        // reliably even if the customer never makes it back to this page
        // (closed tab, slow redirect, etc.). iOS-14+ users benefit most.
      }
      if (url.searchParams.get('cancel') === '1') {
        document.getElementById('cancelBanner').style.display = 'block';
      }
      // Image gallery: click a thumbnail to swap the main image.
      var mainImg = document.getElementById('mainImg');
      document.querySelectorAll('.thumb').forEach(function (t) {
        t.addEventListener('click', function () {
          if (mainImg) mainImg.src = t.dataset.src;
          document.querySelectorAll('.thumb').forEach(function (x) { x.classList.remove('active'); });
          t.classList.add('active');
        });
      });
      const btn = document.getElementById('buyBtn');
      const err = document.getElementById('err');
      btn.addEventListener('click', async () => {
        err.textContent = '';
        btn.disabled = true;
        btn.textContent = 'Loading…';
        try {
          const resp = await fetch('/api/shop/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ drop_id: btn.dataset.dropId })
          });
          const json = await resp.json();
          if (!resp.ok || !json.url) throw new Error(json.error || 'checkout failed');
          if (window.fbq) {
            try { window.fbq('track', 'InitiateCheckout', { value: ${(drop.retail_price_cents / 100).toFixed(2)}, currency: '${esc(drop.currency || 'CAD')}', content_ids: ['${esc(drop.slug)}'] }); } catch(e) {}
          }
          window.location.href = json.url;
        } catch (e) {
          err.textContent = e.message || 'Something went wrong. Please try again.';
          btn.disabled = false;
          btn.textContent = 'Buy now';
        }
      });
    })();
  </script>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method Not Allowed');
  }

  const slug = (req.query?.slug || '').toString().trim().toLowerCase();
  if (!slug) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(notFoundHtml());
  }

  try {
    const supabase = adminClient();
    const { data: drop, error } = await supabase
      .from('drops')
      .select('id, slug, title, description, mockup_url, blank_label, color_id, gallery_urls, inventory_limit, retail_price_cents, currency, status')
      .eq('slug', slug)
      .eq('status', 'live')
      .maybeSingle();
    if (error) throw error;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (!drop) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(404).send(notFoundHtml());
    }

    // Limited-run stock: count paid orders against inventory_limit (null = unlimited).
    let remaining = null;
    let soldOut = false;
    if (drop.inventory_limit != null) {
      const { count } = await supabase
        .from('drop_orders')
        .select('id', { count: 'exact', head: true })
        .eq('drop_id', drop.id)
        .in('status', ['paid', 'fulfilled']);
      remaining = Math.max(0, drop.inventory_limit - (count || 0));
      soldOut = remaining <= 0;
    }

    // Per-side composited mockups (front/back/sleeve) for the image gallery.
    const { data: sides } = await supabase
      .from('drop_mockups')
      .select('mockup_url, sort_index')
      .eq('drop_id', drop.id)
      .not('mockup_url', 'is', null)
      .order('sort_index', { ascending: true });

    // Blank tech specs + garment photos (front/back/side) via the chosen colour.
    let colorRow = null;
    if (drop.color_id) {
      const { data: pc } = await supabase
        .from('product_colors')
        .select('color_name, mockup_front_url, mockup_back_url, mockup_side_url, products!inner ( brand, style_number, name, garment_type, gender, weight_oz, fabric, description )')
        .eq('id', drop.color_id)
        .maybeSingle();
      colorRow = pc || null;
    }
    const product = colorRow && colorRow.products
      ? (Array.isArray(colorRow.products) ? colorRow.products[0] : colorRow.products)
      : null;

    // Image gallery: hero composite, then other composited sides, then operator
    // lifestyle photos, then the blank's back/side studio photos (the rear view).
    const sideUrls    = (sides || []).map((s) => s.mockup_url).filter(Boolean);
    const galleryUrls = Array.isArray(drop.gallery_urls) ? drop.gallery_urls : [];
    const blankPhotos = colorRow ? [colorRow.mockup_back_url, colorRow.mockup_side_url].filter(Boolean) : [];
    const images = Array.from(new Set(
      [drop.mockup_url, ...sideUrls, ...galleryUrls, ...blankPhotos].filter(Boolean),
    )).slice(0, 8);

    const specs = product ? {
      brand: product.brand, style_number: product.style_number, name: product.name,
      garment_type: product.garment_type, gender: product.gender,
      weight_oz: product.weight_oz, fabric: product.fabric, description: product.description,
      color_name: colorRow.color_name,
    } : null;

    const base = process.env.PUBLIC_SITE_URL || process.env.SITE_URL || `https://${req.headers.host || 'singhsprint.com'}`;
    // Short cache: drop edits (price, description) should appear within a minute.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).send(pageHtml(drop, base, images, specs, remaining, soldOut));
  } catch (e) {
    console.error('[/api/shop/page]', e);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(notFoundHtml());
  }
};
