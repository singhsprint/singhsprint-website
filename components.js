// Shared nav and footer for all Singhs Print pages
// Edit these once, changes apply everywhere.

// ---------------------------------------------------------------------
// Google measurement (GA4 + Google Ads) bootstrap.
// Mirrors the inline Meta Pixel pattern on the HTML pages: pulls IDs from
// /gtag-config.js so rotation lives in one place. Runs immediately at
// module load (BEFORE DOMContentLoaded) so we capture the earliest
// page_view signal. Single entry point — every page that loads
// components.js automatically gets GA4 + Google Ads conversion tracking
// without per-file <head> edits.
//
// Files involved:
//   /gtag-config.js  → public IDs (G-… , AW-…)
//   /gtag.js         → SP_GTAG helper (event() + trackConversion())
//
// Skips itself if it's already booted (sp-gtag-config script exists), so
// safe even if a page also inlines the snippet in <head> for earlier firing.
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// Consent Mode v2 (Quebec Law 25 / GDPR). Runs SYNCHRONOUSLY before the
// gtag boot below so Google receives "denied" defaults for all storage
// until the visitor accepts. If a prior choice is stored we apply it
// immediately. The banner UI + accept/reject lives in /consent.js (loaded
// at the bottom of this IIFE chain). (Added 2026-06-05 compliance pass.)
// ---------------------------------------------------------------------
(function consentModeDefaults() {
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  var stored = null;
  try { stored = localStorage.getItem('sp_consent'); } catch (e) {}
  var granted = stored === 'granted';
  gtag('consent', 'default', {
    ad_storage:          granted ? 'granted' : 'denied',
    analytics_storage:   granted ? 'granted' : 'denied',
    ad_user_data:        granted ? 'granted' : 'denied',
    ad_personalization:  granted ? 'granted' : 'denied',
    functionality_storage: 'granted',
    security_storage:    'granted',
    wait_for_update: 500,
  });
  window.SP_CONSENT_STATE = stored || 'unset';
})();

// Load the consent banner UI + controller once per page.
(function loadConsentBanner() {
  if (document.getElementById('sp-consent-script')) return;
  var s = document.createElement('script');
  s.id = 'sp-consent-script';
  s.src = '/consent.js';
  s.defer = true;
  document.head.appendChild(s);
})();

(function loadGoogleMeasurement() {
  if (document.getElementById('sp-gtag-config')) return;
  // 1. Load the config first. It sets window.SP_GA4_MEASUREMENT_ID etc.
  var cfg = document.createElement('script');
  cfg.id = 'sp-gtag-config';
  cfg.src = '/gtag-config.js';
  cfg.onload = function () {
    if (!window.SP_GA4_MEASUREMENT_ID) return; // config malformed — bail
    // 2. Pull the gtag CDN. async so it doesn't block parse.
    var base = document.createElement('script');
    base.async = true;
    base.src = 'https://www.googletagmanager.com/gtag/js?id='
             + encodeURIComponent(window.SP_GA4_MEASUREMENT_ID);
    document.head.appendChild(base);
    // 3. Load our SP_GTAG helper (initialises gtag('config') + exposes API).
    var helper = document.createElement('script');
    helper.src = '/gtag.js';
    document.head.appendChild(helper);
  };
  document.head.appendChild(cfg);
})();

// Inject /promo.js once per page so [data-promo] elements get the live copy
// from the CRM (https://singhsprint-crm.vercel.app/api/promo). Putting this
// here means every page that loads components.js automatically picks up the
// CRM-managed promo without having to edit each HTML file.
function loadPromoLoader() {
  if (document.getElementById('sp-promo-script')) return;
  var s = document.createElement('script');
  s.id = 'sp-promo-script';
  s.src = '/promo.js';
  s.defer = true;
  document.head.appendChild(s);
}

