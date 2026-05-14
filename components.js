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
      + '.promo-bar{background:#e8ff3c;text-align:center;padding:10px 24px;font-weight:600;font-size:.9rem;color:#1a1a1a;line-height:1.4}'
      + '.promo-bar a{text-decoration:underline;font-weight:700;color:#1a1a1a}'
      + '.navbar{position:sticky;top:0;background:rgba(255,255,255,.97);backdrop-filter:blur(12px);z-index:1000;border-bottom:1px solid rgba(0,0,0,.06);padding:0 24px}'
      + '.navbar-inner{max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;height:72px;gap:12px}'
      + '.navbar .logo{display:flex;align-items:center;flex-shrink:0}'
      + '.navbar .logo img{height:52px;width:auto;transition:height .2s}'
      + '.nav-links{display:flex;align-items:center;gap:32px}'
      + '.nav-links a{font-size:.95rem;font-weight:500;color:#555;text-decoration:none;transition:color .2s}'
      + '.nav-links a:hover{color:#1a1a1a}'
      + '.nav-cta{display:flex;align-items:center;gap:12px;flex-shrink:0}'
      + '.nav-phone{font-weight:600;font-size:.95rem;color:#1a1a1a;text-decoration:none;display:inline-flex;align-items:center;gap:6px;padding:6px 8px;border-radius:50px;transition:background .15s}'
      + '.nav-phone:hover{background:#f4f2eb}'
      + '.nav-phone__icon{display:none;width:18px;height:18px}'
      + '.btn-sm{padding:12px 24px;font-size:.9rem}'
      + '.nav-cta .btn-sm{display:inline-flex;align-items:center;gap:6px;border-radius:50px;font-weight:600;text-decoration:none;background:#1a1a1a;color:#fff;border:none;transition:all .2s}'
      + '.nav-cta .btn-sm:hover{background:#333}'
      + '#langToggle{padding:8px 14px;border-radius:50px;border:1.5px solid #ddd;background:#fff;font-size:.8rem;font-weight:700;cursor:pointer;transition:all .2s;letter-spacing:1px;flex-shrink:0}'
      + '.mobile-toggle{display:none;flex-direction:column;gap:5px;padding:8px;background:none;border:none;cursor:pointer;flex-shrink:0}'
      + '.mobile-toggle span{display:block;width:24px;height:2px;background:#1a1a1a;transition:transform .2s}'
      // Mobile menu items injected only on the dropdown when nav-links collapses
      + '.nav-mobile-extras{display:none;border-top:1px solid #eee;padding-top:14px;margin-top:8px;font-size:.85rem;color:#666}'
      + '.nav-mobile-extras a{display:block;padding:6px 0;color:#1a1a1a;font-weight:600;text-decoration:none}'
      // ≤900px: hide desktop nav-links, show hamburger, swap phone number for icon
      + '@media(max-width:900px){'
      +   '.navbar{padding:0 16px}'
      +   '.navbar-inner{height:60px}'
      +   '.navbar .logo img{height:38px}'
      +   '.nav-links{display:none}'
      +   '.nav-links.active{display:flex;position:absolute;top:60px;right:0;left:0;background:#fff;flex-direction:column;padding:18px 20px 22px;border-bottom:1px solid #eee;gap:8px;box-shadow:0 12px 28px rgba(0,0,0,.08)}'
      // Plain nav links inherit dark ink text. Use :not(.btn) so we DON\'T
      // clobber the white "Get a Quote" button text inside the drawer.
      +   '.nav-links.active a:not(.btn){padding:10px 0;font-size:1.05rem;font-weight:600;color:#1a1a1a}'
      // Explicit win for the primary CTA button inside the drawer:
      // dark background + white text + decent tap target on mobile.
      +   '.nav-links.active a.btn,.nav-links.active a.btn-primary,.nav-mobile-extras a.btn,.nav-mobile-extras a.btn-primary{background:#1a1a1a !important;color:#fff !important;display:block;text-align:center;padding:13px 18px !important;border-radius:50px;font-size:1rem;font-weight:700;text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,.15)}'
      +   '.nav-links.active a.btn:hover,.nav-mobile-extras a.btn:hover{background:#333 !important}'
      +   '.nav-links.active .nav-mobile-extras{display:block}'
      +   '.mobile-toggle{display:flex}'
      +   '.nav-cta{gap:6px}'
      +   '.nav-phone__icon{display:inline-block}'
      +   '.nav-phone__text{display:none}'
      +   '.nav-phone{padding:8px;border:1.5px solid #ddd}'
      +   '#langToggle{padding:7px 11px;font-size:.74rem}'
      +   '.nav-cta .btn-sm{padding:9px 14px;font-size:.82rem}'
      + '}'
      // ≤420px: shed the inline "Get a Quote" — it lives inside the hamburger menu now
      + '@media(max-width:420px){'
      +   '.promo-bar{padding:8px 14px;font-size:.78rem}'
      +   '.nav-cta .btn-sm.btn-quote-inline{display:none}'
      + '}';
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

  // SVG phone icon — inline so we don't ship an extra request for ~250 bytes
  var phoneIconSvg = '<svg class="nav-phone__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';

  el.innerHTML = ''
    + promoHTML
    + '<nav class="navbar">'
    + '  <div class="navbar-inner">'
    + '    <a href="/" class="logo"><img src="/images/logo.png" alt="Singhs Print"></a>'
    + '    <div class="nav-links" id="navLinks">'
    + '      <a href="/catalog" data-i18n="nav.catalog">Catalog</a>'
    + '      <a href="/portfolio" data-i18n="nav.portfolio">Portfolio</a>'
    + '      <a href="/inkwear" data-i18n="nav.inkwear">Inkwear</a>'
    + '      <a href="/businesses" data-i18n="nav.businesses">For Businesses</a>'
    + '      <a href="/about" data-i18n="nav.about">About</a>'
    // Extras only visible inside the dropdown on mobile (≤900px). Gives
    // touch users a tap-target for the phone number + Get a Quote even
    // when the inline button is hidden.
    + '      <div class="nav-mobile-extras">'
    + '        <a href="/quote" class="btn btn-primary btn-sm" data-i18n="nav.quote" style="display:block;text-align:center;margin-bottom:10px">Get a Quote</a>'
    + '        <a href="tel:5149151539">Call 514-915-1539</a>'
    + '        <a href="mailto:sales@singhsprint.com">Email sales@singhsprint.com</a>'
    + '      </div>'
    + '    </div>'
    + '    <div class="nav-cta">'
    + '      <a href="tel:5149151539" class="nav-phone" aria-label="Call us at 514-915-1539">'
    +          phoneIconSvg
    + '        <span class="nav-phone__text">514-915-1539</span>'
    + '      </a>'
    + '      <button id="langToggle" onclick="SP_LANG.toggleLang()">FR</button>'
    + '      <a href="/quote" class="btn btn-primary btn-sm btn-quote-inline" data-i18n="nav.quote">Get a Quote</a>'
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
      + '@media(max-width:900px){.footer{padding:48px 0 24px}.footer-grid{grid-template-columns:1fr 1fr !important;gap:28px}.footer-brand{grid-column:1/-1}}'
      + '@media(max-width:560px){.footer-grid{grid-template-columns:1fr !important;gap:24px}.footer-col h4{font-size:.86rem}.footer-col a{font-size:.92rem;padding:8px 0}.footer-bottom{margin-top:32px;padding-top:24px;font-size:.74rem}}'
      // Bilingual notice block — shown only when html lang is set to FR.
      // Industry + guide pages use this to flag that the long-form body
      // hasn't been translated yet.
      + '.lang-fr-notice{display:none}'
      + 'html[lang="fr"] .lang-fr-notice{display:block;background:#fffbe6;border:1px solid #f0d56b;color:#5a4a13;padding:14px 18px;border-radius:12px;margin:18px auto;max-width:820px;font-size:.92rem;line-height:1.55}';
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

