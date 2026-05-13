// Shared nav and footer for all Singhs Print pages
// Edit these once, changes apply everywhere.

function loadNav() {
  var el = document.getElementById('nav-placeholder');
  if (!el) return;

  // Inject nav styles once — ensures new pages (industries/, guides/, businesses/) render the nav
  // correctly without each page needing to duplicate nav CSS in their own <style> block.
  if (!document.getElementById('sp-nav-styles')) {
    var s = document.createElement('style');
    s.id = 'sp-nav-styles';
    s.textContent = ''
      + '.promo-bar{background:#e8ff3c;text-align:center;padding:10px 24px;font-weight:600;font-size:.9rem;color:#1a1a1a}'
      + '.promo-bar a{text-decoration:underline;font-weight:700;color:#1a1a1a}'
      + '.navbar{position:sticky;top:0;background:rgba(255,255,255,.97);backdrop-filter:blur(12px);z-index:1000;border-bottom:1px solid rgba(0,0,0,.06);padding:0 24px}'
      + '.navbar-inner{max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;height:72px}'
      + '.navbar .logo{display:flex;align-items:center}'
      + '.nav-links{display:flex;align-items:center;gap:32px}'
      + '.nav-links a{font-size:.95rem;font-weight:500;color:#555;text-decoration:none;transition:color .2s}'
      + '.nav-links a:hover{color:#1a1a1a}'
      + '.nav-cta{display:flex;align-items:center;gap:16px}'
      + '.nav-phone{font-weight:600;font-size:.95rem;color:#1a1a1a;text-decoration:none}'
      // .btn-sm style left intentionally unscoped here — each page defines .btn / .btn-primary
      // and applies them via the "btn btn-primary btn-sm" class. The size-only override below
      // matches the existing home page so existing pages are not visually shifted.
      + '.btn-sm{padding:12px 24px;font-size:.9rem}'
      // Fallback: if a page doesn\'t define .btn / .btn-primary (true for some new pages\' nav button),
      // we provide a minimal style so the "Get a Quote" CTA in the nav still renders correctly.
      + '.nav-cta .btn-sm{display:inline-flex;align-items:center;gap:6px;border-radius:50px;font-weight:600;text-decoration:none;background:#1a1a1a;color:#fff;border:none;transition:all .2s}'
      + '.nav-cta .btn-sm:hover{background:#333}'
      + '.mobile-toggle{display:none;flex-direction:column;gap:5px;padding:8px;background:none;border:none;cursor:pointer}'
      + '.mobile-toggle span{display:block;width:24px;height:2px;background:#1a1a1a}'
      + '@media(max-width:900px){.nav-links{display:none}.nav-links.active{display:flex;position:absolute;top:72px;right:0;left:0;background:#fff;flex-direction:column;padding:18px 24px;border-bottom:1px solid #eee;gap:12px}.mobile-toggle{display:flex}}';
    document.head.appendChild(s);
  }

  // Promo bar: campaign-aware — visitors arriving from the jealous-meme ad
  // see the price/timeline they were promised; everyone else sees the
  // default 15% off message.
  var promoHTML;
  try {
    var params = new URLSearchParams(window.location.search);
    var campaign = (params.get('utm_campaign') || '').toLowerCase();
    var content = (params.get('utm_content') || '').toLowerCase();
    var isJealousCampaign =
      campaign.indexOf('jealous') >= 0 ||
      content.indexOf('jealous') >= 0 ||
      campaign.indexOf('bulk_tees') >= 0;
    if (isJealousCampaign) {
      promoHTML = ''
        + '<div class="promo-bar" data-promo="jealous">'
        + '  <span>50 custom tees from <strong>$13.95 each</strong> &middot; quote back in 15 minutes during business hours.</span> <a href="/quote">Get your quote</a>'
        + '</div>';
    } else {
      promoHTML = ''
        + '<div class="promo-bar">'
        + '  <span data-i18n="promo">15% OFF your first order. No code needed.</span> <a href="/quote" data-i18n="promo.link">Get your quote</a>'
        + '</div>';
    }
  } catch (err) {
    promoHTML = ''
      + '<div class="promo-bar">'
      + '  <span data-i18n="promo">15% OFF your first order. No code needed.</span> <a href="/quote" data-i18n="promo.link">Get your quote</a>'
      + '</div>';
  }

  el.innerHTML = ''
    + promoHTML
    + '<nav class="navbar">'
    + '  <div class="navbar-inner">'
    + '    <a href="/" class="logo"><img src="/images/logo.png" alt="Singhs Print" style="height:52px;width:auto"></a>'
    + '    <div class="nav-links" id="navLinks">'
    + '      <a href="/catalog" data-i18n="nav.catalog">Catalog</a>'
    + '      <a href="/portfolio" data-i18n="nav.portfolio">Portfolio</a>'
    + '      <a href="/inkwear" data-i18n="nav.inkwear">Inkwear</a>'
    + '      <a href="/businesses" data-i18n="nav.businesses">For Businesses</a>'
    + '      <a href="/about" data-i18n="nav.about">About</a>'
    + '    </div>'
    + '    <div class="nav-cta">'
    + '      <a href="tel:5149151539" class="nav-phone">514-915-1539</a>'
    + '      <button id="langToggle" onclick="SP_LANG.toggleLang()" style="padding:8px 14px;border-radius:50px;border:1.5px solid #ddd;background:#fff;font-size:.8rem;font-weight:700;cursor:pointer;transition:all .2s;letter-spacing:1px">FR</button>'
    + '      <a href="/quote" class="btn btn-primary btn-sm" data-i18n="nav.quote">Get a Quote</a>'
    + '    </div>'
    + '    <button class="mobile-toggle" id="mobileToggle" aria-label="Menu">'
    + '      <span></span><span></span><span></span>'
    + '    </button>'
    + '  </div>'
    + '</nav>';

  // Wire up mobile menu toggle
  var toggle = document.getElementById('mobileToggle');
  if (toggle) {
    toggle.addEventListener('click', function() {
      document.getElementById('navLinks').classList.toggle('active');
    });
  }
}