// ---------------------------------------------------------------------
// loadNav — site-wide two-row header.
//
// Layout: row 1 (identity + utility), row 2 (full nav).
//   Row 1: logo · search · cart pill (count) · phone · langToggle · Get a Quote
//   Row 2: T-Shirts ▾  Hoodies ▾  Polos & Apparel ▾  Workwear ▾  Bags ▾  Hats ▾  |  Portfolio  Inkwear  For Businesses  About
//
// Mobile (≤960px) collapses row 2 and most of row 1 into a hamburger
// that opens a full-height drawer. Promo strip stays campaign-aware
// (jealous-meme ad keeps its custom copy). langToggle still calls
// SP_LANG.toggleLang(). Cart count reads window.SinghsCart and
// refreshes on 'singhsCartChange' (dispatched from catalog cart writers).
// Search overlay typeaheads against /api/catalog?q=&limit=8.
// ---------------------------------------------------------------------
function loadNav() {
  var el = document.getElementById('nav-placeholder');
  if (!el) return;

  // Path-based language detection — more reliable than <html lang="…">.
  var IS_FR = /^\/fr(\/|$)/.test(window.location.pathname);
  var BASE  = IS_FR ? '/fr' : '';
  function t(en, fr) { return IS_FR ? fr : en; }

  // Inject nav styles once. v2 namespace so any stale .navbar/.nav-links
  // CSS still in page-level <style> blocks doesn't collide.
  if (!document.getElementById('sp-nav-styles-v2')) {
    var s = document.createElement('style');
    s.id = 'sp-nav-styles-v2';
    s.textContent = [
      '.promo-bar{background:#e8ff3c;text-align:center;padding:10px 24px;font-weight:600;font-size:.9rem;color:#1a1a1a;line-height:1.4}',
      '.promo-bar a{text-decoration:underline;font-weight:700;color:#1a1a1a}',
      '.sp-nav{position:sticky;top:0;z-index:1000;background:rgba(255,255,255,.97);backdrop-filter:blur(12px);border-bottom:1px solid rgba(0,0,0,.06);font-family:inherit}',
      '.sp-nav *{box-sizing:border-box}',
      '.sp-row1{max-width:1240px;margin:0 auto;display:flex;align-items:center;gap:14px;padding:14px 24px}',
      '.sp-logo{display:inline-flex;align-items:center;text-decoration:none;flex-shrink:0}',
      '.sp-logo img{display:block;height:52px;width:auto}',
      '.sp-spacer{flex:1}',
      '.sp-search-wrap{position:relative;display:inline-block}',
      '.sp-search{display:flex;align-items:center;gap:8px;border:1px solid #e6e3d8;border-radius:22px;padding:6px 6px 6px 12px;min-width:280px;color:#1a1a1a;font-size:.85rem;background:#fff;transition:border-color .15s}',
      // Submit button — round, dark, sits inside the pill on the right.
      // Tap target for users who want to commit a search instead of
      // browsing the typeahead list. Bound to the same /catalog?q=…
      // navigation the Enter key triggers.
      '.sp-search-go{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;border:none;background:#1a1a1a;color:#fff;cursor:pointer;font-weight:700;font-size:.9rem;line-height:1;padding:0;margin-left:auto;flex-shrink:0;transition:transform .12s,background .12s}',
      '.sp-search-go:hover{background:#000;transform:translateX(2px)}',
      '.sp-search-go:active{transform:translateX(1px)}',
      '.sp-search-go svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}',
      // Prominent "See all results" CTA at the top of the typeahead panel.
      '.sp-search-allbtn{display:flex;align-items:center;justify-content:space-between;gap:10px;background:#e8ff3c;color:#1a1a1a;border-radius:10px;padding:10px 14px;text-decoration:none;font-weight:700;font-size:.86rem;margin-bottom:6px;border:1px solid rgba(0,0,0,.08)}',
      '.sp-search-allbtn:hover{background:#dff531}',
      '.sp-search-allbtn .sp-search-allbtn__hint{font-size:.72rem;font-weight:500;color:#1a1a1a;opacity:.75}',
      '.sp-search:hover,.sp-search:focus-within{border-color:#1a1a1a}',
      '.sp-search svg{width:14px;height:14px;flex-shrink:0;color:#888}',
      '.sp-search input{border:none;outline:none;background:transparent;font-size:.86rem;flex:1;min-width:0;color:#1a1a1a;font-family:inherit;padding:4px 0}',
      '.sp-search input::placeholder{color:#999}',
      '.sp-search-panel{position:absolute;top:calc(100% + 6px);left:0;right:0;background:#fff;border:1px solid #ece9df;border-radius:14px;box-shadow:0 12px 28px rgba(0,0,0,.10);padding:8px;display:none;z-index:60;max-height:480px;overflow-y:auto;min-width:380px}',
      '.sp-search-panel.is-on{display:block}',
      '.sp-search-panel .sp-search-empty{padding:14px 12px;color:#999;font-size:.82rem;text-align:center}',
      '.sp-search-panel .sp-search-result{display:flex;gap:12px;align-items:center;padding:8px 10px;border:1px solid transparent;border-radius:8px;text-decoration:none;color:#1a1a1a}',
      '.sp-search-panel .sp-search-result:hover{background:#fafaf6}',
      '.sp-search-panel .sp-search-result+.sp-search-result{margin-top:2px}',
      '.sp-search-panel .sp-search-result img{width:44px;height:44px;object-fit:cover;border-radius:6px;background:#f3f1ea;flex-shrink:0}',
      '.sp-cart{position:relative;display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border:1px solid #e6e3d8;border-radius:50%;color:#1a1a1a;text-decoration:none;background:#fff;transition:border-color .15s}',
      '.sp-cart:hover{border-color:#1a1a1a}',
      '.sp-cart svg{width:16px;height:16px}',
      '.sp-cart-count{position:absolute;top:-5px;right:-5px;background:#e8ff3c;color:#1a1a1a;font-size:.65rem;min-width:18px;height:18px;border-radius:9px;display:none;align-items:center;justify-content:center;padding:0 4px;font-weight:700;border:1.5px solid #1a1a1a}',
      '.sp-cart-count.is-on{display:flex}',
      // Account chip: same round-button style as .sp-cart, sits between
      // cart and phone in row 1. Links to /account/ which redirects to
      // /account/signin.html if no session — no per-page JS needed.
      // For business customers it morphs into a pill ("Account · Business"),
      // tinted with the lime accent — see updateAccountChip() below.
      '.sp-account{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border:1px solid #e6e3d8;border-radius:50%;color:#1a1a1a;text-decoration:none;background:#fff;transition:border-color .15s,background .15s,width .15s}',
      '.sp-account:hover{border-color:#1a1a1a}',
      '.sp-account svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}',
      '.sp-account.is-biz{width:auto;padding:0 12px 0 8px;border-radius:50px;background:#e8ff3c;border-color:#1a1a1a;gap:6px}',
      '.sp-account.is-biz .sp-account-label{display:inline-flex;align-items:center;font-size:.74rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#1a1a1a}',
      '.sp-account .sp-account-label{display:none}',
      '.sp-phone{font-size:.88rem;color:#1a1a1a;font-weight:600;text-decoration:none;padding:6px 8px;border-radius:50px;transition:background .15s;display:inline-flex;align-items:center;gap:6px;flex-shrink:0}',
      '.sp-phone:hover{background:#f4f2eb}',
      '.sp-phone svg{display:none;width:18px;height:18px}',
      '#langToggle{padding:8px 14px;border-radius:50px;border:1.5px solid #ddd;background:#fff;font-size:.78rem;font-weight:700;cursor:pointer;letter-spacing:.06em;flex-shrink:0;color:#1a1a1a;transition:all .15s}',
      '#langToggle:hover{border-color:#1a1a1a}',
      '.sp-cta{background:#1a1a1a;color:#fff !important;font-size:.86rem;font-weight:600;padding:10px 18px;border-radius:50px;text-decoration:none;flex-shrink:0;transition:background .15s}',
      '.sp-cta:hover{background:#333}',
      '.sp-row2{max-width:1240px;margin:0 auto;display:flex;align-items:center;gap:16px;padding:0 24px 12px 24px;font-size:.88rem;color:#1a1a1a;flex-wrap:wrap}',
      '.sp-nav-item{display:inline-flex;align-items:center;gap:3px;color:#1a1a1a;text-decoration:none;padding:6px 0;position:relative;font-weight:500}',
      '.sp-nav-item:hover{opacity:.7}',
      '.sp-nav-item.is-active::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:#1a1a1a}',
      '.sp-nav-item svg{opacity:.55}',
      '.sp-nav-divider{opacity:.3;margin:0 2px;user-select:none}',
      '.sp-nav-parent{position:relative}',
      '.sp-dropdown{position:absolute;top:100%;left:-14px;background:#fff;border:1px solid #ece9df;border-radius:0 0 12px 12px;padding:14px 16px;min-width:260px;display:none;z-index:50;box-shadow:0 12px 24px rgba(0,0,0,.08)}',
      '.sp-nav-parent:hover .sp-dropdown,.sp-nav-parent:focus-within .sp-dropdown{display:block}',
      '.sp-dropdown a{display:block;color:#1a1a1a;text-decoration:none;padding:6px 0;font-size:.86rem;font-weight:400}',
      '.sp-dropdown a:hover{text-decoration:underline}',
      '.sp-dropdown-foot{margin-top:10px;padding-top:10px;border-top:1px solid #f0eee7;display:flex;justify-content:flex-end}',
      '.sp-dropdown-foot a{color:#1a1a1a;font-size:.78rem;font-weight:600;text-decoration:underline;padding:0}',
      '.sp-burger,.sp-mobile-quote{display:none}',
      '@media(max-width:960px){',
        '.sp-row1{padding:11px 14px;gap:10px}',
        '.sp-row2{display:none}',
        '.sp-search{display:none}',
        '.sp-phone{padding:6px;border-radius:50%;width:38px;height:38px;justify-content:center;border:1px solid #e6e3d8}',
        '.sp-phone svg{display:block}',
        '.sp-phone span{display:none}',
        '#langToggle{display:none}',
        '.sp-cta{display:none}',
        '.sp-burger{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;color:#1a1a1a;border:1px solid #e6e3d8;background:#fff;border-radius:50%;cursor:pointer;flex-shrink:0}',
        '.sp-burger svg{width:20px;height:20px}',
        // 2026-05-24 — adds explicit cursor:pointer, tap-highlight, and
        // touch-action:manipulation. iOS Safari was reportedly ignoring
        // taps on this pill on at least one user device; the symptom is
        // "tap registers but no navigation". The likely culprit is a
        // touch-action interaction with the sticky parent header — making
        // touch-action explicit and giving the tap a visible feedback
        // colour both confirms-to-user-and-engine that the tap fired.
        // position:relative + z-index:5 also lifts it above any quirky
        // sibling that might be sitting at the same stacking layer.
        '.sp-mobile-quote{display:inline-flex;align-items:center;justify-content:center;background:#1a1a1a;color:#fff !important;font-size:.78rem;font-weight:600;padding:8px 14px;border-radius:50px;text-decoration:none;flex-shrink:0;cursor:pointer;-webkit-tap-highlight-color:rgba(255,255,255,.2);touch-action:manipulation;position:relative;z-index:5}',
        '.sp-logo img{height:36px}',
        '.sp-spacer{display:none}',
        '.sp-logo{flex:1;justify-content:center}',
      '}',
      '.sp-drawer{position:fixed;inset:0;background:#fff;z-index:1100;display:none;overflow-y:auto}',
      '.sp-drawer.is-open{display:block}',
      '.sp-drawer-head{display:flex;align-items:center;padding:14px 16px;border-bottom:1px solid #f0eee7;gap:10px}',
      '.sp-drawer-close{width:38px;height:38px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #e6e3d8;background:#fff;color:#1a1a1a;cursor:pointer;border-radius:50%}',
      '.sp-drawer-close svg{width:20px;height:20px}',
      '.sp-drawer-body{padding:18px 18px 28px 18px;color:#1a1a1a}',
      '.sp-drawer .sp-search{display:flex;margin-bottom:18px;width:100%;min-width:0}',
      '.sp-drawer-section{font-size:.66rem;letter-spacing:.14em;color:#999;font-weight:600;margin:18px 0 4px 0;text-transform:uppercase}',
      '.sp-drawer-section:first-child{margin-top:0}',
      '.sp-drawer-link{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #f3f1ea;font-size:.95rem;color:#1a1a1a;text-decoration:none;font-weight:500}',
      '.sp-drawer-link svg{width:14px;height:14px;color:#aaa}',
      '.sp-drawer-foot{margin-top:22px;padding-top:14px;border-top:1px solid #f0eee7}',
      '.sp-drawer-foot .row{display:flex;gap:10px;align-items:center;margin-top:14px}',
      '.sp-drawer-foot .row #langToggle{display:inline-block}',
      '.sp-drawer-foot .row .sp-cta{display:inline-flex;flex:1;justify-content:center}',
      // Mobile-only horizontal category strip — sits between row 1 and
      // the page content on small screens. Single-tap entry to the six
      // top categories without needing to open the drawer. Hidden on
      // desktop (row 2 covers it there).
      // Compact mobile category strip — horizontal pills with the icon
      // in a small white circle on the left and the label inline on the
      // right. Total height ~58 px so the hero video stays close to
      // above-the-fold on standard iPhone heights.
      '.sp-mobile-cats{display:none;background:#fff;border-bottom:1px solid #f0eee7;padding:8px 10px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;gap:8px;scrollbar-width:none}',
      '.sp-mobile-cats::-webkit-scrollbar{display:none}',
      '@media(max-width:960px){.sp-mobile-cats{display:flex}}',
      '.sp-mobile-cat{flex:0 0 auto;display:inline-flex;align-items:center;gap:8px;padding:6px 12px 6px 6px;background:#fafaf6;border:1px solid #ece9df;border-radius:999px;text-decoration:none;color:#1a1a1a;font-size:.78rem;font-weight:600;line-height:1;scroll-snap-align:start}',
      '.sp-mobile-cat:active{background:#f0eee7}',
      '.sp-mobile-cat svg{width:22px;height:22px;flex-shrink:0;padding:4px;background:#fff;border-radius:50%;border:1px solid #ece9df;box-sizing:content-box}',
      // Tighter promo bar on phones — was wrapping to two lines on
      // standard iPhone widths and chewing 25-30 px above the fold.
      '@media(max-width:500px){.promo-bar{padding:7px 12px;font-size:.74rem;line-height:1.35}}',
      '@media(max-width:380px){.promo-bar{padding:6px 10px;font-size:.7rem}}'
    ].join('');
    document.head.appendChild(s);
  }

  // ----- Promo bar (campaign-aware) -----
  var promoHTML;
  try {
    var params = new URLSearchParams(window.location.search);
    var campaign = (params.get('utm_campaign') || '').toLowerCase();
    var content  = (params.get('utm_content')  || '').toLowerCase();
    var isJealousCampaign =
      campaign.indexOf('jealous')   >= 0 ||
      content.indexOf('jealous')    >= 0 ||
      campaign.indexOf('bulk_tees') >= 0;
    if (isJealousCampaign) {
      promoHTML = '<div class="promo-bar" data-promo="jealous">'
        + '<span>50 custom tees from <strong>$13.95 each</strong> &middot; quote back in 15 minutes during business hours.</span> '
        + '<a href="' + BASE + '/quote">' + t('Get your quote', 'Demander une soumission') + '</a>'
        + '</div>';
    } else {
      promoHTML = '<div class="promo-bar">'
        + '<span data-i18n="promo" data-promo="short">$20 OFF your first order of $100+. No code needed.</span> '
        + '<a href="' + BASE + '/quote" data-i18n="promo.link">Get your quote</a>'
        + '</div>';
    }
  } catch (err) {
    promoHTML = '<div class="promo-bar">'
      + '<span data-i18n="promo" data-promo="short">$20 OFF your first order of $100+. No code needed.</span> '
      + '<a href="' + BASE + '/quote" data-i18n="promo.link">Get your quote</a>'
      + '</div>';
  }

  // Category dropdowns — sub-counts in comments come from the live /api/catalog
  // facet probe so any future editor knows what they're working with.
  var CATS = [
    // 2026-06-10 catalog re-tag: the whole catalog was reclassified into a
    // corrected `category` taxonomy (gpt-4o-mini backfill; ~1,520 'other' rows
    // resolved, ~1,000 jackets surfaced). These ?type= values now resolve
    // against catalog_public.category_effective in /api/catalog, so each link
    // returns real, filterable results instead of mostly-empty garment_type.
    {
      en: 'T-Shirts', fr: 'T-shirts', i18n: 'nav.tshirts',
      href: BASE + '/catalog?type=tshirt',
      subs: [
        { en: 'All t-shirts',        fr: 'Tous les t-shirts',   href: BASE + '/catalog?type=tshirt' },
        { en: 'Long sleeve',         fr: 'Manches longues',     href: BASE + '/catalog?type=longsleeve' },
        { en: 'Tank tops',           fr: 'Camisoles',           href: BASE + '/catalog?type=tank' },
        { en: 'Performance / tech',  fr: 'Performance',         href: BASE + '/catalog?type=performance_shirt' },
        { en: 'Canadian-made',       fr: 'Fait au Canada',      href: BASE + '/catalog?type=tshirt&canadian=1' }
      ]
    },
    {
      en: 'Hoodies & Sweatshirts', fr: 'Hoodies et pulls', i18n: 'nav.hoodies',
      href: BASE + '/catalog?type=hoodie',
      subs: [
        { en: 'Hoodies',             fr: 'Hoodies',             href: BASE + '/catalog?type=hoodie' },
        { en: 'Crewneck sweatshirts',fr: 'Pulls col rond',      href: BASE + '/catalog?type=crewneck' },
        { en: 'Quarter-zips',        fr: 'Quarts de zip',       href: BASE + '/catalog?type=quarter_zip' },
        { en: 'Sweaters',            fr: 'Pulls',               href: BASE + '/catalog?type=sweater' },
        { en: 'Cardigans',           fr: 'Cardigans',           href: BASE + '/catalog?type=cardigan' }
      ]
    },
    {
      en: 'Polos & Shirts', fr: 'Polos et chemises', i18n: 'nav.polos',
      href: BASE + '/catalog?type=polo',
      subs: [
        { en: 'Polos',               fr: 'Polos',               href: BASE + '/catalog?type=polo' },
        { en: 'Button-up shirts',    fr: 'Chemises',            href: BASE + '/catalog?type=woven_shirt' }
      ]
    },
    {
      en: 'Jackets', fr: 'Vestes', i18n: 'nav.jackets',
      href: BASE + '/catalog?type=jacket',
      subs: [
        { en: 'All jackets',         fr: 'Toutes les vestes',   href: BASE + '/catalog?type=jacket' },
        { en: 'Vests',               fr: 'Gilets',              href: BASE + '/catalog?type=vest' },
        { en: 'Canadian-made',       fr: 'Fait au Canada',      href: BASE + '/catalog?type=jacket&canadian=1' }
      ]
    },
    {
      en: 'Bottoms', fr: 'Bas', i18n: 'nav.bottoms',
      href: BASE + '/catalog?type=joggers',
      subs: [
        { en: 'Joggers',             fr: 'Joggers',             href: BASE + '/catalog?type=joggers' },
        { en: 'Sweatpants',          fr: 'Pantalons de jogging',href: BASE + '/catalog?type=sweatpants' },
        { en: 'Shorts',              fr: 'Shorts',              href: BASE + '/catalog?type=shorts' },
        { en: 'Pants',               fr: 'Pantalons',           href: BASE + '/catalog?type=pants' },
        { en: 'Leggings',            fr: 'Leggings',            href: BASE + '/catalog?type=leggings' }
      ]
    },
    {
      en: 'Workwear', fr: 'Vêtements de travail', i18n: 'nav.workwear',
      href: BASE + '/catalog?csa=1',
      subs: [
        { en: 'Hi-vis & CSA',        fr: 'Haute visibilité / CSA', href: BASE + '/catalog?csa=1' },
        { en: 'Coveralls',           fr: 'Combinaisons',        href: BASE + '/catalog?type=coverall' },
        { en: 'Scrubs',              fr: 'Uniformes médicaux',  href: BASE + '/catalog?type=scrubs' },
        { en: 'Aprons',              fr: 'Tabliers',            href: BASE + '/catalog?type=apron' }
      ]
    },
    {
      en: 'Accessories', fr: 'Accessoires', i18n: 'nav.accessories',
      href: BASE + '/catalog?type=hat',
      subs: [
        { en: 'Hats & caps',         fr: 'Chapeaux',            href: BASE + '/catalog?type=hat' },
        { en: 'Beanies & toques',    fr: 'Tuques',              href: BASE + '/catalog?type=beanie' },
        { en: 'Visors',              fr: 'Visières',            href: BASE + '/catalog?type=visor' },
        { en: 'Bags & backpacks',    fr: 'Sacs',                href: BASE + '/catalog?type=bag' },
        { en: 'Scarves',             fr: 'Foulards',            href: BASE + '/catalog?type=scarf' },
        { en: 'Gloves',              fr: 'Gants',               href: BASE + '/catalog?type=gloves' },
        { en: 'Socks',               fr: 'Chaussettes',         href: BASE + '/catalog?type=socks' },
        { en: 'Blankets & towels',   fr: 'Couvertures et serviettes', href: BASE + '/catalog?type=blanket' }
      ]
    },
    {
      // Sports Jerseys is its own destination (the /jerseys hub), not a
      // catalog garment_type filter. The subs deep-link the hub to each
      // sport via ?sport=. Only the sports our catalog can actually source
      // are listed (hockey/soccer/basketball/baseball best stocked;
      // football/volleyball thinner but present). The hub reads the jersey
      // classification layer via /api/catalog?sport=.
      en: 'Jerseys', fr: 'Maillots', i18n: 'nav.jerseys',
      href: BASE + '/jerseys',
      subs: [
        { en: 'Hockey',     fr: 'Hockey',     i18n: 'nav.jerseys.hockey',     href: BASE + '/jerseys?sport=hockey' },
        { en: 'Soccer',     fr: 'Soccer',     i18n: 'nav.jerseys.soccer',     href: BASE + '/jerseys?sport=soccer' },
        { en: 'Basketball', fr: 'Basketball', i18n: 'nav.jerseys.basketball', href: BASE + '/jerseys?sport=basketball' },
        { en: 'Baseball',   fr: 'Baseball',   i18n: 'nav.jerseys.baseball',   href: BASE + '/jerseys?sport=baseball' },
        { en: 'Football',   fr: 'Football',   i18n: 'nav.jerseys.football',   href: BASE + '/jerseys?sport=football' },
        { en: 'Volleyball', fr: 'Volleyball', i18n: 'nav.jerseys.volleyball', href: BASE + '/jerseys?sport=volleyball' }
      ]
    },
    {
      // Rue Saint-Patrick — Montreal-designed, Canadian-made blanks. Own hub at
      // /designed-in-montreal (brand story + the Canadian collection grid). Subs
      // deep-link the catalog's existing ?canadian=1 filter (supplier-scoped to
      // rue_sainte_patrick). en/fr inline so no lang.js key is required.
      en: 'Canadian-Made', fr: 'Fait au Canada',
      href: BASE + '/designed-in-montreal',
      subs: [
        { en: 'Designed in Montreal', fr: 'Conçu à Montréal',    href: BASE + '/designed-in-montreal' },
        { en: 'Shop Canadian blanks', fr: 'Vêtements canadiens', href: BASE + '/catalog?canadian=1' },
        { en: 'Organic cotton tees',  fr: 'T-shirts coton bio',  href: BASE + '/catalog?canadian=1&type=tshirt' }
      ]
    }
  ];

  // EDITORIAL, right-rail nav items.
  // Ordering rationale (2026-05-19):
  //   1. For Businesses, highest-LTV customer path, gets the leftmost
  //      eyeball position. Brackets the rail with the two ends of the
  //      funnel: "For Businesses" on the left, "Get a Quote" CTA on
  //      the right.
  //   2. About, surfaced second because the "who are you" question is
  //      the single most common follow-up to "this looks interesting"
  //      and we'd rather customers find the brand story in one click
  //      than 4 clicks deep.
  //   3. Portfolio, social proof / past work, third trust signal.
  //   4. Inkwear + Youth Initiative, niche programs that build the
  //      brand but aren't the primary sale, last in order.
  var EDITORIAL = [
    {
      // For Businesses is a parent, hovering it reveals the 5 industry
      // vertical landing pages under /industries/* plus a link back to
      // the parent /businesses overview.
      en: 'For Businesses', fr: 'Entreprises',
      i18n: 'nav.businesses', href: BASE + '/businesses',
      subs: [
        { en: 'Construction & trades',   fr: 'Construction & métiers',     href: BASE + '/industries/construction-workwear' },
        { en: 'Restaurant & hospitality',fr: 'Restauration & hôtellerie',  href: BASE + '/industries/restaurant-hospitality-uniforms' },
        { en: 'Corporate & tech swag',   fr: 'Entreprise & tech swag',     href: BASE + '/industries/corporate-tech-swag' },
        { en: 'Charity & events',        fr: 'Caritatif & événements',     href: BASE + '/industries/charity-events-fundraisers' },
        { en: 'Schools & sports',        fr: 'Écoles & équipes sportives', href: BASE + '/industries/schools-sports-teams' }
      ]
    },
    // 2026-05-25 — Drops added to the editorial rail so customers
    // who landed for B2B quoting discover the DTC drops line. Placed
    // second in the rail (right after For Businesses) for prominence
    // — Drops is a new revenue channel and deserves the eyeball-
    // grabbing position, not buried after the niche programs.
    { en: 'Drops',     fr: 'Drops',     i18n: 'nav.drops',     href: BASE + '/shop' },
    { en: 'About',     fr: 'À propos',  i18n: 'nav.about',     href: BASE + '/about' },
    { en: 'Portfolio', fr: 'Portfolio', i18n: 'nav.portfolio', href: BASE + '/portfolio' },
    { en: 'Inkwear',   fr: 'Inkwear',   i18n: 'nav.inkwear',   href: BASE + '/inkwear' },
    { en: 'Youth Initiative', fr: 'Initiative Jeunesse', i18n: 'nav.youth', href: BASE + '/youth-initiative' }
  ];

  var ICON = {
    search:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
    bag:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l-1.5 13a2 2 0 0 1-2 1.8h-5a2 2 0 0 1-2-1.8L6 7Z"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/></svg>',
    burger:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
    close:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    chevD:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><path d="m6 9 6 6 6-6"/></svg>',
    chevR:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="m9 6 6 6-6 6"/></svg>',
    phone:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    // Garment-category icons for the mobile horizontal strip. Line-art
    // 24×24, stroke=currentColor so they inherit the card's ink color.
    tshirt:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6 8 3h8l4 3-3 3-1-1v13H8V8L7 9 4 6z"/></svg>',
    hoodie:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8 8 5l1 2c.7 1 1.8 1.5 3 1.5s2.3-.5 3-1.5l1-2 4 3-3 4v9H7v-9L4 8z"/><path d="M10 7c0 1 .9 2 2 2s2-1 2-2"/></svg>',
    polo:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6 8 3l2 2 2 1 2-1 2-2 4 3-3 3-1-1v13H8V8L7 9 4 6z"/><path d="M12 6v4"/></svg>',
    workwear:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5h4l3 4 3-4h4v15H5z"/><path d="M9 10v9M15 10v9"/></svg>',
    bagicon:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    hat:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17c0-5 3.5-9 8-9s8 4 8 9"/><path d="M2 17h20"/></svg>',
    // Sports jersey — sleeveless/short-sleeve athletic top with a number.
    jersey:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4 5 6 3 9l2.5 2L7 9v11h10V9l1.5 2L21 9l-2-3-3-2-1.5 2c-.9.9-2 1.4-2.5 1.4S9.4 6.9 8.5 6L8 4z"/><path d="M11 13h2"/></svg>',
    grid:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>'
  };

  var path = window.location.pathname.replace(/\/+$/, '');
  function isActive(href) {
    var p = href.split('?')[0].replace(/\/+$/, '');
    if (!p || p === BASE) return path === BASE || path === BASE + '/';
    return path === p || path.indexOf(p + '/') === 0;
  }

  function dropdownHtml(cat) {
    var items = cat.subs.map(function (sub) {
      return '<a href="' + sub.href + '">' + t(sub.en, sub.fr) + '</a>';
    }).join('');
    return '<div class="sp-dropdown">' + items
      + '<div class="sp-dropdown-foot"><a href="' + cat.href + '">'
      + t('Browse all', 'Tout voir') + ' &rarr;</a></div></div>';
  }

  var row2Cats = CATS.map(function (c) {
    var active = isActive(c.href) ? ' is-active' : '';
    return '<span class="sp-nav-parent">'
      + '<a class="sp-nav-item' + active + '" href="' + c.href + '" data-i18n="' + c.i18n + '">'
      + t(c.en, c.fr) + ICON.chevD + '</a>'
      + dropdownHtml(c) + '</span>';
  }).join('');
  // Editorial items support an optional subs[] array — when present we
  // render them with the same dropdown pattern as the product CATS so a
  // single hover reveals the industry verticals under "For Businesses".
  var row2Edit = EDITORIAL.map(function (l) {
    var active = isActive(l.href) ? ' is-active' : '';
    if (l.subs && l.subs.length) {
      return '<span class="sp-nav-parent">'
        + '<a class="sp-nav-item' + active + '" href="' + l.href + '" data-i18n="' + l.i18n + '">'
        + t(l.en, l.fr) + ICON.chevD + '</a>'
        + dropdownHtml(l) + '</span>';
    }
    return '<a class="sp-nav-item' + active + '" href="' + l.href + '" data-i18n="' + l.i18n + '">' + t(l.en, l.fr) + '</a>';
  }).join('');
  var drawerCats = CATS.map(function (c) {
    return '<a href="' + c.href + '" class="sp-drawer-link" data-i18n="' + c.i18n + '">' + t(c.en, c.fr) + ICON.chevR + '</a>';
  }).join('');
  // In the drawer, items with subs render the parent + an indented list
  // of children so mobile users see the industry verticals inline (no
  // hover state to rely on).
  var drawerEdit = EDITORIAL.map(function (l) {
    var head = '<a href="' + l.href + '" class="sp-drawer-link" data-i18n="' + l.i18n + '">' + t(l.en, l.fr) + (l.subs && l.subs.length ? ICON.chevR : '') + '</a>';
    if (!l.subs || !l.subs.length) return head;
    var children = l.subs.map(function (sub) {
      return '<a href="' + sub.href + '" class="sp-drawer-link" style="padding-left:14px;font-weight:400;color:#444;font-size:.88rem">' + t(sub.en, sub.fr) + '</a>';
    }).join('');
    return head + children;
  }).join('');

  var searchPlaceholder = t('Search 1,100+ blanks', 'Chercher parmi 1 100+ vêtements');
  var searchOverlayPlaceholder = t('Search by brand, style, or fabric…', 'Cherchez par marque, style ou tissu…');

  el.innerHTML = ''
    + promoHTML
    + '<header class="sp-nav" role="banner">'
    + '  <div class="sp-row1">'
    + '    <button class="sp-burger" aria-label="' + t('Open menu', 'Ouvrir le menu') + '" onclick="window.__spOpenDrawer()">' + ICON.burger + '</button>'
    + '    <a href="' + BASE + '/" class="sp-logo" aria-label="Singh\'s Print"><img src="/images/logo.png" alt="Singh\'s Print"></a>'
    + '    <div class="sp-spacer"></div>'
    + '    <div class="sp-search-wrap" id="sp-search-wrap">'
    + '      <label class="sp-search" for="sp-search-input">'
    +          ICON.search
    + '        <input id="sp-search-input" type="search" autocomplete="off" placeholder="' + searchPlaceholder + '" aria-label="' + searchPlaceholder + '"/>'
    + '        <button type="button" id="sp-search-go" class="sp-search-go" aria-label="' + t('Search', 'Rechercher') + '">'
    + '          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5l5 5l-5 5"/></svg>'
    + '        </button>'
    + '      </label>'
    + '      <div class="sp-search-panel" id="sp-search-panel" aria-live="polite"></div>'
    + '    </div>'
    + '    <a href="' + BASE + '/quote#cart" class="sp-cart" aria-label="' + t('Cart', 'Panier') + '">' + ICON.bag
    +        '<span class="sp-cart-count" id="sp-cart-count">0</span></a>'
    + '    <a href="/account/" class="sp-account" id="sp-account-chip" aria-label="' + t('My account', 'Mon compte') + '" title="' + t('My account', 'Mon compte') + '">'
    + '      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>'
    + '      <span class="sp-account-label" id="sp-account-label">' + t('Business', 'Entreprise') + '</span>'
    + '    </a>'
    + '    <a href="tel:4385443800" class="sp-phone" aria-label="Call us at 438-544-3800">' + ICON.phone + '<span>438-544-3800</span></a>'
    + '    <button id="langToggle" onclick="SP_LANG && SP_LANG.toggleLang && SP_LANG.toggleLang()">' + (IS_FR ? 'EN' : 'FR') + '</button>'
    + '    <a href="' + BASE + '/quote" class="sp-cta" data-i18n="nav.quote">' + t('Get a Quote', 'Soumission') + '</a>'
    + '    <a href="' + BASE + '/quote" class="sp-mobile-quote" data-i18n="nav.quote.short">' + t('Quote', 'Devis') + '</a>'
    + '  </div>'
    + '  <nav class="sp-row2" aria-label="' + t('Site sections', 'Sections du site') + '">'
    +      row2Cats
    + '    <span class="sp-nav-divider">|</span>'
    +      row2Edit
    + '  </nav>'
    + '</header>'
    // Mobile-only horizontal category strip — six one-tap entry points
    // into the catalog plus an "All" entry. Tucked under the sticky
    // header so it scrolls away as the page scrolls. CSS hides this
    // entirely above 960px. Line-art SVG icons sit in a small white
    // circle so they match the editorial b/w aesthetic.
    + '<nav class="sp-mobile-cats" aria-label="' + t('Categories', 'Catégories') + '">'
    + '  <a class="sp-mobile-cat" href="' + BASE + '/catalog">' + ICON.grid + '<span>' + t('All', 'Tout') + '</span></a>'
    + '  <a class="sp-mobile-cat" href="' + BASE + '/catalog?type=tshirt">' + ICON.tshirt + '<span>' + t('T-Shirts', 'T-shirts') + '</span></a>'
    + '  <a class="sp-mobile-cat" href="' + BASE + '/catalog?type=hoodie">' + ICON.hoodie + '<span>' + t('Hoodies', 'Hoodies') + '</span></a>'
    + '  <a class="sp-mobile-cat" href="' + BASE + '/catalog?type=polo">' + ICON.polo + '<span>' + t('Polos', 'Polos') + '</span></a>'
    + '  <a class="sp-mobile-cat" href="' + BASE + '/catalog?type=vest">' + ICON.workwear + '<span>' + t('Workwear', 'Travail') + '</span></a>'
    + '  <a class="sp-mobile-cat" href="' + BASE + '/catalog?type=bag">' + ICON.bagicon + '<span>' + t('Bags', 'Sacs') + '</span></a>'
    + '  <a class="sp-mobile-cat" href="' + BASE + '/catalog?type=hat">' + ICON.hat + '<span>' + t('Hats', 'Chapeaux') + '</span></a>'
    + '  <a class="sp-mobile-cat" href="' + BASE + '/jerseys">' + ICON.jersey + '<span>' + t('Jerseys', 'Maillots') + '</span></a>'
    + '</nav>'
    + '<div class="sp-drawer" id="sp-drawer" aria-hidden="true">'
    + '  <div class="sp-drawer-head">'
    + '    <button class="sp-drawer-close" aria-label="' + t('Close menu', 'Fermer le menu') + '" onclick="window.__spCloseDrawer()">' + ICON.close + '</button>'
    + '    <a href="' + BASE + '/" class="sp-logo" style="flex:1;justify-content:center" aria-label="Singh\'s Print"><img src="/images/logo.png" alt="Singh\'s Print"></a>'
    + '    <div style="width:38px"></div>'
    + '  </div>'
    + '  <div class="sp-drawer-body">'
    + '    <div class="sp-search-wrap" id="sp-search-wrap-mobile" style="width:100%">'
    + '      <label class="sp-search" for="sp-search-input-mobile" style="width:100%;min-width:0">'
    +          ICON.search
    + '        <input id="sp-search-input-mobile" type="search" autocomplete="off" placeholder="' + searchPlaceholder + '" aria-label="' + searchPlaceholder + '"/>'
    + '        <button type="button" id="sp-search-go-mobile" class="sp-search-go" aria-label="' + t('Search', 'Rechercher') + '">'
    + '          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5l5 5l-5 5"/></svg>'
    + '        </button>'
    + '      </label>'
    + '      <div class="sp-search-panel" id="sp-search-panel-mobile" aria-live="polite"></div>'
    + '    </div>'
    + '    <div class="sp-drawer-section">' + t('Shop', 'Magasinez') + '</div>' + drawerCats
    + '    <div class="sp-drawer-section">' + t('More', 'Plus') + '</div>' + drawerEdit
    + '    <div class="sp-drawer-foot">'
    + '      <div style="font-size:.92rem;font-weight:600">438-544-3800</div>'
    + '      <div style="font-size:.84rem;color:#666;margin-top:3px">sales@singhsprint.com</div>'
    + '      <div class="row">'
    + '        <button onclick="SP_LANG && SP_LANG.toggleLang && SP_LANG.toggleLang()" id="langToggle">' + (IS_FR ? 'EN' : 'FR') + '</button>'
    + '        <a href="' + BASE + '/quote" class="sp-cta" data-i18n="nav.quote">' + t('Get a Quote', 'Soumission') + '</a>'
    + '      </div>'
    + '    </div>'
    + '  </div>'
    + '</div>';

  // ----- Cart count binding -----
  function refreshCartCount() {
    var c = document.getElementById('sp-cart-count');
    if (!c || !window.SinghsCart) return;
    var n = 0;
    try {
      n = (window.SinghsCart.read().items || []).reduce(function (s, it) {
        return s + (parseInt(it.qty, 10) || 0);
      }, 0);
    } catch (e) { n = 0; }
    if (n > 0) { c.classList.add('is-on'); c.textContent = n > 99 ? '99+' : String(n); }
    else       { c.classList.remove('is-on'); }
  }
  refreshCartCount();
  window.addEventListener('singhsCartChange', refreshCartCount);
  setInterval(refreshCartCount, 1000);

  window.__spOpenDrawer = function () {
    var d = document.getElementById('sp-drawer');
    if (!d) return;
    d.classList.add('is-open');
    d.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };
  window.__spCloseDrawer = function () {
    var d = document.getElementById('sp-drawer');
    if (!d) return;
    d.classList.remove('is-open');
    d.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  // 2026-05-24 — Mobile Quote-pill belt-and-suspenders.
  //
  // A user reported tapping the black "Quote" pill in the mobile nav
  // does nothing — tap registers visually but no navigation. We could
  // not reproduce in desktop emulation; markup, CSS, and pointer-
  // events all check out. Most likely cause is an iOS Safari touch
  // interaction with the sticky+backdrop-filter parent header.
  //
  // The fix: register touchstart + click listeners that explicitly
  // call window.location.assign('/quote'). If the native <a> click
  // works, this is a harmless no-op (browser navigates first, JS
  // never runs). If the native click is swallowed, the JS fallback
  // forces the navigation.
  //
  // We bind on touchstart with passive:false so we can preventDefault
  // any conflicting parent touch handler that might be silently
  // eating the tap. Click is the fallback path for keyboard / mouse.
  var mq = document.querySelector('a.sp-mobile-quote');
  if (mq) {
    var goToQuote = function (ev) {
      // Honour modifier-click / middle-click (open in new tab)
      if (ev && (ev.metaKey || ev.ctrlKey || ev.shiftKey || (ev.button && ev.button !== 0))) return;
      // Belt-and-suspenders: even if the native href works first,
      // location.assign is idempotent — navigating to /quote when
      // already-navigating-to-/quote is a no-op.
      try { window.location.assign(mq.getAttribute('href') || '/quote'); }
      catch (e) { window.location.href = '/quote'; }
    };
    mq.addEventListener('click', goToQuote);
    // Touch fallback for iOS Safari edge cases where the click event
    // never fires (e.g., touch-action confusion with sticky parent).
    mq.addEventListener('touchend', function (ev) {
      if (ev.cancelable) ev.preventDefault();
      goToQuote(ev);
    }, { passive: false });
  }
  // ----- Inline search dropdown (no full-screen overlay) -----
  // We bind both the desktop search field and the in-drawer mobile one to
  // the same typeahead logic. Each has its own results panel.
  function wireSearch(inputId, panelId) {
    var input = document.getElementById(inputId);
    var panel = document.getElementById(panelId);
    if (!input || !panel) return;
    var qT = null;
    function close() { panel.classList.remove('is-on'); }
    function open()  { panel.classList.add('is-on'); }

    input.addEventListener('focus', function () {
      if (input.value.trim().length >= 2 && panel.innerHTML) open();
    });
    input.addEventListener('input', function () {
      var q = input.value.trim();
      clearTimeout(qT);
      if (q.length < 2) { panel.innerHTML = ''; close(); return; }
      // Optimistic: show a skeleton hint so the panel feels responsive
      // even before the API answers.
      panel.innerHTML = '<div class="sp-search-empty">' + t('Searching…', 'Recherche…') + '</div>';
      open();
      qT = setTimeout(function () {
        fetch('https://singhsprint-crm.vercel.app/api/catalog?q=' + encodeURIComponent(q) + '&limit=8', { cache: 'no-store' })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (d) {
            var list = (d && d.products) ? d.products : (Array.isArray(d) ? d : []);
            if (!list.length) {
              panel.innerHTML = '<div class="sp-search-empty">' + t('No products match.', 'Aucun produit.') + '</div>';
              return;
            }
            // S&S Activewear, Blanks.ca and SanMar Canada all 403 direct
            // hotlinks from external referrers, so every supplier image
            // gets routed through
            // /api/image-proxy here, matching catalog.html's imgUrl() rules.
            // Anything else (local /images, singhsprint.com) is passed through.
            var IMG_PROXY = 'https://singhsprint-crm.vercel.app/api/image-proxy';
            var PROXIED_HOSTS = ['ssactivewear.com', 'blanks.ca', 'sanmarcanada.com'];
            function searchImgUrl(raw) {
              if (!raw) return '';
              if (raw.indexOf('/api/image-proxy') >= 0) return raw;
              if (raw.charAt(0) === '/' || raw.indexOf('singhsprint.com') >= 0) return raw;
              for (var i = 0; i < PROXIED_HOSTS.length; i++) {
                if (raw.indexOf(PROXIED_HOSTS[i]) >= 0) {
                  return IMG_PROXY + '?url=' + encodeURIComponent(raw);
                }
              }
              return raw;
            }
            // The "See all results in catalog" CTA is the customer's
            // primary intent button when they typed a query and want the
            // full filterable result set. Promote it to the TOP of the
            // dropdown styled as a yellow accent button — way more
            // discoverable than a centered link buried under 8 cards.
            var allBtn = '<a class="sp-search-allbtn" href="' + BASE + '/catalog?q=' + encodeURIComponent(q) + '">'
              + '<span>' + t('See all results for ', 'Voir tous les résultats pour ') + '"' + q + '"</span>'
              + '<span class="sp-search-allbtn__hint">↵</span>'
              + '</a>';
            panel.innerHTML = allBtn + list.slice(0, 8).map(function (p) {
              var raw = (p.hero_image_url || '').replace(/^http:\/\//, 'https://');
              var img = searchImgUrl(raw);
              return '<a class="sp-search-result" href="' + BASE + '/catalog?q=' + encodeURIComponent(p.style_number || p.name || '') + '">'
                + (img ? '<img src="' + img + '" alt="" loading="lazy"/>' : '<span style="width:44px;height:44px"></span>')
                + '<span style="flex:1;min-width:0"><strong>' + (p.name || p.style_number || '') + '</strong>'
                + '<br><span style="color:#888;font-size:.76rem">' + (p.brand || '') + (p.style_number ? ' &middot; ' + p.style_number : '') + '</span></span>'
                + '</a>';
            }).join('');
          })
          .catch(function () {
            panel.innerHTML = '<div class="sp-search-empty">' + t("Couldn't load — try again.", 'Échec — réessayez.') + '</div>';
          });
      }, 180);
    });
    // Match the submit button to this specific input (desktop button pairs
    // with desktop input, mobile with mobile). Same go-to-catalog behavior
    // as pressing Enter — clicking commits the search.
    var goBtn = document.getElementById(inputId.replace('sp-search-input', 'sp-search-go'));
    if (goBtn) {
      goBtn.addEventListener('click', function (e) {
        e.preventDefault();
        var q = input.value.trim();
        if (q.length) window.location.href = BASE + '/catalog?q=' + encodeURIComponent(q);
        else input.focus();   // empty input → just focus, let them type
      });
    }
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var q = input.value.trim();
        if (q.length) window.location.href = BASE + '/catalog?q=' + encodeURIComponent(q);
      } else if (e.key === 'Escape') {
        close();
        input.blur();
      }
    });
    // Click outside → close
    document.addEventListener('click', function (e) {
      var wrap = panel.parentElement;
      if (!wrap) return;
      if (!wrap.contains(e.target)) close();
    });
  }
  wireSearch('sp-search-input', 'sp-search-panel');
  wireSearch('sp-search-input-mobile', 'sp-search-panel-mobile');

  // Esc closes drawer too
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    window.__spCloseDrawer();
  });

  // ----- Catalog prefetch -----
  // On pages OTHER than the catalog itself, fire a low-priority fetch to
  // /api/catalog?limit=120 after first paint so when the user clicks
  // "Catalog" the response is already in the browser cache. Uses
  // requestIdleCallback so it never blocks anything that matters.
  // Skipped if the user has slow connection (saveData / 2G).
  (function prefetchCatalog() {
    var p = window.location.pathname.toLowerCase();
    if (p.indexOf('/catalog') === 0 || p.indexOf('/fr/catalog') === 0) return;
    var c = navigator.connection;
    if (c && (c.saveData || /2g/.test(c.effectiveType || ''))) return;
    function run() {
      try {
        fetch('https://singhsprint-crm.vercel.app/api/catalog?limit=120', {
          cache: 'force-cache',
          priority: 'low'
        }).catch(function () { /* best-effort */ });
      } catch (e) {}
    }
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(run, { timeout: 4000 });
    } else {
      setTimeout(run, 2500);
    }
  })();

  // ----- Account chip state -----
  // Reads /account/auth.js's cache at localStorage['sp.account.profile']
  // to decide whether to morph the round icon into the lime "Business"
  // pill. Personal accounts and anonymous visitors see the default round
  // icon. The cache is written by /account/auth.js on every session
  // refresh, so this swap is instant on subsequent page loads.
  (function updateAccountChip() {
    var chip = document.getElementById('sp-account-chip');
    if (!chip) return;
    try {
      var raw = localStorage.getItem('sp.account.profile');
      if (!raw) return;
      var prof = JSON.parse(raw);
      if (prof && prof.accountType === 'business') {
        chip.classList.add('is-biz');
        chip.setAttribute('aria-label',
          (IS_FR ? 'Compte entreprise' : 'Business account')
          + (prof.orgName ? ' — ' + prof.orgName : ''));
        chip.setAttribute('title', chip.getAttribute('aria-label'));
      }
    } catch (e) { /* cache corrupt — ignore */ }
  })();
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
  // scraping "438-544-3800sales@singhsprint.com@singhsprint on..." because
  // the <a> siblings extract as one continuous string.
  el.innerHTML = ''
    + '<footer class="footer" data-nosnippet>'
    + '  <div class="container">'
    + '    <div class="footer-grid" style="grid-template-columns:1.6fr 1fr 1fr 1fr 1fr">'
    + '      <div class="footer-brand">'
    + '        <div class="logo"><span>SINGHS</span><span>PRINT</span></div>'
    + '        <p style="margin-top:12px" data-i18n="footer.brand">Custom apparel printing in Montreal\'s West Island. DTG, DTF &amp; Embroidery for brands, businesses, and creators. Open 7 days, 9AM\u20139PM.</p>'
    + '      </div>'
    + '      <div class="footer-col"><h4 data-i18n="footer.pages">Pages</h4><a href="/" data-i18n="footer.home">Home</a><a href="/quote" data-i18n="footer.getquote">Get a Quote</a><a href="/portfolio" data-i18n="footer.portfolio">Portfolio</a><a href="/inkwear">Inkwear</a><a href="/youth-initiative" data-i18n="footer.youth">Youth Initiative</a><a href="/about" data-i18n="footer.about">About</a></div>'
    + '      <div class="footer-col" data-mobile-hide><h4>For Businesses</h4><a href="/businesses">Volume pricing</a><a href="/businesses/rfp">Start an RFP</a><a href="/industries/construction-workwear">Construction</a><a href="/industries/restaurant-hospitality-uniforms">Restaurant &amp; hospitality</a><a href="/industries/corporate-tech-swag">Corporate &amp; tech</a><a href="/industries/charity-events-fundraisers">Charity &amp; events</a><a href="/industries/schools-sports-teams">Schools &amp; sports</a></div>'
    + '      <div class="footer-col" data-mobile-hide><h4>Guides</h4><a href="/guides/decoration-method-durability">Decoration durability</a><a href="/guides/procurement-checklist">Procurement checklist</a><a href="/guides/charity-run-timeline">Charity run timeline</a><a href="/guides/construction-crew-cost">Crew cost analysis</a><a href="/#services" data-i18n="footer.dtg">DTG, DTF &amp; embroidery</a></div>'
    + '      <div class="footer-col"><h4 data-i18n="footer.contact">Contact</h4><a href="tel:4385443800" aria-label="Call us at 438-544-3800">Call 438-544-3800</a><a href="mailto:sales@singhsprint.com" aria-label="Email sales@singhsprint.com">Email sales@singhsprint.com</a><a href="https://instagram.com/singhsprint" target="_blank" rel="noopener" aria-label="Follow on Instagram">Instagram @singhsprint</a><a href="https://maps.app.goo.gl/FX8o2QEvQzngxeiv7" target="_blank" rel="noopener" data-i18n="footer.location">West Island, Montreal</a></div>'
    + '    </div>'
    + '    <div class="footer-bottom">'
    + '      <span>&copy; <span data-i18n="footer.rights">2026 Imprimerie Singhs Print &middot; NEQ 1181573313</span></span>'
    + '      <span class="footer-legal" style="display:flex;gap:14px;flex-wrap:wrap;align-items:center"><a href="/privacy" data-i18n="footer.privacy">Privacy</a><a href="/cookies" data-i18n="footer.cookies">Cookies</a><a href="/terms" data-i18n="footer.terms">Terms</a><a href="/accessibility" data-i18n="footer.accessibility">Accessibility</a><a href="#" onclick="if(window.SP_CONSENT){SP_CONSENT.reopen();}return false;" data-i18n="footer.cookieprefs">Cookie preferences</a></span>'
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
        "telephone": "+1-438-544-3800",
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
          "reviewCount": "27",
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
            "acceptedAnswer": { "@type": "Answer", "text": "Standard turnaround is 3–5 business days from approved artwork. Rush (2–3 days) is available with a small surcharge; talk to us before ordering." }
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
        "telephone": "+1-438-544-3800",
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
  // /catalog has its own sticky cart bar at the bottom — adding our generic
  // CTA on top of it causes them to overlap on mobile. Skip on catalog too.
  if (path === '/catalog' || path === '/catalog/' || path.indexOf('/catalog/') === 0) return;
  if (path === '/fr/catalog' || path === '/fr/catalog/' || path.indexOf('/fr/catalog/') === 0) return;
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
    +   '<a href="tel:4385443800" class="sp-mid-cta__alt" data-i18n="midcta.alt">or call 438-544-3800</a>'
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