// =====================================================================
// Sitewide mobile simplification — injected once on every page.
//
// Brand cues we PRESERVE:
//   • Playfair Display for headings, Inter for body
//   • Highlight yellow (#e8ff3c) for accents
//   • Ink #1a1a1a / cream #fafaf7 / soft #888 palette
//   • Conversational copy, generous serif headlines on desktop
//
// What this trims on phones:
//   • Section vertical padding: 60–80px → 32–44px
//   • H1/H2 capped via clamp() so they don't dwarf the viewport
//   • Multi-col grids → 1–2 col stacks
//   • Card padding tightened
//   • Eyebrow labels shrunk so they whisper, not shout
//   • Hero photo aspect cropped slightly on tiny screens
//   • Sticky bars get safe-area bottom inset on notched phones
// =====================================================================
function loadMobileTrim() {
  if (document.getElementById('sp-mobile-trim')) return;
  var s = document.createElement('style');
  s.id = 'sp-mobile-trim';
  s.textContent = ''
    // -------- Phones (≤ 480px) --------
    + '@media (max-width:480px){'
    +   '.section,section.section{padding:32px 0 !important}'
    // Headings: tighter scale + balance
    +   'h1{font-size:clamp(1.9rem,7vw,2.6rem) !important;line-height:1.15 !important;text-wrap:balance}'
    +   'h2{font-size:clamp(1.45rem,5.2vw,1.95rem) !important;line-height:1.2 !important;text-wrap:balance}'
    +   'h3{font-size:clamp(1.05rem,4vw,1.25rem) !important;line-height:1.25 !important}'
    +   '.label,.eyebrow{font-size:.66rem !important;letter-spacing:.08em !important}'
    +   '.subhead{font-size:.95rem !important;line-height:1.55 !important;max-width:none !important}'
    // Containers — a hair tighter so cards reach the screen edge cleanly
    +   '.container{padding-left:18px !important;padding-right:18px !important}'
    // Buttons: chunky enough to tap, not so big they dominate
    +   '.btn{padding:11px 20px !important;font-size:.92rem !important}'
    +   '.btn-sm{padding:9px 16px !important;font-size:.85rem !important}'
    +   '.cta-buttons{gap:8px !important;flex-wrap:wrap}'
    +   '.cta-buttons .btn{flex:1 1 auto;min-width:140px;justify-content:center}'
    // Card padding generally chiller on phones
    +   '.card,.review-card,.why-card,.service-card,.segment-card,.form-card{padding:18px !important}'
    +   '.review-card p{font-size:.88rem !important;line-height:1.55 !important}'
    // Grids: anything ≥3-col collapses to 1 or 2 on phones
    +   '.services-grid,.process-grid,.why-grid,.win-grid,.two-col,.benefits-grid{grid-template-columns:1fr !important;gap:14px !important}'
    +   '.segments-grid,.reviews-grid{grid-template-columns:1fr !important;gap:14px !important}'
    // Forms — less white space inside dense steps
    +   '.form-row{grid-template-columns:1fr !important;gap:10px !important}'
    +   'input[type="text"],input[type="email"],input[type="tel"],input[type="number"],input[type="date"],select,textarea{font-size:16px !important}'  // iOS won't zoom on focus
    // Sticky bottom bars respect notched phone home-indicator
    +   '.sticky-cta,.cart-bar,#cartBar{padding-bottom:calc(12px + env(safe-area-inset-bottom)) !important}'
    // Live-price strip on the quote page floats at the bottom of the
    // viewport on mobile so the customer always sees their current
    // per-unit + total while filling out the form. Pattern source:
    // Stripe Checkout floor, Shopify cart drawer.
    +   '#livePriceStrip[style*="display: block"],#livePriceStrip[style*="display:block"]{'
    +     'position:fixed !important;left:12px !important;right:12px !important;bottom:0 !important;'
    +     'margin:0 !important;z-index:990;'
    +     'padding:12px 14px calc(12px + env(safe-area-inset-bottom)) !important;'
    +     'border-radius:14px 14px 0 0 !important;'
    +     'box-shadow:0 -8px 24px rgba(0,0,0,.18) !important;'
    +     'max-height:30vh;overflow:hidden;'
    +   '}'
    // When strip is sticky at the bottom, pad the form so the last
    // button isn't trapped under the strip.
    +   '.form-section,.form-card{padding-bottom:calc(120px + env(safe-area-inset-bottom)) !important}'
    // Tighten the strip's internal text on phones.
    +   '#livePriceStrip > div[style*="font-size:.7rem"]{margin-bottom:2px !important}'
    +   '#livePriceUnit{font-size:1.2rem !important}'
    +   '#livePriceTotal{font-size:1.4rem !important}'
    +   '#livePriceStrip [style*="margin-top:10px"]{display:none !important}'  // hide the long disclaimer
    // Hero — universal trim for any page with a hero block
    +   '.hero{padding:24px 0 36px !important}'
    +   '.hero .subhead{margin-bottom:18px !important}'
    +   '.hero-buttons{margin-bottom:16px !important}'
    // Trust-bar duplicates the proof-bar — both communicate "real
    // customers trust us" on a viewport where attention is precious.
    // Keep the proof-bar's hard numbers, hide the client-name strip
    // on phones. Brand names still surface in the reviews + portfolio.
    +   '.trust-bar{display:none !important}'
    // ---------- iOS-style scroll-snap carousels ----------
    // 8 product cards × 2-col grid = ~1,400px of scroll. As a
    // horizontal carousel it's ~340px and reads as native (App Store
    // / Apple Music pattern). Same treatment for the 3 service cards
    // and 6 why-us cards. Each card is sized to leave a peek of the
    // next so users instantly recognize it as swipeable.
    +   '.products-grid,.services-grid,.why-grid{'
    +     'display:flex !important;'
    +     'overflow-x:auto;overflow-y:visible;'
    +     'scroll-snap-type:x mandatory;'
    +     '-webkit-overflow-scrolling:touch;'
    +     'scroll-padding:0 18px;'
    +     'gap:12px !important;'
    +     'padding:6px 18px 14px !important;'
    +     'margin:0 -18px !important;'
    +     'scrollbar-width:none;'
    +     'grid-template-columns:none !important;'
    +   '}'
    +   '.products-grid::-webkit-scrollbar,.services-grid::-webkit-scrollbar,.why-grid::-webkit-scrollbar{display:none}'
    +   '.products-grid > *,.services-grid > *,.why-grid > *{'
    +     'flex:0 0 78%;'
    +     'scroll-snap-align:center;'
    +     'scroll-snap-stop:always;'
    +     'min-width:0;'
    +   '}'
    +   '.services-grid > *,.why-grid > *{flex:0 0 82% !important}'
    // Faint right-edge mask hints at "more off-screen"
    +   '.products-grid,.services-grid,.why-grid{'
    +     '-webkit-mask-image:linear-gradient(to right,#000 92%,transparent 100%);'
    +             'mask-image:linear-gradient(to right,#000 92%,transparent 100%);'
    +   '}'
    + '}'
    // -------- Tiny screens (≤ 360px) — go a step further --------
    + '@media (max-width:360px){'
    +   '.section,section.section{padding:26px 0 !important}'
    +   '.container{padding-left:14px !important;padding-right:14px !important}'
    +   '.btn{padding:10px 16px !important;font-size:.88rem !important}'
    +   'h1{font-size:clamp(1.55rem,7vw,2rem) !important}'
    +   'h2{font-size:clamp(1.25rem,5.5vw,1.7rem) !important}'
    + '}';
  document.head.appendChild(s);
}

// Auto-run when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  loadSearchConsoleVerification();
  loadMobileTrim();
  loadNav();
  loadFooter();
  loadSchema();
});