function loadFooter() {
  var el = document.getElementById('footer-placeholder');
  if (!el) return;
  // Inject footer styles once — ensures new pages (industries/, guides/, businesses/) render the footer correctly
  // without each page needing to duplicate footer CSS in their own <style> block.
  if (!document.getElementById('sp-footer-styles')) {
    var s = document.createElement('style');
    s.id = 'sp-footer-styles';
    s.textContent = ''
      + '.footer{background:#0a0a0a;color:#fff;padding:60px 0 30px;margin-top:40px}'
      + '.footer .container{max-width:1200px;margin:0 auto;padding:0 24px}'
      + '.footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:40px}'
      + '.footer-brand .logo{font-family:"Playfair Display",serif;font-weight:900;font-size:1.5rem;line-height:1;color:#fff}'
      + '.footer-brand .logo span{display:block}'
      + '.footer-brand p{color:#999;font-size:.92rem;line-height:1.6;max-width:340px}'
      + '.footer-col h4{font-family:"Inter",sans-serif;font-size:.92rem;font-weight:700;margin-bottom:12px;color:#fff}'
      + '.footer-col a{display:block;font-size:.85rem;color:#999;padding:5px 0;text-decoration:none;transition:color .2s}'
      + '.footer-col a:hover{color:#e8ff3c}'
      + '.footer-bottom{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;padding-top:32px;margin-top:48px;border-top:1px solid #222;font-size:.8rem;color:#777}'
      + '@media(max-width:900px){.footer-grid{grid-template-columns:1fr 1fr !important}.footer-brand{grid-column:1/-1}}'
      + '@media(max-width:560px){.footer-grid{grid-template-columns:1fr !important}}';
    document.head.appendChild(s);
  }
  // data-nosnippet on the whole footer tells Google not to use any text in
  // here for SERP snippets. Previously Google's sitelink for guides was
  // scraping "514-915-1539sales@singhsprint.com@singhsprint on..." because
  // the <a> siblings extract as one continuous string.
  el.innerHTML = ''
    + '<footer class="footer" data-nosnippet>'
    + '  <div class="container">'
    + '    <div class="footer-grid" style="grid-template-columns:1.6fr 1fr 1fr 1fr 1fr">'
    + '      <div class="footer-brand">'
    + '        <div class="logo"><span>SINGHS</span><span>PRINT</span></div>'
    + '        <p style="margin-top:12px" data-i18n="footer.brand">Custom apparel printing in Montreal\'s West Island. DTG, DTF &amp; Embroidery for brands, businesses, and creators. Open 7 days, 9AM\u20139PM.</p>'
    + '      </div>'
    + '      <div class="footer-col"><h4 data-i18n="footer.pages">Pages</h4><a href="/" data-i18n="footer.home">Home</a><a href="/quote" data-i18n="footer.getquote">Get a Quote</a><a href="/portfolio" data-i18n="footer.portfolio">Portfolio</a><a href="/inkwear">Inkwear</a><a href="/about" data-i18n="footer.about">About</a></div>'
    + '      <div class="footer-col"><h4>For Businesses</h4><a href="/businesses">Volume pricing</a><a href="/businesses/rfp">Start an RFP</a><a href="/industries/construction-workwear">Construction</a><a href="/industries/restaurant-hospitality-uniforms">Restaurant &amp; hospitality</a><a href="/industries/corporate-tech-swag">Corporate &amp; tech</a><a href="/industries/charity-events-fundraisers">Charity &amp; events</a><a href="/industries/schools-sports-teams">Schools &amp; sports</a></div>'
    + '      <div class="footer-col"><h4>Guides</h4><a href="/guides/decoration-method-durability">Decoration durability</a><a href="/guides/procurement-checklist">Procurement checklist</a><a href="/guides/charity-run-timeline">Charity run timeline</a><a href="/guides/construction-crew-cost">Crew cost analysis</a><a href="/#services" data-i18n="footer.dtg">DTG, DTF &amp; embroidery</a></div>'
    + '      <div class="footer-col"><h4 data-i18n="footer.contact">Contact</h4><a href="tel:5149151539" aria-label="Call us at 514-915-1539">Call 514-915-1539</a><a href="mailto:sales@singhsprint.com" aria-label="Email sales@singhsprint.com">Email sales@singhsprint.com</a><a href="https://instagram.com/singhsprint" target="_blank" rel="noopener" aria-label="Follow on Instagram">Instagram @singhsprint</a><a href="https://maps.app.goo.gl/FX8o2QEvQzngxeiv7" target="_blank" rel="noopener" data-i18n="footer.location">West Island, Montreal</a></div>'
    + '    </div>'
    + '    <div class="footer-bottom">'
    + '      <span>&copy; <span data-i18n="footer.rights">2026 Imprimerie Singhs Print &middot; NEQ 1181573313</span></span>'
    + '      <span data-i18n="footer.tagline">Custom Apparel Printing | Montreal, QC</span>'
    + '      <a href="https://singhsprint-crm.vercel.app/login" style="font-size:.75rem;color:#777;font-weight:500;opacity:.7;transition:opacity .2s" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=.7" data-i18n="nav.login">Login</a>'
    + '    </div>'
    + '  </div>'
    + '</footer>';
}