// =====================================================================
// loadProductModal — sitewide product-detail popup, shared across pages.
//
// Triggered on any element that has  data-modal-style="64000"  (or
// equivalent supplier style number). The element keeps its normal
// `href` as a fallback for crawlers and no-JS visitors. JS hijacks
// the click and opens a lightweight modal that fetches the product
// from /api/catalog?q=<style>, renders image + brand + name + price,
// and offers two CTAs: "Add to quote" (jumps into the quote builder
// with the product preloaded) and "Open full catalogue" (the
// original href the element pointed at).
//
// Used on the industry landing pages to surface the canonical Gildan
// blank (most popular pick) before sending the visitor into the
// broader catalog. Editable per-card via data attributes:
//   data-modal-style="64000"    -- supplier style number to fetch
//   data-modal-fallback="/catalog?type=tshirt"  -- explicit "Open full
//                                  catalogue" target; defaults to the
//                                  element's own href if not provided
// =====================================================================
function loadProductModal() {
  if (document.getElementById('sp-product-modal')) return;

  // Inject styles once. Scoped under .sp-pm so they can't bleed.
  var st = document.createElement('style');
  st.id = 'sp-product-modal-styles';
  st.textContent = [
    '.sp-pm{position:fixed;inset:0;z-index:1300;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(20,20,20,.55);backdrop-filter:blur(2px)}',
    '.sp-pm.is-open{display:flex}',
    '.sp-pm__card{background:#fff;border-radius:18px;max-width:640px;width:100%;max-height:88vh;overflow:auto;box-shadow:0 24px 80px rgba(0,0,0,.25);position:relative;font-family:inherit}',
    '.sp-pm__close{position:absolute;top:12px;right:12px;width:36px;height:36px;border-radius:50%;border:none;background:rgba(0,0,0,.06);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;color:#1a1a1a;font-size:18px;line-height:1}',
    '.sp-pm__close:hover{background:rgba(0,0,0,.12)}',
    '.sp-pm__grid{display:grid;grid-template-columns:240px 1fr;gap:22px;padding:24px}',
    '.sp-pm__img{width:100%;aspect-ratio:1/1;border-radius:12px;background:#fff;object-fit:contain;padding:4%;display:block}',
    '.sp-pm__brand{font-size:.74rem;letter-spacing:.16em;text-transform:uppercase;color:#888;font-weight:700;margin-bottom:6px}',
    '.sp-pm__name{font-family:Georgia,serif;font-size:1.35rem;line-height:1.2;color:#1a1a1a;margin-bottom:10px}',
    '.sp-pm__meta{font-size:.86rem;color:#666;margin-bottom:14px;line-height:1.5}',
    '.sp-pm__price{display:block;font-size:1.2rem;font-weight:700;color:#1a1a1a;margin-bottom:16px}',
    '.sp-pm__price small{font-size:.74rem;font-weight:400;color:#888;display:block;margin-top:2px}',
    '.sp-pm__cta{display:flex;flex-direction:column;gap:8px}',
    '.sp-pm__cta a{display:inline-flex;align-items:center;justify-content:center;padding:11px 16px;border-radius:50px;text-decoration:none;font-size:.88rem;font-weight:600;transition:all .15s}',
    '.sp-pm__cta a.primary{background:#1a1a1a;color:#fff}',
    '.sp-pm__cta a.primary:hover{background:#333}',
    '.sp-pm__cta a.secondary{background:transparent;color:#1a1a1a;border:1.5px solid #e0e0e0}',
    '.sp-pm__cta a.secondary:hover{border-color:#1a1a1a}',
    '.sp-pm__skel{padding:80px 24px;text-align:center;color:#888;font-size:.9rem}',
    '@media(max-width:520px){.sp-pm__grid{grid-template-columns:1fr;gap:14px;padding:18px}.sp-pm__img{max-width:200px;margin:0 auto}}'
  ].join('');
  document.head.appendChild(st);

  // Modal shell
  var modal = document.createElement('div');
  modal.id = 'sp-product-modal';
  modal.className = 'sp-pm';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = '<div class="sp-pm__card" role="dialog" aria-modal="true">'
    + '<button class="sp-pm__close" aria-label="Close" onclick="window.__spCloseProductModal()">×</button>'
    + '<div id="sp-pm__body" class="sp-pm__skel">Loading…</div>'
    + '</div>';
  document.body.appendChild(modal);

  // Click outside the card → close
  modal.addEventListener('click', function (e) {
    if (e.target === modal) window.__spCloseProductModal();
  });

  window.__spCloseProductModal = function () {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  var IS_FR = /^\/fr(\/|$)/.test(window.location.pathname);
  function t(en, fr) { return IS_FR ? fr : en; }

  // Cache to avoid re-fetching the same product if the user opens it twice
  var cache = {};

  function render(p, fallbackHref, qty) {
    var body = document.getElementById('sp-pm__body');
    if (!body) return;
    if (!p) {
      body.className = 'sp-pm__skel';
      body.innerHTML = t("Couldn't load this product right now.", 'Impossible de charger ce produit.');
      return;
    }
    var img = (p.hero_image_url || '').replace(/^http:\/\//, 'https://');
    var name  = p.name || p.style_number || '—';
    var brand = (p.brand || '').toUpperCase();
    var style = p.style_number || '';
    var colors = (p.color_count != null) ? p.color_count : ((p.colors || []).length);
    var weight = p.weight_oz ? (p.weight_oz + ' oz') : '';
    var fabric = p.fabric || '';
    var price  = p.price_from ? ('$' + Number(p.price_from).toFixed(2) + ' /unit') : '';
    // Footnote tracks whichever qty tier the price was computed at, so the
    // modal reads "1-side print at 200-unit volume" when the card said
    // "/unit at 200+", and "250" when the card was "/unit at 250+".
    var qtyN = (qty && Number(qty) > 0) ? Number(qty) : 50;
    var qtyEn = 'Includes 1-side print at ' + qtyN + '-unit volume';
    var qtyFr = 'Inclut impression 1 côté au volume de ' + qtyN + ' unités';
    var quoteHref = '/quote?product=' + encodeURIComponent(p.product_id || style) + '&qty=' + qtyN;
    body.className = '';
    body.innerHTML = ''
      + '<div class="sp-pm__grid">'
      + (img ? '<img class="sp-pm__img" src="' + img + '" alt="' + name.replace(/"/g,'&quot;') + '" loading="lazy"/>' : '<div class="sp-pm__img"></div>')
      + '<div>'
      +   '<div class="sp-pm__brand">' + brand + (style ? ' &middot; ' + style : '') + '</div>'
      +   '<h3 class="sp-pm__name">' + name + '</h3>'
      +   '<div class="sp-pm__meta">'
      +     (colors ? '<strong>' + colors + '</strong> ' + t('colors', 'couleurs') : '')
      +     (weight ? ' &middot; ' + weight : '')
      +     (fabric ? ' &middot; ' + fabric : '')
      +   '</div>'
      +   (price ? '<span class="sp-pm__price">' + t('From', 'À partir de') + ' ' + price + '<small>' + t(qtyEn, qtyFr) + '</small></span>' : '')
      +   '<div class="sp-pm__cta">'
      +     '<a class="primary" href="' + quoteHref + '">' + t('Add to quote &rarr;', 'Ajouter à la soumission &rarr;') + '</a>'
      +     '<a class="secondary" href="' + fallbackHref + '">' + t('View full catalogue', 'Voir tout le catalogue') + '</a>'
      +   '</div>'
      + '</div>'
      + '</div>';
  }

  window.__spOpenProductModal = function (style, fallbackHref, brand, qty) {
    if (!style) {
      // No style mapped — just navigate to the fallback (filter view).
      if (fallbackHref) window.location.href = fallbackHref;
      return;
    }
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    var body = document.getElementById('sp-pm__body');
    body.className = 'sp-pm__skel';
    body.innerHTML = t('Loading…', 'Chargement…');

    // qty drives which volume tier the API computes price_from at. Most
    // industry cards advertise "/unit at 200+" so we default to 200 — that
    // way the modal price matches the card price the customer just saw.
    // Pages with a different tier (e.g. Race Tees @ 250+) set
    // data-modal-qty explicitly on the card.
    var qtyVal = parseInt(qty, 10);
    if (!Number.isFinite(qtyVal) || qtyVal < 1) qtyVal = 200;

    var key = (brand ? brand + '|' : '') + style + '|' + qtyVal;
    if (cache[key]) { render(cache[key], fallbackHref, qtyVal); return; }

    // brand+style disambiguates common style numbers (e.g. "8800" matches
    // both Bella+Canvas Women's Flowy Tank and Gildan DryBlend Polo). When
    // brand is provided, we filter the API search by it AND match the
    // brand on the client too as a safety net.
    var url = 'https://singhsprint-crm.vercel.app/api/catalog?q=' +
              encodeURIComponent(style) + '&limit=8&qty=' + qtyVal;
    if (brand) url += '&brand=' + encodeURIComponent(brand);
    fetch(url, { cache: 'force-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var list = (d && d.products) ? d.products : [];
        var norm = function(s) { return (s || '').toString().toLowerCase().replace(/[^a-z0-9]/g, ''); };
        var sTarget = norm(style);
        var bTarget = norm(brand);
        // Prefer brand+style exact match → style exact match → first hit.
        var match =
          list.find(function (p) { return norm(p.style_number) === sTarget && (!bTarget || norm(p.brand) === bTarget); }) ||
          list.find(function (p) { return norm(p.style_number) === sTarget; }) ||
          list[0];
        cache[key] = match;
        render(match, fallbackHref, qtyVal);
      })
      .catch(function () { render(null, fallbackHref, qtyVal); });
  };

  // Esc closes
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') window.__spCloseProductModal();
  });

  // Wire up any card on the page that has a data-modal-style attribute.
  // Optional data-modal-brand disambiguates common style numbers.
  // Optional data-modal-qty makes the modal price match the card price
  // (e.g. "/unit at 200+" on the card → qty=200 to the price API).
  // We delegate at document level so newly-injected cards work too.
  document.addEventListener('click', function (e) {
    var card = e.target.closest('[data-modal-style]');
    if (!card) return;
    e.preventDefault();
    var style = card.getAttribute('data-modal-style');
    var brand = card.getAttribute('data-modal-brand') || null;
    var qty   = card.getAttribute('data-modal-qty')   || null;
    var fb    = card.getAttribute('data-modal-fallback') || card.getAttribute('href') || '/catalog';
    window.__spOpenProductModal(style, fb, brand, qty);
  }, true);
}

// =========================================================================
// loadLiveReviews — patches every visible "5.0★ (27 reviews)" / "5.0/5 (21
// reviews)" / "(21 reviews)" / "(21 avis)" instance on the page using the
// live numbers from /api/google-reviews. Build-time script (scripts/sync-
// google-reviews.mjs) handles the same job for SEO + initial render; this
// runtime patcher is the safety net for visitors hitting a stale deploy.
// =========================================================================
function loadLiveReviews() {
  // Lightweight session cache so we don't refetch on every soft-nav.
  try {
    var cached = sessionStorage.getItem('sp-reviews');
    if (cached) {
      var c = JSON.parse(cached);
      if (c && c._t && Date.now() - c._t < 6 * 3600 * 1000) {
        patch(c.rating, c.count); return;
      }
    }
  } catch (_) { /* ignore */ }

  fetch('https://singhsprint-crm.vercel.app/api/google-reviews', { cache: 'force-cache' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || typeof d.rating !== 'number' || typeof d.count !== 'number') return;
      patch(d.rating, d.count);
      try {
        sessionStorage.setItem('sp-reviews', JSON.stringify({ rating: d.rating, count: d.count, _t: Date.now() }));
      } catch (_) { /* private mode etc. */ }
    })
    .catch(function () { /* ignore — fall back to whatever HTML rendered */ });

  function patch(rating, count) {
    var ratingStr = Number(rating).toFixed(1);
    var countStr  = String(count);
    // Walk text nodes and rewrite known patterns. Keeps the DOM structure
    // intact and only touches the literal strings.
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var patterns = [
      [/\b5\.0★ \(\d+ reviews\)/g,    ratingStr + '★ (' + countStr + ' reviews)'],
      [/\b5\.0\/5 \(\d+ reviews\)/g,  ratingStr + '/5 (' + countStr + ' reviews)'],
      [/\b5\.0\/5 \(\d+ avis\)/g,     ratingStr + '/5 (' + countStr + ' avis)'],
      [/\b\(21 reviews\)/g,           '(' + countStr + ' reviews)'],
      [/\b\(21 Reviews\)/g,           '(' + countStr + ' Reviews)'],
      [/\b\(21 avis\)/g,              '(' + countStr + ' avis)'],
    ];
    var node;
    while ((node = walker.nextNode())) {
      var txt = node.nodeValue;
      if (!txt) continue;
      var changed = txt;
      for (var i = 0; i < patterns.length; i++) {
        changed = changed.replace(patterns[i][0], patterns[i][1]);
      }
      if (changed !== txt) node.nodeValue = changed;
    }
  }
}

// Auto-run when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  loadSearchConsoleVerification();
  loadAnalytics();
  loadMobileTrim();
  loadPromoLoader();
  loadNav();
  loadFooter();
  loadSchema();
  loadStickyCTA();
  loadMidPageCTA();
  loadProductModal();
  loadLiveReviews();
});

