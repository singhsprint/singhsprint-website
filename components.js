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
      // Footer on phones: lean. The 5-col desktop layout collapses to
       // a 2-col grid (Pages | Contact), the long "For Businesses" and
       // "Guides" columns are hidden — they exist in the nav. The brand
       // blurb shrinks. Total footer height drops from ~750px to ~280px.
       //
       // margin-top:0 on mobile so the footer meets the cta-section
       // cleanly — both are dark, so the 40px desktop margin (which
       // showed body bg between them) looked like a stray white gap.
      + '@media(max-width:560px){'
      +   '.footer{padding:32px 0 24px !important;margin-top:0 !important}'
      +   '.footer-grid{grid-template-columns:1fr 1fr !important;gap:18px 14px}'
      +   '.footer-brand{grid-column:1 / -1;margin-bottom:6px}'
      +   '.footer-brand p{font-size:.82rem;line-height:1.5;max-width:none}'
      +   '.footer-col[data-mobile-hide]{display:none}'  /* hide flagged cols */
      +   '.footer-col h4{font-size:.74rem;margin-bottom:8px}'
      +   '.footer-col a{font-size:.86rem;padding:5px 0}'
      +   '.footer-bottom{margin-top:24px;padding-top:18px;font-size:.7rem;flex-direction:column;align-items:flex-start;gap:6px}'
      + '}'
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
    + '      <div class="footer-col" data-mobile-hide><h4>For Businesses</h4><a href="/businesses">Volume pricing</a><a href="/businesses/rfp">Start an RFP</a><a href="/industries/construction-workwear">Construction</a><a href="/industries/restaurant-hospitality-uniforms">Restaurant &amp; hospitality</a><a href="/industries/corporate-tech-swag">Corporate &amp; tech</a><a href="/industries/charity-events-fundraisers">Charity &amp; events</a><a href="/industries/schools-sports-teams">Schools &amp; sports</a></div>'
    + '      <div class="footer-col" data-mobile-hide><h4>Guides</h4><a href="/guides/decoration-method-durability">Decoration durability</a><a href="/guides/procurement-checklist">Procurement checklist</a><a href="/guides/charity-run-timeline">Charity run timeline</a><a href="/guides/construction-crew-cost">Crew cost analysis</a><a href="/#services" data-i18n="footer.dtg">DTG, DTF &amp; embroidery</a></div>'
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
      },
      // WebSite entity with SiteLinks SearchAction so Google can render
      // a sitelinks search box for our brand. The /catalog page is the
      // canonical search target.
      {
        "@type": "WebSite",
        "@id": "https://www.singhsprint.com/#website",
        "url": "https://www.singhsprint.com/",
        "name": "Singhs Print",
        "publisher": { "@id": "https://www.singhsprint.com/#business" },
        "potentialAction": {
          "@type": "SearchAction",
          "target": { "@type": "EntryPoint", "urlTemplate": "https://www.singhsprint.com/catalog.html?q={search_term_string}" },
          "query-input": "required name=search_term_string"
        },
        "inLanguage": ["en-CA", "fr-CA"]
      },
      // FAQPage — surfaces our homepage FAQ in Google's enriched results.
      // The questions/answers mirror the index.html "Frequently asked"
      // block (kept short to avoid Search Console "duplicate content"
      // penalties; full answers live on /guides/).
      {
        "@type": "FAQPage",
        "@id": "https://www.singhsprint.com/#faq",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "What is the minimum order quantity?",
            "acceptedAnswer": { "@type": "Answer", "text": "We start at 5 units for DTG/DTF and 12 units for embroidery. Below that we still help, but pricing shifts to one-off retail rates." }
          },
          {
            "@type": "Question",
            "name": "How long does a typical order take?",
            "acceptedAnswer": { "@type": "Answer", "text": "Standard turnaround is 7–10 business days from approved artwork. Rush (3–5 days) is available with a small surcharge; talk to us before ordering." }
          },
          {
            "@type": "Question",
            "name": "Do you supply the blanks or can I bring my own?",
            "acceptedAnswer": { "@type": "Answer", "text": "Both. We carry 1,100+ blank styles from S&S, AlphaBroder, and SanMar, and we also decorate customer-supplied garments at a per-piece print rate." }
          },
          {
            "@type": "Question",
            "name": "Do you ship across Canada?",
            "acceptedAnswer": { "@type": "Answer", "text": "Yes. Local pickup or delivery in the Montreal/Laval/West Island area is free at our standard volumes; we ship Canada-wide via Canpar and Purolator." }
          },
          {
            "@type": "Question",
            "name": "What file formats do you need for artwork?",
            "acceptedAnswer": { "@type": "Answer", "text": "Vector files (.ai, .eps, .pdf, .svg) are best. We also work with high-res PNG at 300 DPI on a transparent background. We'll redraw lower-res art for a one-time fee." }
          }
        ]
      },
      // ProfessionalService — Google sometimes prefers this richer type
      // for B2B suppliers; we keep the ClothingStore entity for retail
      // discoverability and add this as a sibling without overlap.
      {
        "@type": "ProfessionalService",
        "@id": "https://www.singhsprint.com/#b2b",
        "name": "Singhs Print — B2B Custom Apparel & Procurement",
        "parentOrganization": { "@id": "https://www.singhsprint.com/#business" },
        "url": "https://www.singhsprint.com/businesses",
        "telephone": "+1-514-915-1539",
        "email": "sales@singhsprint.com",
        "description": "Net-30 terms, master service agreements, and standing apparel programs for Montreal-area corporate, hospitality, construction, and event clients.",
        "areaServed": [
          { "@type": "AdministrativeArea", "name": "Quebec" },
          { "@type": "Country", "name": "Canada" }
        ],
        "paymentAccepted": ["Net 30", "Net 60 (approved accounts)", "Credit card", "EFT", "Wire transfer"]
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
    // Defensive — prevents any oversized child (wide tables, fixed-
    // width images) from causing the whole page to scroll horizontally.
    // Pages that need a horizontal scroll do it on a wrapper, not body.
    +   'html,body{overflow-x:hidden !important;max-width:100vw}'
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
    // Trust-bar used to hide on mobile because it duplicated the 6-name
    // static strip with the proof-bar. Now it's an 18-name kinetic ticker
    // that does something the proof-bar can't — surfaces actual client
    // names auto-scrolling. Strong social signal on a viewport where
    // attention is precious, so it stays. Just tighten the vertical
    // padding so it doesn't push too much above the fold.
    +   '.trust-bar{padding:18px 0 !important}'
    // ---------- iOS-style scroll-snap carousels ----------
    // 8 product cards × 2-col grid = ~1,400px of scroll. As a
    // horizontal carousel it's ~340px and reads as native (App Store
    // / Apple Music pattern). Same treatment for the 3 service cards
    // and 6 why-us cards. Each card is sized to leave a peek of the
    // next so users instantly recognize it as swipeable.
    // Products grid stays a stacked 2-col on mobile — carousels hide
    // content and hurt browse-and-pick conversion. Services + why-us
    // (explainer cards, not items to compare) keep the scroll-snap pattern.
    +   '.services-grid,.why-grid{'
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
    +   '.services-grid::-webkit-scrollbar,.why-grid::-webkit-scrollbar{display:none}'
    +   '.services-grid > *,.why-grid > *{'
    +     'flex:0 0 82%;'
    +     'scroll-snap-align:center;'
    +     'scroll-snap-stop:always;'
    +     'min-width:0;'
    +   '}'
    +   '.services-grid,.why-grid{'
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

// =====================================================================
// Sitewide sticky "Get a Quote" bar. Injected on every mobile page
// EXCEPT /quote (already in the flow) and /order/* (post-conversion).
// Persistent yellow pill at the bottom; respects the iPhone home
// indicator via env(safe-area-inset-bottom). High-leverage CRO move:
// previously only the homepage had a sticky CTA; about/portfolio/etc
// forced the user to scroll 7,000+ px back up to convert.
// =====================================================================
function loadStickyCTA() {
  if (document.getElementById('sp-sticky-cta')) return;
  var path = (location.pathname || '/').toLowerCase();
  // Skip if user is already on the quote flow or post-conversion pages.
  if (path === '/quote' || path === '/quote/' || path.indexOf('/quote/') === 0) return;
  if (path === '/order' || path === '/order/' || path.indexOf('/order/') === 0) return;
  // Homepage already has its own .sticky-cta in source; skip to avoid double-up.
  if (document.querySelector('.sticky-cta')) return;

  // Inject styles once.
  if (!document.getElementById('sp-sticky-cta-styles')) {
    var s = document.createElement('style');
    s.id = 'sp-sticky-cta-styles';
    s.textContent = ''
      + '.sp-sticky-cta{display:none}'
      + '@media (max-width:760px){'
      +   '.sp-sticky-cta{'
      +     'display:flex;position:fixed;left:12px;right:12px;bottom:0;z-index:980;'
      +     'background:#1a1a1a;color:#fff;'
      +     'border-radius:14px 14px 0 0;'
      +     'box-shadow:0 -8px 22px rgba(0,0,0,.18);'
      +     'padding:11px 14px calc(11px + env(safe-area-inset-bottom));'
      +     'align-items:center;justify-content:space-between;gap:10px;'
      +     'font-family:inherit;'
      +   '}'
      +   '.sp-sticky-cta__label{font-size:.82rem;font-weight:600;color:#fff;line-height:1.2}'
      +   '.sp-sticky-cta__sub{font-size:.66rem;color:#999;display:block;margin-top:1px;letter-spacing:.02em}'
      +   '.sp-sticky-cta__btn{'
      +     'background:#e8ff3c;color:#1a1a1a;text-decoration:none;'
      +     'padding:9px 16px;border-radius:50px;font-weight:700;font-size:.86rem;'
      +     'white-space:nowrap;flex-shrink:0;'
      +   '}'
      +   '.sp-sticky-cta__btn:hover{background:#d8f02a}'
      // Push page content above the bar so the footer isn't trapped.
      // We add this only to <body> AFTER injection (via a class) so
      // pages where the bar doesn't render don't get a stray gap.
      +   'body.sp-has-sticky-cta{padding-bottom:calc(68px + env(safe-area-inset-bottom)) !important}'
      + '}';
    document.head.appendChild(s);
  }

  var bar = document.createElement('div');
  bar.id = 'sp-sticky-cta';
  bar.className = 'sp-sticky-cta';
  bar.setAttribute('role', 'complementary');
  bar.innerHTML = ''
    + '<div>'
    +   '<div class="sp-sticky-cta__label" data-i18n="sticky.label">Ready when you are</div>'
    +   '<div class="sp-sticky-cta__sub" data-i18n="sticky.sub">No minimums · 2–4 day turnaround</div>'
    + '</div>'
    + '<a href="/quote" class="sp-sticky-cta__btn" data-i18n="sticky.cta">Get a Quote →</a>';
  document.body.appendChild(bar);
  // Add the class to body so the .sp-has-sticky-cta padding rule applies.
  document.body.classList.add('sp-has-sticky-cta');
}

// =====================================================================
// Mid-page CTA — long-form pages otherwise force the reader to scroll
// 7,000+ px to reach the final CTA. Industry standard is to surface a
// conversion moment roughly halfway through the article so reading
// momentum doesn't die. Same data Stripe, Linear, and Notion content
// teams optimize against.
//
// Finds the H2 closest to 50 % of the article content height and
// injects a brand-styled card after it. Skips: homepage, /catalog,
// /quote, /order, /businesses/rfp (those already have prominent CTAs).
// =====================================================================
function loadMidPageCTA() {
  if (document.getElementById('sp-mid-cta')) return;
  var path = (location.pathname || '/').toLowerCase();
  var triggers = ['/guides/', '/industries/', '/about', '/portfolio'];
  var match = triggers.some(function (p) { return path.indexOf(p) === 0; });
  if (!match) return;

  // Inject styles once.
  if (!document.getElementById('sp-mid-cta-styles')) {
    var s = document.createElement('style');
    s.id = 'sp-mid-cta-styles';
    s.textContent = ''
      + '.sp-mid-cta{'
      +   'background:#1a1a1a;color:#fff;border-radius:18px;padding:24px 22px;'
      +   'margin:32px auto;max-width:680px;'
      +   'box-shadow:0 6px 20px rgba(0,0,0,.08);'
      +   'position:relative;overflow:hidden;'
      + '}'
      + '.sp-mid-cta::before{'
      +   'content:"";position:absolute;top:-40px;right:-40px;width:140px;height:140px;'
      +   'background:radial-gradient(circle,rgba(232,255,60,.18) 0%,transparent 70%);'
      +   'pointer-events:none;'
      + '}'
      + '.sp-mid-cta__eyebrow{'
      +   'display:inline-block;background:#e8ff3c;color:#1a1a1a;'
      +   'font-size:.65rem;font-weight:700;letter-spacing:.08em;'
      +   'text-transform:uppercase;padding:4px 10px;border-radius:50px;'
      +   'margin-bottom:12px;'
      + '}'
      + '.sp-mid-cta__title{'
      +   'font-family:"Playfair Display",Georgia,serif;font-weight:800;'
      +   'font-size:1.4rem;line-height:1.2;margin:0 0 8px;color:#fff;'
      + '}'
      + '.sp-mid-cta__copy{font-size:.92rem;color:#bbb;line-height:1.55;margin:0 0 16px}'
      + '.sp-mid-cta__row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}'
      + '.sp-mid-cta__btn{'
      +   'background:#e8ff3c;color:#1a1a1a;text-decoration:none;'
      +   'padding:11px 20px;border-radius:50px;font-weight:700;font-size:.92rem;'
      +   'display:inline-flex;align-items:center;gap:6px;'
      + '}'
      + '.sp-mid-cta__btn:hover{background:#d8f02a}'
      + '.sp-mid-cta__alt{color:#aaa;text-decoration:none;font-size:.86rem;font-weight:500}'
      + '.sp-mid-cta__alt:hover{color:#fff}'
      + '@media (max-width:480px){'
      +   '.sp-mid-cta{margin:24px 0;padding:20px 18px;border-radius:14px}'
      +   '.sp-mid-cta__title{font-size:1.2rem}'
      +   '.sp-mid-cta__copy{font-size:.88rem}'
      +   '.sp-mid-cta__btn{width:100%;justify-content:center}'
      +   '.sp-mid-cta__alt{width:100%;text-align:center;padding-top:4px}'
      + '}';
    document.head.appendChild(s);
  }

  // Find the article container — prefer .article-content, .content,
  // or fall back to <main>, then <body>. Article H2s are the anchor
  // points; we drop the card after the one closest to 50% scroll.
  var article = document.querySelector('.article-content, article, main')
              || document.querySelector('.section') || document.body;
  if (!article) return;
  var h2s = article.querySelectorAll('h2');
  if (h2s.length < 2) return;  // need >=2 sections to have a midpoint

  var articleTop = article.getBoundingClientRect().top + window.scrollY;
  var articleEnd = articleTop + article.scrollHeight;
  var midpoint   = articleTop + (article.scrollHeight / 2);

  // Pick the H2 whose position is closest to (but not past) midpoint.
  var bestH2 = h2s[0];
  var bestDelta = Infinity;
  Array.prototype.forEach.call(h2s, function (h) {
    var y = h.getBoundingClientRect().top + window.scrollY;
    if (y < midpoint) {
      var d = midpoint - y;
      if (d < bestDelta) { bestDelta = d; bestH2 = h; }
    }
  });
  // Don't put the CTA after the LAST H2 — that's too close to the
  // page's existing final CTA. Aim for ~50 % depth.
  if (bestH2 === h2s[h2s.length - 1]) bestH2 = h2s[Math.max(0, h2s.length - 2)];

  // Build + insert. The card sits after the H2's section block, not
  // the H2 itself — we find the next section-level container or end-
  // of-paragraphs to slot in cleanly.
  var anchor = bestH2;
  // Walk forward 2-3 paragraphs so the CTA doesn't sit immediately under the heading.
  for (var i = 0; i < 3 && anchor.nextElementSibling; i++) {
    var next = anchor.nextElementSibling;
    if (!next || next.tagName === 'H2') break;
    anchor = next;
  }

  var card = document.createElement('div');
  card.id = 'sp-mid-cta';
  card.className = 'sp-mid-cta';
  card.innerHTML = ''
    + '<span class="sp-mid-cta__eyebrow" data-i18n="midcta.eyebrow">Quick check</span>'
    + '<h3 class="sp-mid-cta__title" data-i18n="midcta.title">Got a project like this in mind?</h3>'
    + '<p class="sp-mid-cta__copy" data-i18n="midcta.copy">Send us the details and we\'ll come back with a quote, sample timeline, and price within the hour.</p>'
    + '<div class="sp-mid-cta__row">'
    +   '<a href="/quote" class="sp-mid-cta__btn" data-i18n="midcta.btn">Get a free quote →</a>'
    +   '<a href="tel:5149151539" class="sp-mid-cta__alt" data-i18n="midcta.alt">or call 514-915-1539</a>'
    + '</div>';
  anchor.parentNode.insertBefore(card, anchor.nextSibling);
}

// =====================================================================
// FUNNEL ANALYTICS
// ---------------------------------------------------------------------
// A pluggable tracker that fires PostHog / GTM / Plausible / Vercel
// events at the key conversion points across the public site. We
// install nothing by default — `window.spTrack(event, props)` is the
// single entry-point; if a real tracker library is loaded later we
// proxy to it. This lets the rest of the codebase commit to event
// names ("cta_click", "form_step_advance", "form_submit") without
// being coupled to a specific vendor.
// =====================================================================
function loadAnalytics() {
  if (window.spTrack) return; // already initialised
  // Event queue so events fired before a real tracker loads aren't lost.
  window.__spEventQueue = window.__spEventQueue || [];
  window.spTrack = function(event, props) {
    if (!event) return;
    props = props || {};
    try {
      // PostHog (window.posthog is created by the official snippet)
      if (window.posthog && typeof window.posthog.capture === 'function') {
        window.posthog.capture(event, props);
      }
      // GTM / GA4 dataLayer
      if (window.dataLayer && typeof window.dataLayer.push === 'function') {
        window.dataLayer.push(Object.assign({ event: event }, props));
      }
      // Plausible custom event
      if (typeof window.plausible === 'function') {
        window.plausible(event, { props: props });
      }
      // Vercel Web Analytics
      if (window.va && typeof window.va === 'function') {
        try { window.va('event', { name: event, data: props }); } catch(e){}
      }
    } catch(e) {}
    // Always queue (lets us replay if a tracker mounts later) — capped at 200 to avoid leaks.
    if (window.__spEventQueue.length < 200) {
      window.__spEventQueue.push({ t: Date.now(), event: event, props: props });
    }
    // Debug hook — set window.SP_TRACK_DEBUG=true to console.log every event
    if (window.SP_TRACK_DEBUG) console.log('[spTrack]', event, props);
  };

  // page_view on every load. Carries source page so we can stitch funnels.
  var pageId = location.pathname.replace(/\/+$/, '') || '/';
  window.spTrack('page_view', {
    page: pageId,
    url: location.href,
    referrer: document.referrer || null,
    title: document.title
  });

  // Auto-instrument: any `data-sp-track="<eventName>"` element fires
  // that event on click. Lets HTML opt into tracking without writing JS.
  //   <a data-sp-track="cta_hero_quote">Get a quote →</a>
  document.addEventListener('click', function(e) {
    var el = e.target && e.target.closest && e.target.closest('[data-sp-track]');
    if (!el) return;
    var evt = el.getAttribute('data-sp-track');
    var props = {};
    // Pull data-sp-* attributes (besides data-sp-track) into props for context
    Array.prototype.slice.call(el.attributes || []).forEach(function(a) {
      if (a.name && a.name.indexOf('data-sp-') === 0 && a.name !== 'data-sp-track') {
        props[a.name.replace('data-sp-', '')] = a.value;
      }
    });
    if (el.tagName === 'A' && el.href) props.href = el.href;
    if (el.textContent) props.label = el.textContent.trim().slice(0, 60);
    window.spTrack(evt, props);
  }, { capture: true });

  // Auto-instrument: every form submit on the site fires a generic
  // form_submit event with the form's id/action. Page-level code can
  // still call spTrack() directly for richer payloads.
  document.addEventListener('submit', function(e) {
    var f = e.target;
    if (!f || f.tagName !== 'FORM') return;
    window.spTrack('form_submit', {
      form_id: f.id || null,
      form_action: f.getAttribute('action') || null
    });
  }, true);
}

// Auto-run when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  loadSearchConsoleVerification();
  loadAnalytics();
  loadMobileTrim();
  loadNav();
  loadFooter();
  loadSchema();
  loadStickyCTA();
  loadMidPageCTA();
});