// Inject sitewide LocalBusiness + Service schema for SEO + rich-result eligibility.
// Real values pulled from Imprimerie Singhs Print GBP listing + legal entity records.
// Legal entity: 95558110 QUEBEC INC.  NEQ: 1181573313.
// GST: 71581 7169 RT0001  |  QST: 1233348101 TQ0001
// Inject Google Search Console verification tag sitewide.
function loadSearchConsoleVerification() {
  if (document.getElementById('gsc-verify')) return;
  var meta = document.createElement('meta');
  meta.id = 'gsc-verify';
  meta.name = 'google-site-verification';
  meta.content = 'T6ALkpsK-HLL-gl9L-i_rCc-V6-WxEzwsupcnFELLWo';
  document.head.appendChild(meta);
}

function loadSchema() {
  if (document.getElementById('singhsprint-schema')) return;
  var schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ClothingStore",
        "@id": "https://www.singhsprint.com/#business",
        "name": "Imprimerie Singhs Print",
        "alternateName": ["Singhs Print", "95558110 QUEBEC INC"],
        "legalName": "95558110 QUEBEC INC",
        "vatID": "1181573313",
        "image": "https://www.singhsprint.com/images/storefront.jpg",
        "logo": "https://www.singhsprint.com/images/logo.png",
        "url": "https://www.singhsprint.com/",
        "telephone": "+1-514-915-1539",
        "email": "sales@singhsprint.com",
        "priceRange": "$$",
        "description": "Montreal custom apparel printer specializing in bulk workwear, staff uniforms, corporate swag, and event merchandise. DTG, DTF, and embroidery decoration. Quebec-registered NEQ 1181573313.",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "81A Sainte Anne St",
          "addressLocality": "Sainte-Anne-de-Bellevue",
          "addressRegion": "QC",
          "postalCode": "H9X 1L9",
          "addressCountry": "CA"
        },
        "geo": { "@type": "GeoCoordinates", "latitude": "45.4042", "longitude": "-73.9485" },
        "openingHoursSpecification": [{
          "@type": "OpeningHoursSpecification",
          "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
          "opens": "09:00",
          "closes": "21:00"
        }],
        "identifier": [
          { "@type": "PropertyValue", "propertyID": "NEQ", "value": "1181573313" },
          { "@type": "PropertyValue", "propertyID": "GST", "value": "71581 7169 RT0001" },
          { "@type": "PropertyValue", "propertyID": "QST", "value": "1233348101 TQ0001" }
        ],
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": "5.0",
          "reviewCount": "25",
          "bestRating": "5"
        },
        "areaServed": [
          { "@type": "City", "name": "Montreal" },
          { "@type": "City", "name": "Laval" },
          { "@type": "City", "name": "Longueuil" },
          { "@type": "AdministrativeArea", "name": "West Island" }
        ],
        "sameAs": ["https://www.instagram.com/singhsprint"],
        "makesOffer": [
          { "@type": "Offer", "name": "Custom T-Shirt Printing — Bulk",
            "priceSpecification": { "@type": "UnitPriceSpecification", "price": "9.95", "priceCurrency": "CAD", "unitText": "per unit at 250+ qty", "minPrice": "9.95", "maxPrice": "29.95" } },
          { "@type": "Offer", "name": "Custom Hoodie Printing — Bulk",
            "priceSpecification": { "@type": "UnitPriceSpecification", "price": "24.95", "priceCurrency": "CAD", "unitText": "per unit at 200+ qty", "minPrice": "24.95", "maxPrice": "49.95" } },
          { "@type": "Offer", "name": "Embroidered Caps & Toques — Bulk",
            "priceSpecification": { "@type": "UnitPriceSpecification", "price": "15.95", "priceCurrency": "CAD", "unitText": "per unit at 200+ qty", "minPrice": "15.95", "maxPrice": "32.95" } },
          { "@type": "Offer", "name": "Long-Sleeve Bulk Printing",
            "priceSpecification": { "@type": "UnitPriceSpecification", "price": "13.95", "priceCurrency": "CAD", "unitText": "per unit at 200+ qty", "minPrice": "13.95", "maxPrice": "36.95" } }
        ]
      },
      {
        "@type": "Service",
        "@id": "https://www.singhsprint.com/#uniform-program",
        "name": "Managed Uniform Program",
        "provider": { "@id": "https://www.singhsprint.com/#business" },
        "areaServed": { "@type": "City", "name": "Montreal" },
        "serviceType": "Custom apparel program for corporate, hospitality, construction, school, and event clients",
        "termsOfService": "50% deposit to start production, balance Net 30. Better terms available for repeat accounts and standing programs.",
        "hasOfferCatalog": {
          "@type": "OfferCatalog",
          "name": "Industry uniform programs",
          "itemListElement": [
            { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Construction & Trades Workwear" } },
            { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Restaurant & Hospitality Staff Uniforms" } },
            { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Corporate Onboarding & Tech Swag" } },
            { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Charity Run & Event Apparel" } },
            { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "School & Sports Team Spirit Wear" } }
          ]
        }
      }
    ]
  };
  var s = document.createElement('script');
  s.type = 'application/ld+json';
  s.id = 'singhsprint-schema';
  s.textContent = JSON.stringify(schema);
  document.head.appendChild(s);
}

// Auto-run when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  loadSearchConsoleVerification();
  loadNav();
  loadFooter();
  loadSchema();
});