/* ============================================================
   "Text us" floating widget — routes a website message into the
   Singhs Print CRM as an inbound text (Messages inbox + push).
   Self-contained; loaded site-wide via components.js. EN/FR.
   ============================================================ */
(function () {
  if (window.__spTextWidget) return; window.__spTextWidget = true;
  var CRM_URL = 'https://singhsprint-crm.vercel.app/api/widget/text';
  var TEL = '+14385443800';
  var TEL_DISPLAY = '438-544-3800';
  function ready(fn){ if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function () {
    var fr = (document.documentElement.lang || '').slice(0,2).toLowerCase() === 'fr' || /\/fr\//.test(location.pathname);
    function T(en, frStr){ return fr ? frStr : en; }
    var css =
      '.sp-tw-btn{position:fixed;right:18px;bottom:18px;z-index:9999;display:inline-flex;align-items:center;gap:8px;background:#111;color:#fff;border:none;border-radius:999px;padding:12px 18px;font:600 14px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.25);cursor:pointer}' +
      '.sp-tw-btn:hover{opacity:.92}' +
      '.sp-tw-panel{position:fixed;right:18px;bottom:74px;z-index:9999;width:330px;max-width:calc(100vw - 36px);background:#fff;color:#111;border:1px solid #e5e5e5;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.22);overflow:hidden}' +
      '.sp-tw-panel,.sp-tw-panel *{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-sizing:border-box}' +
      '.sp-tw-head{background:#111;color:#fff;padding:14px 16px;font-weight:700;font-size:15px;display:flex;justify-content:space-between;align-items:center}' +
      '.sp-tw-head button{background:none;border:none;color:#fff;font-size:20px;line-height:1;cursor:pointer}' +
      '.sp-tw-body{padding:14px 16px}' +
      '.sp-tw-body>p{margin:0 0 10px;font-size:13px;color:#555}' +
      '.sp-tw-body input,.sp-tw-body textarea{width:100%;border:1px solid #ddd;border-radius:9px;padding:9px 11px;font-size:14px;margin-bottom:8px}' +
      '.sp-tw-body textarea{resize:vertical;min-height:64px}' +
      '.sp-tw-send{width:100%;background:#111;color:#fff;border:none;border-radius:9px;padding:11px;font-weight:600;font-size:14px;cursor:pointer}' +
      '.sp-tw-send:disabled{opacity:.5;cursor:default}' +
      '.sp-tw-consent{font-size:11px;color:#999;margin-top:8px;line-height:1.4}' +
      '.sp-tw-alt{display:block;text-align:center;font-size:12px;color:#111;margin-top:10px;text-decoration:underline}' +
      '.sp-tw-hp{position:absolute!important;left:-9999px!important}' +
      '.sp-tw-ok{padding:22px 16px;text-align:center;font-size:14px;color:#111}' +
      '@media (max-width:760px){.sp-tw-btn{bottom:calc(80px + env(safe-area-inset-bottom))}.sp-tw-panel{bottom:calc(136px + env(safe-area-inset-bottom))}}';
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var btn = document.createElement('button');
    btn.className = 'sp-tw-btn'; btn.type = 'button';
    btn.setAttribute('aria-label', T('Text us', 'Ecrivez-nous'));
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg><span>' + T('Text us', 'Texto') + '</span>';
    var panel = document.createElement('div');
    panel.className = 'sp-tw-panel'; panel.style.display = 'none';
    panel.innerHTML =
      '<div class="sp-tw-head">' + T('Text Singhs Print', 'Texto Singhs Print') + '<button type="button" aria-label="Close">&times;</button></div>' +
      '<div class="sp-tw-body">' +
        '<p>' + T("Got a question? Send us a text and we'll reply to your phone.", "Une question? Ecrivez-nous et on repond par texto.") + '</p>' +
        '<input class="sp-tw-name" type="text" placeholder="' + T('Your name (optional)', 'Votre nom (optionnel)') + '">' +
        '<input class="sp-tw-phone" type="tel" inputmode="tel" placeholder="' + T('Your mobile number', 'Votre numero mobile') + '">' +
        '<textarea class="sp-tw-msg" placeholder="' + T('How can we help? (quantities, deadline, etc.)', 'Comment aider? (quantites, echeance...)') + '"></textarea>' +
        '<input class="sp-tw-hp" type="text" tabindex="-1" autocomplete="off" aria-hidden="true">' +
        '<button class="sp-tw-send" type="button">' + T('Send text', 'Envoyer') + '</button>' +
        '<div class="sp-tw-consent">' + T('By sending, you agree to receive texts about your inquiry.', 'En envoyant, vous acceptez de recevoir des textos.') + '</div>' +
        '<a class="sp-tw-alt" href="sms:' + TEL + '">' + T('Or text us directly: ', 'Ou textez-nous: ') + TEL_DISPLAY + '</a>' +
      '</div>';
    document.body.appendChild(btn); document.body.appendChild(panel);
    var open = false;
    function toggle(v){ open = (v===undefined) ? !open : v; panel.style.display = open ? 'block' : 'none'; }
    btn.addEventListener('click', function(){ toggle(); });
    panel.querySelector('.sp-tw-head button').addEventListener('click', function(){ toggle(false); });
    var send = panel.querySelector('.sp-tw-send');
    send.addEventListener('click', function(){
      var name = panel.querySelector('.sp-tw-name').value.trim();
      var phone = panel.querySelector('.sp-tw-phone').value.trim();
      var msg = panel.querySelector('.sp-tw-msg').value.trim();
      var hp = panel.querySelector('.sp-tw-hp').value.trim();
      var consent = panel.querySelector('.sp-tw-consent');
      if (!phone || !msg) { consent.textContent = T('Please add your number and a message.', 'Ajoutez votre numero et un message.'); return; }
      send.disabled = true; send.textContent = T('Sending...', 'Envoi...');
      fetch(CRM_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name:name, phone:phone, message:msg, page: location.href, company_website: hp }) })
        .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ return { ok:r.ok, j:j }; }); })
        .then(function(res){
          if (!res.ok) { send.disabled=false; send.textContent=T('Send text','Envoyer'); consent.textContent = (res.j && res.j.error) || T('Something went wrong - please call us.', 'Erreur - appelez-nous.'); return; }
          panel.querySelector('.sp-tw-body').innerHTML = '<div class="sp-tw-ok">' + T("Thanks! We got your message and will text you back shortly.", "Merci! On a recu votre message et on vous repond par texto sous peu.") + '</div>';
          if (window.gtag) { try { window.gtag('event', 'web_text_lead'); } catch(e){} }
        })
        .catch(function(){ send.disabled=false; send.textContent=T('Send text','Envoyer'); consent.textContent = T('Network error - please call us.', 'Erreur reseau - appelez-nous.'); });
    });
  });
})();
